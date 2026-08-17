/**
 * stock-video-bg.ts（性能优化版）
 *
 * 首屏自动播放视频背景逻辑：
 *   · 视频 ready 后淡入，否则保持降级光斑网格
 *   · 切 tab 暂停 / 继续（省解码）
 *   · 弱网 / 移动端 / saveData 模式：跳过视频，直接降级，节省带宽和解码压力
 *   · HUD 时钟：仅页面可见时更新 tick，hidden 不碰 DOM
 */

const wrap = document.querySelector<HTMLElement>(".stock-video-bg");
if (!wrap) {
	export {};
} else {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const isMobile = window.matchMedia("(max-width: 640px)").matches;
	// @ts-expect-error - navigator.connection 非标准但广泛支持
	const conn = navigator.connection as any;
	const saveData = Boolean(conn?.saveData);
	const slowNet = conn && ["slow-2g", "2g", "3g"].includes(conn.effectiveType);
	const skipVideo = reduceMotion || isMobile || saveData || slowNet;

	/* -------- HUD 时钟（页面不可见时停更，避免每 1s 强制回流） -------- */
	const clockEl = document.getElementById("svb-clock");
	if (clockEl) {
		const pad = (n: number) => n.toString().padStart(2, "0");
		const tick = () => {
			if (document.hidden) return;
			const d = new Date();
			clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
		};
		tick();
		setInterval(tick, 1000);
	}

	/* -------- 视频控制 -------- */
	const video = wrap.querySelector<HTMLVideoElement>(".svb-video");

	const onReady = () => {
		video?.classList.add("is-ready");
	};
	const onError = () => {
		video?.classList.remove("is-ready");
	};

	if (video && !skipVideo && video.src) {
		// 页面 load 前只预拉元数据，不抢首屏关键资源带宽
		video.preload = "metadata";
		const promoteToAuto = () => {
			if (!video.isConnected) return;
			video.preload = "auto";
			const p = video.play();
			// 自动播放被策略阻止时（例如用户未交互），静默失败保持降级
			if (p && typeof p.catch === "function") p.catch(() => onError());
		};

		const run = () => {
			if (document.readyState === "complete") promoteToAuto();
			else window.addEventListener("load", promoteToAuto, { once: true });
		};

		if (video.readyState >= 3) {
			onReady();
			run();
		} else {
			video.addEventListener("loadeddata", onReady, { once: true });
			video.addEventListener("canplay", () => {
				onReady();
				run();
			}, { once: true });
		}
		video.addEventListener("error", onError);

		// 切 tab：暂停 / 恢复
		document.addEventListener("visibilitychange", () => {
			if (!video.classList.contains("is-ready")) return;
			if (document.hidden) {
				video.pause().catch(() => {});
			} else {
				video.play().catch(() => {});
			}
		});

		// 8s 兜底仍未 ready → 降级
		setTimeout(() => {
			if (!video.classList.contains("is-ready")) onError();
		}, 8000);
	} else if (skipVideo) {
		// 主动降级：保持光斑/网格背景，不尝试加载视频
		if (video) {
			// 移除 src 取消任何挂起的网络请求
			video.removeAttribute("src");
			video.load();
		}
		onError();
	}
}

export {};
