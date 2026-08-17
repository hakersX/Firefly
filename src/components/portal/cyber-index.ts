/**
 * cyber-index.ts — 首页通用（性能优化版）
 *   · 给所有 .reveal 元素加 IntersectionObserver，进入视口触发入场
 *   · 延迟到 DOMContentLoaded 之后再 observe，不抢占首帧关键渲染时间
 *   · 用户 prefers-reduced-motion → 直接显示，不做动画
 *   · Swup 导航后重新初始化
 */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const initReveal = () => {
	const reveals = Array.from(
		document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"),
	);
	if (reveals.length === 0) return;

	if (reduceMotion) {
		// 立即显示，不注册 IO，不做过渡
		reveals.forEach((el) => el.classList.add("is-visible"));
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					e.target.classList.add("is-visible");
					io.unobserve(e.target);
				}
			}
		},
		{ threshold: 0.08, rootMargin: "0px 0px -10% 0px" },
	);
	reveals.forEach((el) => io.observe(el));
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initReveal, { once: true });
} else {
	initReveal();
}
// Swup 导航后重新初始化
document.addEventListener("swup:contentReplaced", initReveal);

export {};
