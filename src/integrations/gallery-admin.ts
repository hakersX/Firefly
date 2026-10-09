// 本地相册管理后台（仅 pnpm dev）
//
// 挂在 Astro 开发服务器上：打开 http://localhost:4321/__admin/gallery 即可
// 上传 / 删除图片、新建 / 编辑 / 删除相册。所有操作直接改项目文件：
//   - 相册列表：src/data/gallery.json（galleryConfig.ts 从这里读取）
//   - 图片：public/gallery/<相册 id>/
// 改完照常提交推送即可上线。正式构建不包含这里的任何东西，线上访问不到。
//
// 安全：只接受本机（loopback）请求；相册 id 与文件名都按白名单校验，杜绝路径穿越。

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "src/data/gallery.json");
const GALLERY_DIR = path.join(ROOT, "public/gallery");
const PAGE_FILE = fileURLToPath(new URL("./gallery-admin.html", import.meta.url));
const PREFIX = "/__admin/gallery";

const ALBUM_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;
const MAX_UPLOAD = 30 * 1024 * 1024; // 单张 30MB

type Album = {
	id: string;
	name: string;
	description?: string;
	date?: string;
	location?: string;
	tags?: string[];
	cover?: string;
	password?: string;
	passwordHint?: string;
};

const EDITABLE: (keyof Album)[] = [
	"name",
	"description",
	"date",
	"location",
	"tags",
	"cover",
	"password",
	"passwordHint",
];

class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function readAlbums(): Promise<Album[]> {
	try {
		return JSON.parse(await fs.readFile(DATA_FILE, "utf-8")) as Album[];
	} catch {
		return [];
	}
}

async function writeAlbums(albums: Album[]): Promise<void> {
	await fs.writeFile(DATA_FILE, `${JSON.stringify(albums, null, "\t")}\n`);
}

async function listPhotos(id: string): Promise<string[]> {
	try {
		return (await fs.readdir(path.join(GALLERY_DIR, id)))
			.filter((f) => IMAGE_EXT.test(f))
			.sort();
	} catch {
		return [];
	}
}

function albumDir(id: string): string {
	if (!ALBUM_ID.test(id)) throw new HttpError(400, "相册 id 只能用小写字母、数字和短横线");
	return path.join(GALLERY_DIR, id);
}

