// 跨布局的 swup 换页
//
// 首页 / 音乐页 / 书架页没有普通页面那几个 swup 容器（#swup-container、侧栏等），
// 以前和它们互相跳转只能整页刷新，全站播放器随之被销毁，音乐从头开始。
//
// 现在每种布局都把「导航栏以外的整页内容」包在 #swup-page 里：跳转涉及这几个页面时，
// 把本次 visit 的容器换成 #swup-page，整块替换页面内容；导航栏、全站播放器
// （MusicManager 挂在 body 上的 <audio>）和 Layout 里的常驻部件都不动，音乐不中断。
// 普通页面之间仍走原来的多容器替换，过渡动画不变。

export const PAGE_CONTAINER = "#swup-page";

// 与普通页面布局不同的独立页（路径都带结尾斜杠，trailingSlash: "always"）
const STANDALONE_PAGE = /^\/(?:$|music\/|books\/)/;

function isStandalone(url: string): boolean {
	try {
		return STANDALONE_PAGE.test(new URL(url, window.location.origin).pathname);
	} catch {
		return false;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: swup 实例来自 @swup/astro 注入的全局变量，没有类型
export function setupPageSwap(swup: any): void {
	// 优先级要高于其他 visit:start 回调，让它们拿到的 visit.containers 已是最终值
	swup.hooks.on(
		"visit:start",
		(visit: {
			from: { url: string };
			to: { url: string };
			containers: string[];
		}) => {
			if (isStandalone(visit.from.url) || isStandalone(visit.to.url)) {
				visit.containers = [PAGE_CONTAINER];
			}
		},
		{ priority: -2 },
	);
}
