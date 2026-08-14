// 书架交互逻辑：点击卡片 → 翻书动画 → 加载 PDF；退出 → 合书动画回到书架
const init = (): void => {
	const grid = document.getElementById("shelf-grid");
	const overlay = document.getElementById("reader-overlay");
	const iframe = document.getElementById("reader-iframe") as HTMLIFrameElement | null;
	const closeBtn = document.getElementById("reader-close");

	if (!grid || !overlay || !iframe || !closeBtn) return;

	// 动画时长需与 book-shelf.css 中 .book-flip 的 transition 保持一致
	const ANIM_MS = 420;
	let isOpen = false;

	const openBook = (pdf: string, title: string) => {
		if (isOpen) return;
		isOpen = true;
		iframe.title = `阅读 ${title}`;
		overlay.classList.remove("is-closing");
		overlay.classList.add("is-open");
		overlay.setAttribute("aria-hidden", "false");
		document.body.style.overflow = "hidden";
		closeBtn.focus();
		// 翻书动画完成后再加载 PDF，避免动画期间 PDF 查看器初始化导致掉帧
		window.setTimeout(() => {
			iframe.src = pdf;
		}, ANIM_MS);
	};

	const closeBook = () => {
		if (!isOpen) return;
		isOpen = false;
		// 立即释放 PDF 查看器，避免合书动画期间继续占用渲染资源
		iframe.src = "about:blank";
		overlay.classList.remove("is-open");
		overlay.classList.add("is-closing");
		overlay.setAttribute("aria-hidden", "true");
		document.body.style.overflow = "";
		window.setTimeout(() => {
			overlay.classList.remove("is-closing");
		}, ANIM_MS);
	};

	grid.addEventListener("click", (event) => {
		const target = event.target as HTMLElement;
		const card = target.closest(".book-card") as HTMLElement | null;
		if (!card) return;
		const pdf = card.dataset.pdf;
		const title = card.dataset.title ?? "";
		if (pdf) openBook(pdf, title);
	});

	closeBtn.addEventListener("click", (event) => {
		const ripple = closeBtn.querySelector(".reader-close-ripple") as HTMLElement | null;
		if (ripple) {
			const rect = closeBtn.getBoundingClientRect();
			ripple.style.left = `${event.clientX - rect.left}px`;
			ripple.style.top = `${event.clientY - rect.top}px`;
			ripple.classList.remove("is-active");
			void ripple.offsetWidth;
			ripple.classList.add("is-active");
		}
		closeBook();
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && isOpen) closeBook();
	});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
	init();
}
