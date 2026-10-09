// 字体 @font-face 外置构建后脚本
// Astro 的 <Font /> 把 @font-face 规则直接内联进每个页面的 <head>。中文字体按
// unicode-range 切成上百个分片，光这一段就有约 280KB，每个页面都背着一份：
// 首次访问之后的每次站内跳转（swup 用 fetch 拉整页 HTML）都要重新下载、解析它。
// 这里把这些内联块合并成一个带内容哈希的 CSS 文件，HTML 里换成 <link>，
// 浏览器只下载一次，之后走 /_astro/* 的长期缓存。

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const DIST_DIR = "dist";
const OUTPUT_DIR = "dist/_astro/fonts";
const PUBLIC_PREFIX = "/_astro/fonts";

// <Font /> 产出的块总是以 @font-face 开头（结尾附带一段 :root 字体变量）
const FONT_STYLE_RE = /<style>(@font-face\{[\s\S]*?)<\/style>/g;

async function main() {
	console.log("🔤 Extracting inline @font-face CSS in dist/...");

	const htmlFiles = await glob(`${DIST_DIR}/**/*.html`);
	const written = new Set<string>();
	let pages = 0;
	let savedBytes = 0;

	for (const file of htmlFiles) {
		const html = await fs.readFile(file, "utf-8");
		const blocks = [...html.matchAll(FONT_STYLE_RE)];
		if (blocks.length === 0) continue;

		const css = blocks.map((m) => m[1]).join("\n");
		const hash = crypto
			.createHash("sha256")
			.update(css)
			.digest("hex")
			.slice(0, 16);
		const fileName = `fonts.${hash}.css`;

		if (!written.has(fileName)) {
			await fs.mkdir(OUTPUT_DIR, { recursive: true });
			await fs.writeFile(path.join(OUTPUT_DIR, fileName), css);
			written.add(fileName);
		}

		// 第一个块换成 <link>（保持在 <head> 里原来的位置），其余块直接去掉
		let first = true;
		const result = html.replace(FONT_STYLE_RE, () => {
			if (!first) return "";
			first = false;
			return `<link rel="stylesheet" href="${PUBLIC_PREFIX}/${fileName}">`;
		});

		await fs.writeFile(file, result);
		pages++;
		savedBytes += Buffer.byteLength(html) - Buffer.byteLength(result);
	}

	console.log(
		`   ✓ ${pages} pages → ${written.size} stylesheet(s), ${(savedBytes / 1024 / 1024).toFixed(1)} MiB removed from HTML`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
