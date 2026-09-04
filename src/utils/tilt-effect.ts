/**
 * 卡片 3D Tilt 悬停特效（事件委托实现，Swup 换页后自动生效，无需重新绑定）
 *
 * 用法：给需要 tilt 的元素加 class `tilt-effect`，可选 `data-tilt-max` 自定义最大倾角。
 * 原理：document 级 mousemove 委托，向最近的 .tilt-effect 元素写入 CSS 变量
 *   --tilt-rx / --tilt-ry（旋转角）与 --glare-x / --glare-y（光泽位置），
 *   实际 transform 由 CSS（transition.css 中的 .tilt-effect 规则）完成。
 * 仅在精确指针设备生效；prefers-reduced-motion 下自动跳过。
 */

const DEFAULT_MAX_DEG = 6;

let activeCard: HTMLElement | null = null;

function resetCard(card: HTMLElement) {
	card.style.setProperty("--tilt-rx", "0deg");
	card.style.setProperty("--tilt-ry", "0deg");
}

function handleMove(e: MouseEvent) {
	const target = e.target as Element | null;
	// 委托查找：光标所在的（或最近祖先的）tilt 卡片
	const card = target?.closest?.(".tilt-effect") as HTMLElement | null;

	if (card !== activeCard) {
		if (activeCard) resetCard(activeCard);
		activeCard = card;
	}
	if (!card) return;

	const rect = card.getBoundingClientRect();
	// 相对卡片中心的偏移比例（-0.5 ~ 0.5）
	const ratioX = (e.clientX - rect.left) / rect.width - 0.5;
	const ratioY = (e.clientY - rect.top) / rect.height - 0.5;
	const maxDeg = Number(card.dataset.tiltMax) || DEFAULT_MAX_DEG;

	// 鼠标偏上 → 顶部向后压（rotateX 正）；鼠标偏右 → 右侧向后压（rotateY 正）
	const rx = -ratioY * maxDeg * 2;
	const ry = ratioX * maxDeg * 2;
	card.style.setProperty("--tilt-rx", `${rx.toFixed(2)}deg`);
	card.style.setProperty("--tilt-ry", `${ry.toFixed(2)}deg`);
	// 光泽跟随位置（供 ::after radial-gradient 使用）
	card.style.setProperty("--glare-x", `${((ratioX + 0.5) * 100).toFixed(1)}%`);
	card.style.setProperty("--glare-y", `${((ratioY + 0.5) * 100).toFixed(1)}%`);
}

function handleLeave() {
	if (activeCard) {
		resetCard(activeCard);
		activeCard = null;
	}
}

export function initTiltEffect() {
	if (
		typeof window === "undefined" ||
		!window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		return;
	}
	document.addEventListener("mousemove", handleMove, { passive: true });
	// 光标离开窗口时复位
	document.documentElement.addEventListener("mouseleave", handleLeave);
}
