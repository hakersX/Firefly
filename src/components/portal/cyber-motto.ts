/**
 * cyber-motto.ts
 *
 * 首屏文字层交互（性能优化版）
 *   - CTA 按钮点击涟漪
 *   - 名字层 RGB glitch：仅在 motto 处于视口内 + 页面可见时跑
 *   - 桌面端 mousemove 3D 视差：被动监听 + 节流（rAF 内最多每帧一次）
 */

const motto = document.querySelector<HTMLElement>("#cyber-motto");

if (motto) {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const isFinePointer = window.matchMedia("(pointer: fine)").matches;

	/* -------- 涟漪（仅点击时创建，无持续性开销） -------- */
	motto.querySelectorAll<HTMLElement>("[data-ripple]").forEach((btn) => {
		btn.addEventListener(
			"click",
			(ev) => {
				const e = ev as MouseEvent;
				const rect = btn.getBoundingClientRect();
				const r = document.createElement("span");
				r.className = "cm-ripple";
				const size = Math.max(rect.width, rect.height);
				r.style.width = size + "px";
				r.style.height = size + "px";
				r.style.left = e.clientX - rect.left + "px";
				r.style.top = e.clientY - rect.top + "px";
				btn.appendChild(r);
				setTimeout(() => r.remove(), 800);
			},
			{ passive: true },
		);
	});

	/* -------- 自动 RGB glitch：离开视口 / 切后台立即暂停，避免空耗 -------- */
	const name = motto.querySelector<HTMLElement>(".cm-name")!;
	if (name && !reduceMotion) {
		let glitchTimer: number | undefined;
		let running = false;

		const scheduleNext = () => {
			// 5~10s 随机间隔
			glitchTimer = window.setTimeout(trigger, 5000 + Math.random() * 5000);
		};

		function trigger() {
			if (!running) return;
			name.classList.add("is-glitching");
			setTimeout(() => name.classList.remove("is-glitching"), 1600);
			scheduleNext();
		}

		const start = () => {
			if (running) return;
			running = true;
			if (glitchTimer) {
				clearTimeout(glitchTimer);
				glitchTimer = undefined;
			}
			scheduleNext();
		};
		const stop = () => {
			running = false;
			if (glitchTimer) {
				clearTimeout(glitchTimer);
				glitchTimer = undefined;
			}
			name.classList.remove("is-glitching");
		};

		// 视口内才启动
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					e.isIntersecting ? start() : stop();
				}
			},
			{ threshold: 0.25 },
		);
		io.observe(name);

		// 切后台 / 切 tab 也停
		document.addEventListener("visibilitychange", () => {
			if (document.hidden) stop();
			else if (io.takeRecords().every((r) => r.isIntersecting) || document.visibilityState === "visible") {
				// 回到前台时，若 motto 还在视口内则继续（交给 io 回调更准，这里兜底触发一次 IO 检查）
				io.observe(name);
			}
		});

		// 初次延迟启动，避免跟其他首屏动画抢主线程
		setTimeout(start, 4500);
	}

	/* -------- 轻量视差：被动监听 + rAF 节流，仅桌面精细指针 -------- */
	if (isFinePointer && !reduceMotion) {
		const nm = motto.querySelector<HTMLElement>(".cm-name") as HTMLElement | null;
		const slo = motto.querySelector<HTMLElement>(".cm-slogan") as HTMLElement | null;
		const cta = motto.querySelector<HTMLElement>(".cm-cta") as HTMLElement | null;

		if (nm) {
			let raf = 0;
			let lastT = 0;
			let pendingPx = 0;
			let pendingPy = 0;
			let hasPending = false;

			const apply = () => {
				raf = 0;
				hasPending = false;
				nm.style.transform = `translate3d(${pendingPx * -16}px, ${pendingPy * -22}px, 0)`;
				if (slo) slo.style.transform = `translate3d(${pendingPx * -6}px, ${pendingPy * -6}px, 0)`;
				if (cta) cta.style.transform = `translate3d(${pendingPx * -5}px, ${pendingPy * -4}px, 0)`;
			};

			motto.addEventListener(
				"mousemove",
				(ev) => {
					const e = ev as MouseEvent;
					const now = performance.now();
					// 每 8ms 接收一次新值（约 120fps 上限），避免事件洪水
					if (now - lastT < 8 && hasPending) return;
					lastT = now;
					const rect = motto.getBoundingClientRect();
					pendingPx = (e.clientX - rect.left) / rect.width - 0.5;
					pendingPy = (e.clientY - rect.top) / rect.height - 0.5;
					hasPending = true;
					if (!raf) raf = requestAnimationFrame(apply);
				},
				{ passive: true },
			);

			motto.addEventListener(
				"mouseleave",
				() => {
					if (raf) cancelAnimationFrame(raf);
					raf = 0;
					hasPending = false;
					nm.style.transition = "transform 0.7s cubic-bezier(0.22,1,0.36,1)";
					nm.style.transform = "translate3d(0,0,0)";
					if (slo) {
						slo.style.transition = nm.style.transition;
						slo.style.transform = "translate3d(0,0,0)";
					}
					if (cta) {
						cta.style.transition = nm.style.transition;
						cta.style.transform = "translate3d(0,0,0)";
					}
					setTimeout(() => {
						nm.style.transition = "";
						if (slo) slo.style.transition = "";
						if (cta) cta.style.transition = "";
					}, 750);
				},
				{ passive: true },
			);
		}
	}
}

export {};
