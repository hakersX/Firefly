/**
 * 标题锚点 id：替代 rehype-slug，把中文转成拼音，保证 id 只含 ASCII。
 * 「人鱼的眼泪」→ #ren-yu-de-yan-lei，分享链接时不会被转码成一长串 %E4%BA%BA…
 * 已有 id 的标题保持不动；同一篇文章里重名的标题由 github-slugger 自动加 -1、-2。
 */
import GithubSlugger from "github-slugger";
import { pinyin } from "pinyin-pro";

const HEADING = /^h[1-6]$/;

function textOf(node) {
	if (node.type === "text") return node.value;
	return (node.children ?? []).map(textOf).join("");
}

function toAscii(text) {
	return pinyin(text, { toneType: "none", type: "array", nonZh: "consecutive" })
		.map((s) => s.trim())
		.filter(Boolean)
		.join(" ")
		.replace(/ü/g, "v") // 女 nü → nv，和拼音输入法的写法一致
		.replace(/[^\x20-\x7e]/g, "") // 日文、emoji 等转不了拼音的字符直接去掉
		.replace(/\s+/g, " ")
		.trim();
}

export default function rehypePinyinSlug() {
	return (tree) => {
		const slugger = new GithubSlugger();
		const walk = (node) => {
			if (node.type === "element" && HEADING.test(node.tagName)) {
				node.properties ??= {};
				if (!node.properties.id) {
					const slug = slugger.slug(toAscii(textOf(node)));
					node.properties.id = slug || slugger.slug("section");
				}
				return;
			}
			for (const child of node.children ?? []) walk(child);
		};
		walk(tree);
	};
}