// 上传的文件名只保留安全字符；重名时自动加序号，不覆盖已有图片
async function safeFileName(dir: string, raw: string): Promise<string> {
	const ext = path.extname(raw).toLowerCase();
	if (!IMAGE_EXT.test(ext)) throw new HttpError(400, "只支持 jpg / png / webp / avif / gif");
	const base =
		path
			.basename(raw, path.extname(raw))
			.replace(/[^\p{L}\p{N}_-]+/gu, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "photo";
	let name = `${base}${ext}`;
	for (let i = 2; ; i++) {
		try {
			await fs.access(path.join(dir, name));
			name = `${base}-${i}${ext}`;
		} catch {
			return name;
		}
	}
}

function pickFields(input: Record<string, unknown>): Partial<Album> {
	const out: Partial<Album> = {};
	for (const key of EDITABLE) {
		if (!(key in input)) continue;
		const value = input[key];
		if (key === "tags") {
			const tags = (Array.isArray(value) ? value : String(value ?? "").split(/[,，]/))
				.map((t) => String(t).trim())
				.filter(Boolean);
			if (tags.length) out.tags = tags;
		} else if (typeof value === "string" && value.trim()) {
			out[key] = value.trim() as never;
		}
	}
	return out;
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > limit) {
				reject(new HttpError(413, "文件太大"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
	try {
		return JSON.parse((await readBody(req, 1024 * 1024)).toString("utf-8"));
	} catch (err) {
		if (err instanceof HttpError) throw err;
		throw new HttpError(400, "请求格式不对");
	}
}

function send(res: ServerResponse, status: number, body: unknown): void {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify(body));
}

// 图片增删后在后台重新生成 LQIP 占位数据（src/constants/lqips.json），连续操作合并成一次
let lqipTimer: NodeJS.Timeout | undefined;
function scheduleLqips(log: (msg: string) => void): void {
	clearTimeout(lqipTimer);
	lqipTimer = setTimeout(() => {
		const child = spawn("npx", ["tsx", "scripts/generate-lqips.ts"], {
			cwd: ROOT,
			shell: true,
			stdio: "ignore",
		});
		child.on("exit", (code) => log(`gallery-admin: LQIP 已更新（exit ${code}）`));
	}, 1500);
}

async function handleApi(
	req: IncomingMessage,
	res: ServerResponse,
	route: string,
	log: (msg: string) => void,
): Promise<void> {
	const method = req.method ?? "GET";
	const parts = route.split("/").filter(Boolean).map(decodeURIComponent);
	// parts: ["albums"] | ["albums", id] | ["albums", id, "photos"] | ["albums", id, "photos", file]
	if (parts[0] !== "albums") throw new HttpError(404, "未知接口");
	const albums = await readAlbums();
	const id = parts[1];

	// GET /albums —— 相册列表（带图片文件名）
	if (!id && method === "GET") {
		const result = await Promise.all(
			albums.map(async (a) => ({ ...a, photos: await listPhotos(a.id) })),
		);
		return send(res, 200, result);
	}

	// POST /albums —— 新建相册
	if (!id && method === "POST") {
		const body = await readJson(req);
		const newId = String(body.id ?? "").trim();
		const dir = albumDir(newId);
		if (albums.some((a) => a.id === newId)) throw new HttpError(409, "这个相册 id 已经存在");
		const fields = pickFields(body);
		if (!fields.name) throw new HttpError(400, "请填写相册名称");
		await fs.mkdir(dir, { recursive: true });
		albums.unshift({ id: newId, ...fields } as Album);
		await writeAlbums(albums);
		log(`gallery-admin: 新建相册 ${newId}`);
		return send(res, 201, { ok: true });
	}

	const index = albums.findIndex((a) => a.id === id);
	if (index < 0) throw new HttpError(404, "相册不存在");
	const dir = albumDir(id);

	// PUT /albums/:id —— 编辑相册信息（id 不可改，它决定目录和网址）
	if (parts.length === 2 && method === "PUT") {
		const body = await readJson(req);
		albums[index] = { id, ...pickFields(body) } as Album;
		if (!albums[index].name) throw new HttpError(400, "请填写相册名称");
		await writeAlbums(albums);
		log(`gallery-admin: 更新相册 ${id}`);
		return send(res, 200, { ok: true });
	}

	// DELETE /albums/:id —— 删除整个相册（配置 + 图片目录）
	if (parts.length === 2 && method === "DELETE") {
		albums.splice(index, 1);
		await writeAlbums(albums);
		await fs.rm(dir, { recursive: true, force: true });
		scheduleLqips(log);
		log(`gallery-admin: 删除相册 ${id}`);
		return send(res, 200, { ok: true });
	}

	// POST /albums/:id/photos —— 上传一张图片（请求体是文件本身，文件名放在 X-Filename 头里）
	if (parts[2] === "photos" && parts.length === 3 && method === "POST") {
		const raw = decodeURIComponent(String(req.headers["x-filename"] ?? ""));
		await fs.mkdir(dir, { recursive: true });
		const name = await safeFileName(dir, raw);
		const data = await readBody(req, MAX_UPLOAD);
		if (!data.length) throw new HttpError(400, "文件是空的");
		await fs.writeFile(path.join(dir, name), data);
		scheduleLqips(log);
		log(`gallery-admin: 上传 ${id}/${name}`);
		return send(res, 201, { ok: true, name });
	}

	// DELETE /albums/:id/photos/:file —— 从项目里删除图片；若它是封面则一并清掉封面设置
	if (parts[2] === "photos" && parts.length === 4 && method === "DELETE") {
		const file = parts[3];
		if (file !== path.basename(file) || !IMAGE_EXT.test(file)) throw new HttpError(400, "文件名不合法");
		await fs.rm(path.join(dir, file), { force: true });
		const coverPath = `/gallery/${id}/${file}`;
		if (albums[index].cover === coverPath) {
			delete albums[index].cover;
			await writeAlbums(albums);
		}
		scheduleLqips(log);
		log(`gallery-admin: 删除 ${id}/${file}`);
		return send(res, 200, { ok: true });
	}

	throw new HttpError(405, "不支持的操作");
}

function isLoopback(req: IncomingMessage): boolean {
	const addr = req.socket.remoteAddress ?? "";
	return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

export default function galleryAdmin(): AstroIntegration {
	return {
		name: "gallery-admin",
		hooks: {
			"astro:server:setup": ({ server, logger }) => {
				const log = (msg: string) => logger.info(msg);
				server.middlewares.use(async (req, res, next) => {
					const url = req.url ?? "";
					if (!url.startsWith(PREFIX)) return next();
					if (!isLoopback(req)) {
						res.statusCode = 403;
						res.end("gallery admin is only available on localhost");
						return;
					}
					const route = url.slice(PREFIX.length).split("?")[0];
					try {
						if (route === "" || route === "/") {
							res.setHeader("Content-Type", "text/html; charset=utf-8");
							res.end(await fs.readFile(PAGE_FILE, "utf-8"));
							return;
						}
						if (route.startsWith("/api/")) {
							await handleApi(req, res, route.slice(4), log);
							return;
						}
						send(res, 404, { error: "未知页面" });
					} catch (err) {
						const status = err instanceof HttpError ? err.status : 500;
						const message = err instanceof Error ? err.message : String(err);
						if (status === 500) logger.error(`gallery-admin: ${message}`);
						send(res, status, { error: message });
					}
				});
				logger.info(`相册管理后台：在开发服务器地址后加 ${PREFIX} 打开`);
			},
		},
	};
}
