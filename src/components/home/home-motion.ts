/**
 * 首页动效（GSAP）
 *
 * - 卡片依次浮现：公告条落下，便当卡片自上而下错落弹入
 * - 欢迎卡：名字逐字跳出，头像缓慢上下浮动
 * - 数字滚动：文章 / 分类 / 标签数、营业天数从 0 数上来
 * - 列表、相册缩略图、社交按钮在所属卡片出现后依次进场
 *
 * 首页经 swup 多次进出（swup-page-swap 整页替换），而本模块只执行一次：
 * 每次 swup:page:view 检查首页是否在文档里，在就挂一份动画，离开就 revert 掉（停掉无限循环的浮动）。
 * 卡片初始隐藏由 index.astro 里的内联脚本给 <html> 加 home-motion-pending 完成，避免内容先闪一下；
 * 这里设好 from 状态后再摘掉它。系统开启「减少动态效果」时整套跳过。
 */
import { gsap } from "gsap";

const PENDING = "home-motion-pending";
let ctx: gsap.Context | null = null;

function splitChars(el: HTMLElement): HTMLElement[] {
	const chars = [...(el.textContent ?? "")].map((c) => {
		const s = document.createElement("span");
		s.textContent = c;
		s.style.display = "inline-block";
		if (c === " ") s.style.whiteSpace = "pre";
		return s;
	});
	el.setAttribute("aria-label", el.textContent ?? "");
	el.replaceChildren(...chars);
	for (const s of chars) s.setAttribute("aria-hidden", "true");
	return chars;
}

// 只滚动元素里的第一个数字文本节点（营业天数后面还跟着 <small>天</small>）
function countUp(tl: gsap.core.Timeline, el: Element, at: number): void {
	const node = [...el.childNodes].find(
		(n) => n.nodeType === Node.TEXT_NODE && /\d/.test(n.textContent ?? ""),
	);
	const end = Number.parseInt(node?.textContent ?? "", 10);
	if (!node || !end) return;
	const counter = { v: 0 };
	node.textContent = "0";
	tl.to(
		counter,
		{
			v: end,
			duration: 1.4,
			ease: "power2.out",
			onUpdate: () => {
				node.textContent = String(Math.round(counter.v));
			},
		},
		at,
	);
}

function animate(page: HTMLElement): void {
	const cards = gsap.utils.toArray<HTMLElement>(".bento-grid > .b-card", page);
	// 卡片 CSS 里给 transform 配了 transition（悬停上浮），动画期间先关掉，否则每帧都被拖慢
	gsap.set(cards, { transition: "none" });

	const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
	tl.from(".bento-notice", { autoAlpha: 0, y: -18, duration: 0.5 }).from(
		cards,
		{
			autoAlpha: 0,
			y: 40,
			scale: 0.96,
			duration: 0.75,
			stagger: 0.07,
			clearProps: "transform,opacity,visibility,transition",
		},
		0.15,
	);

	const name = page.querySelector<HTMLElement>(".hero-name");
	if (name) {
		tl.from(
			splitChars(name),
			{
				yPercent: 120,
				rotate: 10,
				autoAlpha: 0,
				duration: 0.6,
				stagger: 0.05,
				ease: "back.out(2.2)",
			},
			0.45,
		);
	}
	tl.from(
		".hero-avatar",
		{ scale: 0.4, autoAlpha: 0, duration: 0.8, ease: "back.out(1.8)" },
		0.35,
	);
	tl.from(".hero-slogan", { autoAlpha: 0, y: 10, duration: 0.6 }, 0.85);

	for (const el of page.querySelectorAll(".hero-stats b")) countUp(tl, el, 0.6);
	const days = page.querySelector(".days-num");
	if (days) countUp(tl, days, 0.75);

	tl.from(
		".b-list li",
		{ autoAlpha: 0, x: -16, duration: 0.45, stagger: 0.06 },
		0.7,
	);
	tl.from(
		".diary-item",
		{ autoAlpha: 0, y: 12, duration: 0.45, stagger: 0.08 },
		0.8,
	);
	tl.from(
		".gallery-thumb",
		{ autoAlpha: 0, x: 30, duration: 0.5, stagger: 0.05 },
		0.95,
	);
	tl.from(
		".social-tile",
		{
			autoAlpha: 0,
			scale: 0.6,
			duration: 0.45,
			stagger: 0.05,
			ease: "back.out(2)",
		},
		1.1,
	);

	// 头像在进场结束后缓慢上下浮动
	gsap.to(".hero-avatar", {
		y: -6,
		duration: 2.4,
		ease: "sine.inOut",
		yoyo: true,
		repeat: -1,
		delay: tl.duration(),
	});
}

function sync(): void {
	const page = document.querySelector<HTMLElement>(".cat-home .bento-page");
	if (page?.dataset.motion === "1") return;
	ctx?.revert();
	ctx = null;
	if (!page) return;
	page.dataset.motion = "1";
	if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		ctx = gsap.context(() => animate(page), page);
	}
	document.documentElement.classList.remove(PENDING);
}

sync();
document.addEventListener("swup:page:view", sync);
