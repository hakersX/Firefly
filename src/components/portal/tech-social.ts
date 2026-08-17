/**
 * tech-social.ts — 社交卡片点击涟漪（被动监听）
 */

document.querySelectorAll<HTMLAnchorElement>(".ts-btn[data-ripple]").forEach((btn) => {
	btn.addEventListener(
		"click",
		(ev) => {
			const e = ev as MouseEvent;
			const rect = btn.getBoundingClientRect();
			const r = document.createElement("span");
			r.className = "ts-social-ripple";
			const size = Math.max(rect.width, rect.height);
			r.style.width = size + "px";
			r.style.height = size + "px";
			r.style.left = e.clientX - rect.left + "px";
			r.style.top = e.clientY - rect.top + "px";
			btn.appendChild(r);
			setTimeout(() => r.remove(), 700);
		},
		{ passive: true },
	);
});

export {};
