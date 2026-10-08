/* 本地博客管理后台：文章 / 日记 的列表、新建、编辑、删除 + 真实站点预览
 * 用法：pnpm admin   →   http://localhost:4399
 * 仅监听 127.0.0.1，不会随站点构建发布。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { pinyin } from "pinyin-pro";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const POSTS_DIR = path.join(ROOT, "src/content/posts");
const DYNAMIC_DIR = path.join(ROOT, "src/content/dynamic");
const TRASH_DIR = path.join(ROOT, ".trash");
const IMAGES_DIR = path.join(POSTS_DIR, "images");
const DYNAMIC_IMG_DIR = path.join(ROOT, "public/assets/images/dynamic");
const AUDIO_DIR = path.join(ROOT, "public/assets/audio");
const PORT = Number(process.env.ADMIN_PORT) || 4399;
const DEV_PORT = Number(process.env.DEV_PORT) || 4321;
const EXT_RE = /\.(md|mdx)$/i;

// 表单里有专门控件的字段，按这个顺序写回；其余字段原样保留
const KNOWN_KEYS = [
	"title",
	"published",
	"updated",
	"description",
	"image",
	"tags",
	"category",
	"draft",
	"pinned",
	"lang",
	"slug",
	"author",
	"comment",
	"password",
	"passwordHint",
	"series",
	"chapter",
	"typography",
];

function httpError(status, message) {
	return Object.assign(new Error(message), { status });
}

// kind: "posts"（文章）| "dynamic"（日记）
const baseDir = (kind) => (kind === "dynamic" ? DYNAMIC_DIR : POSTS_DIR);

function resolvePost(rel, kind = "posts") {
	if (typeof rel !== "string" || !EXT_RE.test(rel))
		throw httpError(400, "非法文件名");
	const base = baseDir(kind);
	const full = path.resolve(base, rel);
	if (!full.startsWith(base + path.sep)) throw httpError(400, "路径越界");
	return full;
}

function walk(dir) {
	const out = [];
	if (!fs.existsSync(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p));
		else if (EXT_RE.test(e.name)) out.push(p);
	}
	return out;
}

function fmtDate(v) {
	if (v instanceof Date) {
		const iso = v.toISOString();
		return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
	}
	return v ?? "";
}

function readPost(full) {
	const parsed = matter(fs.readFileSync(full, "utf8"));
	const data = {};
	for (const [k, v] of Object.entries(parsed.data)) data[k] = fmtDate(v);
	return { data, content: parsed.content };
}

function yamlValue(v) {
	if (Array.isArray(v)) return `[${v.map(yamlValue).join(", ")}]`;
	if (v && typeof v === "object") return JSON.stringify(v);
	if (typeof v === "boolean" || typeof v === "number") return String(v);
	return `'${String(v).replace(/'/g, "''")}'`;
}

function serialize(data, content) {
	const keys = [
		...KNOWN_KEYS.filter((k) => k in data),
		...Object.keys(data).filter((k) => !KNOWN_KEYS.includes(k)),
	];
	const lines = [];
	for (const k of keys) {
		const v = data[k];
		if (v === undefined || v === null) continue;
		// 日期写成无引号的 YYYY-MM-DD / ISO，保证 z.date() 能解析
		if ((k === "published" || k === "updated") && v) lines.push(`${k}: ${v}`);
		else lines.push(`${k}: ${yamlValue(v)}`);
	}
	return `---\n${lines.join("\n")}\n---\n\n${content.replace(/^(\r?\n)+/, "")}`;
}

/* ---------- 日记 ----------
 * frontmatter 只有 published / pinned / location，手写解析，
 * 让 "2026-07-28 07:11:27" 这种时间格式原样保留（YAML 库会把它转成 Date）。
 */
