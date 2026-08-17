/**
 * tech-stats.ts（性能优化版）
 *
 *   - 滚动到视口 → 数字从 0 递增动画到 target + 底部进度条填充
 *   - prefers-reduced-motion → 直接显示最终值，不跑 rAF 循环
 *   - 进度条每帧只改一次 transform（scaleX）代替 width，走 GPU 合成
 *   - 点击涟漪：passive 监听
 *   - Swup 导航后重新初始化
 */

function initTechStats() {
	const section = document.querySelector<HTMLElement>(".tech-stats");
	if (!section || section.dataset.bound) return;
	section.dataset.bound = "1";

	const cards = Array.from(section.querySelectorAll<HTMLElement>(".ts-card"));
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const animate = (card: HTMLElement) => {
		const target = Number(card.dataset.target || "0");
		const numEl = card.querySelector<HTMLElement>(".ts-num-chars");
		const bar = card.querySelector<HTMLElement>(".ts-bar-fill");
		if (!numEl || !bar) return;

		// 进度条用 scaleX（transform）代替 width：避免每帧 reflow
		bar.style.transformOrigin = "0 50%";
		bar.style.width = "100%";

		if (reduceMotion || target <= 0) {
			numEl.textContent = String(target);
			bar.style.transform = `scaleX(${Math.min(1, target > 0 ? 0.35 + 0.65 * (target / Math.max(1, target)) : 0)})`;
			return;
		}

		const DURATION = 1400;
		const start = performance.now();
		const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

		const frame = (now: number) => {
			const t = Math.min(1, (now - start) / DURATION);
			const val = Math.round(target * easeOut(t));
			numEl.textContent = String(val);
			const progress = target > 0 ? 0.35 + 0.65 * (val / Math.max(1, target)) : 0;
			bar.style.transform = `scaleX(${Math.min(1, progress)})`;
			if (t < 1) requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	};

	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					animate(e.target as HTMLElement);
					io.unobserve(e.target);
				}
			}
		},
		{ threshold: 0.2 },
	);
	cards.forEach((c) => io.observe(c));

	/* 点击涟漪（被动监听，不阻塞主线程） */
	cards.forEach((card) => {
		if (!(card instanceof HTMLAnchorElement)) return;
		card.addEventListener(
			"click",
			(ev) => {
				const e = ev as MouseEvent;
				const rect = card.getBoundingClientRect();
				const r = document.createElement("span");
				r.className = "ts-ripple";
				const size = Math.max(rect.width, rect.height);
				r.style.width = size + "px";
				r.style.height = size + "px";
				r.style.left = e.clientX - rect.left + "px";
				r.style.top = e.clientY - rect.top + "px";
				card.appendChild(r);
				setTimeout(() => r.remove(), 800);
			},
			{ passive: true },
		);
	});
}

initTechStats();
document.addEventListener("swup:contentReplaced", initTechStats);

export {};
