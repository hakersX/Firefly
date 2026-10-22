/**
 * 相册页动效（GSAP）
 *
 * - 相册列表：卡片一张接一张浮起落定，左右微微反向倾斜
 * - 相册详情：横幅里的相片「甩」进来；照片滚动到视野里时才依次淡入浮现
 *
 * 相册页经 swup 多次进出，而本模块只执行一次：每次 swup:page:view 检查页面上是否有
 * [data-gallery-motion]，有就挂一份动画，离开时 revert 掉并断开 IntersectionObserver。
 * 系统开启「减少动态效果」时整套跳过。
 */
import { gsap } from "gsap";

let ctx: gsap.Context | null = null;
let observer: IntersectionObserver | null = null;

function animate(root: HTMLElement): void {
	const cards = gsap.utils.toArray<HTMLElement>(".album-card", root);
	if (cards.length) {
		gsap.from(cards, {
			autoAlpha: 0,
			y: 48,
			rotate: (i: number) => (i % 2 ? 4 : -4),
			duration: 0.9,
			stagger: 0.12,
			ease: "power3.out",
			clearProps: "transform,opacity,visibility",
		});
	}

	const hero = root.querySelector(".album-hero-print");
	if (hero) {
		gsap.from(hero, {
			autoAlpha: 0,
			y: 30,
			rotate: -14,
			duration: 1,
			ease: "back.out(1.4)",
			// 结束后交还给 CSS（相片本身的 -4° 倾斜和悬停摆正都写在样式里）
			clearProps: "transform,opacity,visibility",
		});
		gsap.from(".album-hero-text > *", {
			autoAlpha: 0,
			x: 24,
			duration: 0.7,
			stagger: 0.08,
			delay: 0.2,
			ease: "power3.out",
			clearProps: "transform,opacity,visibility",
		});
	}

	const photos = gsap.utils.toArray<HTMLElement>(".gallery-photo-card", root);
	if (photos.length) {
		gsap.set(photos, { autoAlpha: 0, y: 36, scale: 0.96 });
		observer = new IntersectionObserver(
			(entries) => {
				const shown = entries
					.filter((e) => e.isIntersecting)
					.map((e) => e.target);
				if (!shown.length) return;
				for (const el of shown) observer?.unobserve(el);
				gsap.to(shown, {
					autoAlpha: 1,
					y: 0,
					scale: 1,
					duration: 0.8,
					stagger: 0.09,
					ease: "power3.out",
					clearProps: "transform,opacity,visibility",
				});
			},
			{ rootMargin: "0px 0px -6% 0px" },
		);
		for (const p of photos) observer.observe(p);
	}
}

function sync(): void {
	const root = document.querySelector<HTMLElement>("[data-gallery-motion]");
	if (root?.dataset.motionMounted === "1") return;
	ctx?.revert();
	ctx = null;
	observer?.disconnect();
	observer = null;
	if (!root) return;
	root.dataset.motionMounted = "1";
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	ctx = gsap.context(() => animate(root), root);
}

sync();
document.addEventListener("swup:page:view", sync);
