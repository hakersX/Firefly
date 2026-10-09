// swup 换页后的脚本重跑
//
// @swup/scripts-plugin 会在每次换页后把整页（head + body）所有脚本重跑一遍，
// 包括 swup 容器之外、DOM 根本没换的常驻部件（音乐播放器、日历、导航栏、
// 图片 referrer 兜底等）。这些脚本重跑既浪费主线程，又会每次多挂一份
// document 级监听 / MutationObserver，越逛越卡。
//
// 这里只重跑真正换了新 DOM 的部分：
//   - swup 容器内的脚本（随新内容一起到来，必须执行才能初始化）
//   - head 插件本次新插入的 head 脚本（页面通过 slot="head" 带来的脚本）
// 容器外的常驻脚本只在首次整页加载时执行一次；需要感知换页的，
// 自行监听 swup 的 page:view（DOM 事件 swup:page:view 或 astro:page-load）。
//
// 整页替换（#swup-page，见 swup-page-swap.ts）时容器里的一切都是新 DOM，
// 连标了 data-swup-ignore-script 的「只跑一次」脚本也要重跑，否则它们管的新元素没人初始化。

import { PAGE_CONTAINER } from "./swup-page-swap";

const JS_TYPES = new Set([
	"",
	"text/javascript",
	"application/javascript",
	"module",
]);

function isExecutable(script: HTMLScriptElement, wholePage: boolean): boolean {
	if (!wholePage && script.hasAttribute("data-swup-ignore-script")) return false;
	return JS_TYPES.has((script.getAttribute("type") ?? "").trim().toLowerCase());
}

// 换一个新建的 <script> 节点进去，浏览器才会执行它（与 scripts-plugin 相同的做法）
function rerun(script: HTMLScriptElement): void {
	const fresh = document.createElement("script");
	for (const { name, value } of script.attributes) {
		fresh.setAttribute(name, value);
	}
	fresh.textContent = script.textContent;
	script.replaceWith(fresh);
}

// biome-ignore lint/suspicious/noExplicitAny: swup 实例来自 @swup/astro 注入的全局变量，没有类型
export function setupContainerScripts(swup: any): void {
	let headBefore = new Set<Element>();

	// head 插件挂在 before content:replace 上；优先级更低的先跑，在它改 head 之前拍快照
	swup.hooks.before(
		"content:replace",
		() => {
			headBefore = new Set(document.head.querySelectorAll("script"));
		},
		{ priority: -1 },
	);

	// 先于各组件的 content:replace 回调执行，保证它们拿到的是已初始化的新内容
	swup.hooks.on(
		"content:replace",
		(visit: { containers: string[] }) => {
			const scripts: HTMLScriptElement[] = [];
			for (const script of document.head.querySelectorAll("script")) {
				if (!headBefore.has(script)) scripts.push(script);
			}
			for (const selector of visit.containers) {
				for (const container of document.querySelectorAll(selector)) {
					scripts.push(...container.querySelectorAll("script"));
				}
			}
			headBefore = new Set();
			const wholePage = visit.containers.includes(PAGE_CONTAINER);
			for (const script of scripts) {
				if (isExecutable(script, wholePage)) rerun(script);
			}
		},
		{ priority: -1 },
	);
}
