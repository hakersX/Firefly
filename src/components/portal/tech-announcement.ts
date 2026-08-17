/**
 * tech-announcement.ts — 右侧时钟更新
 */

const el = document.getElementById("ta-clock");
if (el) {
	const pad = (n: number) => n.toString().padStart(2, "0");
	const fmt = (d: Date) => {
		return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	};
	const tick = () => {
		el.textContent = fmt(new Date());
	};
	tick();
	setInterval(tick, 1000 * 30);
}

export {};