function readDynamic(full) {
	const raw = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!m) return { data: { published: "" }, content: raw };
	const data = {};
	for (const line of m[1].split("\n")) {
		const kv = line.match(/^([\w-]+):\s*(.*)$/);
		if (!kv) continue;
		const v = kv[2].trim().replace(/^(['"])(.*)\1$/, "$2");
		data[kv[1]] = kv[1] === "pinned" ? v === "true" : v;
	}
	return { data, content: m[2].replace(/^\n+/, "") };
}

function serializeDynamic(data, content) {
	const lines = [`published: ${data.published}`];
	if (data.pinned) lines.push("pinned: true");
	if (data.location) lines.push(`location: ${data.location}`);
	for (const [k, v] of Object.entries(data)) {
		if (["published", "pinned", "location"].includes(k)) continue;
		if (v === "" || v == null) continue;
		lines.push(`${k}: ${v}`);
	}
	const body = content.replace(/^\n+/, "").replace(/\s+$/, "");
	return `---\n${lines.join("\n")}\n---\n\n${body}\n`;
}

function listDynamic() {
	return walk(DYNAMIC_DIR)
		.map((full) => {
			const rel = path.relative(DYNAMIC_DIR, full).split(path.sep).join("/");
			const { data, content } = readDynamic(full);
			const text = content
				.replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]")
				.replace(/\s+/g, " ")
				.trim();
			return {
				path: rel,
				title: text.slice(0, 40) || rel,
				published: data.published || "",
				draft: false,
				pinned: !!data.pinned,
				category: data.location || "",
			};
		})
		.sort((a, b) => String(b.published).localeCompare(String(a.published)));
}

function slugify(name) {
	const base = name.replace(EXT_RE, "").replace(/\/index$/, "");
	return base
		.split("/")
		.map((seg) =>
			[...seg]
				.map((ch) =>
					/[一-鿿]/.test(ch)
						? `-${pinyin(ch, { toneType: "none", type: "array" })[0]}-`
						: ch,
				)
				.join("")
				.toLowerCase()
				.replace(/[^a-z0-9_-]+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, ""),
		)
		.join("/");
}

function listPosts(kind = "posts") {
	if (kind === "dynamic") return listDynamic();
	return walk(POSTS_DIR)
		.map((full) => {
			const rel = path.relative(POSTS_DIR, full).split(path.sep).join("/");
			const fallbackSlug = rel.replace(EXT_RE, "");
			try {
				const { data } = readPost(full);
				return {
					path: rel,
					title: data.title || rel,
					published: data.published || "",
					draft: !!data.draft,
					pinned: !!data.pinned,
					category: data.category || "",
					slug: data.slug || fallbackSlug,
				};
			} catch {
				return {
					path: rel,
					title: `⚠ ${rel}（frontmatter 解析失败）`,
					published: "",
					draft: false,
					pinned: false,
					category: "",
					slug: fallbackSlug,
				};
			}
		})
		.sort((a, b) => String(b.published).localeCompare(String(a.published)));
}

async function readBody(req, limit = 30 * 1024 * 1024) {
	const chunks = [];
	let size = 0;
	for await (const c of req) {
		size += c.length;
		if (size > limit) throw httpError(413, "请求体过大");
		chunks.push(c);
	}
	return Buffer.concat(chunks);
}

function json(res, status, obj) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(obj));
}

