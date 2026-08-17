/**
 * tech-chips.ts — 芯片点击涟漪（被动监听，不阻塞主线程）
 */

document.querySelectorAll<HTMLAnchorElement>(".tc-chip[data-ripple]").forEach((chip) => {
	chip.addEventListener(
		"click",
		(ev) => {
			const e = ev as MouseEvent;
			const rect = chip.getBoundingClientRect();
			const r = document.createElement("span");
			r.className = "tc-ripple";
			const size = Math.max(rect.width, rect.height);
			r.style.width = size + "px";
			r.style.height = size + "px";
			r.style.left = e.clientX - rect.left + "px";
			r.style.top = e.clientY - rect.top + "px";
			chip.appendChild(r);
			setTimeout(() => r.remove(), 700);
		},
		{ passive: true },
	);
});

export {};