async function handleApi(req, res, url) {
	const q = url.searchParams;
	const route = `${req.method} ${url.pathname}`;
	const kind = q.get("kind") === "dynamic" ? "dynamic" : "posts";

	if (route === "GET /api/config") return json(res, 200, { devPort: DEV_PORT });
	if (route === "GET /api/posts") return json(res, 200, listPosts(kind));
	if (route === "GET /api/slugify")
		return json(res, 200, { slug: slugify(q.get("name") || "") });

	if (route === "GET /api/post") {
		const full = resolvePost(q.get("path"), kind);
		if (!fs.existsSync(full)) throw httpError(404, "文章不存在");
		return json(
			res,
			200,
			kind === "dynamic" ? readDynamic(full) : readPost(full),
		);
	}

	if (route === "PUT /api/post") {
		const full = resolvePost(q.get("path"), kind);
		const isNew = q.get("create") === "1";
		if (isNew && fs.existsSync(full)) throw httpError(409, "同名文件已存在");
		if (!isNew && !fs.existsSync(full)) throw httpError(404, "文章不存在");
		const { data, content } = JSON.parse((await readBody(req)).toString("utf8"));
		fs.mkdirSync(path.dirname(full), { recursive: true });
		if (kind === "dynamic") {
			if (!data?.published) throw httpError(400, "时间不能为空");
			if (!(content ?? "").trim()) throw httpError(400, "内容不能为空");
			fs.writeFileSync(full, serializeDynamic(data, content));
			return json(res, 200, { ok: true });
		}
		if (!data?.title) throw httpError(400, "标题不能为空");
		if (!data.published) throw httpError(400, "发布日期不能为空");
		fs.writeFileSync(full, serialize(data, content ?? ""));
		return json(res, 200, { ok: true });
	}

	if (route === "DELETE /api/post") {
		// 不直接删除：移到项目根目录 .trash/，误删可手动找回
		const full = resolvePost(q.get("path"), kind);
		if (!fs.existsSync(full)) throw httpError(404, "文章不存在");
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const dest = path.join(TRASH_DIR, `${stamp}__${path.basename(full)}`);
		fs.mkdirSync(TRASH_DIR, { recursive: true });
		fs.renameSync(full, dest);
		return json(res, 200, { ok: true, trashed: path.relative(ROOT, dest) });
	}

	if (route === "POST /api/upload") {
		const name = (q.get("name") || "image.png").replace(/[^\w.-]/g, "_");
		const isAudio = /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(name);
		if (!isAudio && !/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name))
			throw httpError(400, "仅支持图片或音频（mp3/m4a/wav/ogg/flac/aac）");
		const buf = await readBody(req, 100 * 1024 * 1024);
		// 音频统一放 public/assets/audio/，文章和日记都用站点绝对路径引用
		if (isAudio) {
			fs.mkdirSync(AUDIO_DIR, { recursive: true });
			let file = name;
			for (let i = 1; fs.existsSync(path.join(AUDIO_DIR, file)); i++)
				file = name.replace(/(\.[^.]+)$/, `-${i}$1`);
			fs.writeFileSync(path.join(AUDIO_DIR, file), buf);
			return json(res, 200, { url: `/assets/audio/${file}`, audio: true });
		}
		const imgDir = kind === "dynamic" ? DYNAMIC_IMG_DIR : IMAGES_DIR;
		fs.mkdirSync(imgDir, { recursive: true });
		let file = name;
		for (let i = 1; fs.existsSync(path.join(imgDir, file)); i++)
			file = name.replace(/(\.[^.]+)$/, `-${i}$1`);
		fs.writeFileSync(path.join(imgDir, file), buf);
		// 日记的图片放 public/，用站点绝对路径引用
		if (kind === "dynamic")
			return json(res, 200, { url: `/assets/images/dynamic/${file}` });
		const post = resolvePost(q.get("post") || "x.md");
		const rel = path
			.relative(path.dirname(post), path.join(imgDir, file))
			.split(path.sep)
			.join("/");
		return json(res, 200, { url: rel.startsWith(".") ? rel : `./${rel}` });
	}

	throw httpError(404, "未知接口");
}

const server = http.createServer(async (req, res) => {
	try {
		// 防 DNS rebinding / 跨站请求：只接受本机 Host，写操作要求同源
		const host = req.headers.host || "";
		if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`)
			throw httpError(403, "forbidden");
		if (req.method !== "GET") {
			const origin = req.headers.origin;
			if (!origin || origin !== `http://${host}`)
				throw httpError(403, "forbidden");
		}
		const url = new URL(req.url, `http://${host}`);
		if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
		if (url.pathname === "/" || url.pathname === "/index.html") {
			res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			return res.end(fs.readFileSync(path.join(HERE, "index.html")));
		}
		throw httpError(404, "not found");
	} catch (e) {
		json(res, e.status || 500, { error: e.message });
	}
});

function probe(port) {
	return new Promise((resolve) => {
		const s = net.connect(port, "127.0.0.1");
		s.once("connect", () => {
			s.destroy();
			resolve(true);
		});
		s.once("error", () => resolve(false));
	});
}

server.listen(PORT, "127.0.0.1", async () => {
	console.log(`\n  猫窝后台已启动：http://localhost:${PORT}\n`);
	if (!process.env.NO_DEV && !(await probe(DEV_PORT))) {
		console.log(`  未检测到 :${DEV_PORT} 的站点开发服务器，自动启动 astro dev ...\n`);
		const dev = spawn("npx", ["astro", "dev", "--port", String(DEV_PORT)], {
			cwd: ROOT,
			stdio: "inherit",
			shell: true,
		});
		const stop = () => dev.kill();
		process.on("exit", stop);
		process.on("SIGINT", () => {
			stop();
			process.exit();
		});
	}
});
