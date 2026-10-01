/* ========================================================================
 * 音乐页面沉浸式播放器 —— 接入全局 MusicManager
 * 不自建 audio 元素：播放由 window.__fireflyMusic（mgr）统一管理，
 * audio 挂在 body 上、swup 容器之外，跨页面切换不重建，音乐持续播放。
 * 导航栏面板 / 侧边栏 widget / 本页面共享同一播放状态。
 * ======================================================================*/

interface MgrTrack {
	name: string;
	artist: string;
	url: string;
	pic?: string;
	lrc?: string;
}
interface MgrLyric {
	time: number;
	text: string;
}
interface FireflyMusic {
	init(): void;
	getState(): {
		playlist: MgrTrack[];
		currentIndex: number;
		track: MgrTrack | null;
		isPlaying: boolean;
		playMode: number; // 0=list, 1=one, 2=random
		volume: number;
		isMuted: boolean;
		currentTime: number;
		duration: number;
		progress: number;
		currentTimeStr: string;
		durationStr: string;
		lyrics: MgrLyric[];
		currentLrcIndex: number;
		initialized: boolean;
		error: string | null;
	};
	togglePlay(): void;
	playNext(): void;
	playPrev(): void;
	cyclePlayMode(): void;
	seek(percent: number): void;
	seekToTime(time: number): void;
	playTrackByIndex(index: number): void;
	/** 当前音频频谱（0-255，256 bins）；分析器未就绪时返回 null。复用同一数组，同步读取 */
	getFreqData?(): Uint8Array | null;
}
interface Ripple {
	x: number;
	y: number;
	radius: number;
	maxRadius: number;
	alpha: number;
}

// —— 元素引用 ——
const root = document.querySelector(".music-page") as HTMLElement;
const mgr = (window as any).__fireflyMusic as FireflyMusic;

const $ = (id: string) => document.getElementById(id)!;
const coverImg = $("cover-img") as HTMLImageElement;
const stageCover = $("cover-stage") as HTMLElement;
const stageImg = $("stage-cover-img") as HTMLImageElement;
const songName = $("song-name");
const songArtist = $("song-artist");
const songName2 = $("song-name-2");
const bgLayer = $("bg-layer");
const lyricsContent = $("lyrics-content");
const lyricsPanel = $("lyrics-panel");
const tCur = $("t-cur");
const tDur = $("t-dur");
const dockSeek = $("dock-seek");
const dockCover = $("dock-cover");
const bPlay = $("b-play") as HTMLButtonElement;
const bPrev = $("b-prev") as HTMLButtonElement;
const bNext = $("b-next") as HTMLButtonElement;
const bMode = $("b-mode") as HTMLButtonElement;
const icoPlay = $("ico-play");
const icoPause = $("ico-pause");
const icoRepeat = $("ico-repeat");
const icoRepeatOne = $("ico-repeat-one");
const icoShuffle = $("ico-shuffle");
const timeline = $("timeline");
// 手机端歌单抽屉：列表按钮在药丸里，桌面端不显示
const bList = document.getElementById("b-list") as HTMLButtonElement | null;
const listBackdrop = document.getElementById("timeline-backdrop");
const canvas = $("visualizer") as HTMLCanvasElement;
let canvasCtx: CanvasRenderingContext2D | null = null;

// 状态
let playlist: MgrTrack[] = [];
let lyricEls: HTMLElement[] = [];
let lyricOffsets: number[] = [];
let activeLyricIdx = -1;
let isPlaying = false;
let dragging = false;
let frameCount = 0; // 用于 --beat 的帧节流
const ripples: Ripple[] = [];
const handlers: Record<string, EventListener> = {};

// 用户手动拖动状态：拖动后一段时间内不自动覆盖滚动位置
let lyricUserOffset: number | null = null;
let lyricResumeTimer: number | null = null;
let isDraggingLyrics = false;
let lyricDragStartY = 0;
let lyricDragStartTransform = 0;

let timelineUserScrolling = false;
let timelineResumeTimer: number | null = null;
let timelineProgrammaticScroll = false;

if (!mgr) {
	// MusicManager 未加载（极端情况），降级提示
	songName.textContent = "播放器未就绪";
	songArtist.textContent = "请刷新页面";
} else {
	// ===== 工具 =====
	function on(name: string, fn: (e: any) => void) {
		const h = fn as EventListener;
		handlers[name] = h;
		window.addEventListener(name, h);
	}

	// ===== UI 更新 =====
	function updateTrackUI(track: MgrTrack | null) {
		if (!track) return;
		songName.textContent = track.name;
		songName2.textContent = track.name;
		songArtist.textContent = track.artist;
		coverImg.src = track.pic ?? "";
		coverImg.alt = track.name;
		bgLayer.style.backgroundImage = track.pic ? `url(${track.pic})` : "";

		// 中央封面舞台：同步封面 + 3D 翻转过渡
		if (stageImg.src !== track.pic) {
			stageImg.src = track.pic ?? "";
			stageImg.alt = track.name;
		}
		if (stageCover) {
			stageCover.classList.remove("is-flipping");
			void (stageCover as HTMLElement).offsetWidth; // 强制 reflow 重启动画
			stageCover.classList.add("is-flipping");
			window.setTimeout(() => stageCover.classList.remove("is-flipping"), 800);
		}
	}

	function updatePlayStateUI(playing: boolean) {
		isPlaying = playing;
		icoPlay.style.display = playing ? "none" : "inline-flex";
		icoPause.style.display = playing ? "inline-flex" : "none";
		dockCover.classList.toggle("is-playing", playing);
	}

	function updateModeUI(mode: number) {
		// 0=list, 1=one, 2=random
		icoRepeat.style.display = mode === 0 ? "inline-flex" : "none";
		icoRepeatOne.style.display = mode === 1 ? "inline-flex" : "none";
		icoShuffle.style.display = mode === 2 ? "inline-flex" : "none";
		bMode.title =
			mode === 0 ? "列表循环" : mode === 1 ? "单曲循环" : "随机播放";
	}

	function setPct(pct: number) {
		dockSeek.style.setProperty("--pct", `${pct}%`);
	}

	function updateTimelineActive(index: number) {
		const tracks = timeline.querySelectorAll(".track");
		tracks.forEach((el, i) => {
			el.classList.toggle("active", i === index);
		});
		// 用户正在手动滚动查看时，不强制把当前歌滚回视口
		if (timelineUserScrolling) return;
		const active = tracks[index] as HTMLElement | undefined;
		if (active) {
			timelineProgrammaticScroll = true;
			active.scrollIntoView({ block: "nearest", behavior: "smooth" });
			window.setTimeout(() => {
				timelineProgrammaticScroll = false;
			}, 600);
		}
	}

	// ===== 歌词 =====
	function renderLyrics(lyrics: MgrLyric[]) {
		if (!lyrics || !lyrics.length) {
			lyricsContent.innerHTML = '<p class="lyrics-placeholder">暂无歌词</p>';
			lyricEls = [];
			return;
		}
		lyricsContent.innerHTML = lyrics
			.map(
				(l, i) =>
					`<p class="lyric-line" data-time="${l.time}" data-idx="${i}">${l.text}</p>`,
			)
			.join("");
		lyricEls = Array.from(
			lyricsContent.querySelectorAll(".lyric-line"),
		) as HTMLElement[];
		activeLyricIdx = -1;
		requestAnimationFrame(() => {
			computeLyricOffsets();
			// 初始把首句居中：长歌词时首句不会顶到面板顶部
			if (activeLyricIdx < 0 && lyricOffsets[0] !== undefined) {
				lyricsContent.style.transform = `translateY(${-lyricOffsets[0]}px)`;
			}
		});
	}

	// 每句歌词居中所需的位移；面板高度/换行随窗口变化，缩放时需要重算
	function computeLyricOffsets() {
		const ph = lyricsPanel.clientHeight;
		lyricOffsets = lyricEls.map(
			(el) => el.offsetTop - ph / 2 + el.clientHeight / 2,
		);
	}
	let lyricResizeRaf = 0;
	window.addEventListener("resize", () => {
		if (lyricResizeRaf) return;
		lyricResizeRaf = requestAnimationFrame(() => {
			lyricResizeRaf = 0;
			if (!lyricEls.length) return;
			computeLyricOffsets();
			const idx = activeLyricIdx >= 0 ? activeLyricIdx : 0;
			if (lyricUserOffset === null && lyricOffsets[idx] !== undefined) {
				lyricsContent.style.transform = `translateY(${-lyricOffsets[idx]}px)`;
			}
		});
	});

	function updateLrcHighlight(index: number) {
		if (index === activeLyricIdx) return;
		if (activeLyricIdx >= 0 && lyricEls[activeLyricIdx])
			lyricEls[activeLyricIdx].classList.remove("active");
		// 当前句的相邻句稍亮一些，形成由近及远的渐变层次
		lyricEls[activeLyricIdx - 1]?.classList.remove("near");
		lyricEls[activeLyricIdx + 1]?.classList.remove("near");
		if (index >= 0 && lyricEls[index]) {
			lyricEls[index - 1]?.classList.add("near");
			lyricEls[index + 1]?.classList.add("near");
			lyricEls[index].classList.add("active");
			// 用户手动拖动期间/拖动后冷却期内，不强制覆盖位置
			if (lyricUserOffset === null && lyricOffsets[index] !== undefined) {
				lyricsContent.style.transform = `translateY(${-lyricOffsets[index]}px)`;
			}
		}
		activeLyricIdx = index;
	}

	// ===== 全量同步（挂载时） =====
	function syncAll() {
		const s = mgr.getState();
		playlist = s.playlist;
		if (!s.initialized || !playlist.length) return;
		updateTrackUI(s.track);
		updatePlayStateUI(s.isPlaying);
		updateModeUI(s.playMode);
		updateTimelineActive(s.currentIndex);
		if (s.duration > 0) {
			setPct(s.progress);
			tCur.textContent = s.currentTimeStr;
			tDur.textContent = s.durationStr;
		}
		renderLyrics(s.lyrics);
		if (s.currentLrcIndex >= 0) updateLrcHighlight(s.currentLrcIndex);
	}

	// ===== 事件监听 =====
	on("fm:init", (e: any) => {
		playlist = e.detail.playlist;
		updateModeUI(e.detail.playMode);
		// 同步首曲信息
		const s = mgr.getState();
		if (s.track) updateTrackUI(s.track);
		updateTimelineActive(0);
	});
	on("fm:track", (e: any) => {
		updateTrackUI(e.detail.track);
		updateTimelineActive(e.detail.index);
	});
	on("fm:play-state", (e: any) => updatePlayStateUI(e.detail.isPlaying));
	on("fm:time", (e: any) => {
		const d = e.detail;
		if (!dragging) setPct(d.progress);
		tCur.textContent = d.currentTimeStr;
		tDur.textContent = d.durationStr;
	});
	on("fm:mode", (e: any) => updateModeUI(e.detail.playMode));
	on("fm:lyrics", (e: any) => renderLyrics(e.detail.lyrics));
	on("fm:lrc-index", (e: any) => updateLrcHighlight(e.detail.index));

	// ===== 控制按钮 =====
	bPlay.addEventListener("click", () => mgr.togglePlay());
	bPrev.addEventListener("click", () => mgr.playPrev());
	bNext.addEventListener("click", () => mgr.playNext());
	bMode.addEventListener("click", () => mgr.cyclePlayMode());

	// ===== 手机端歌单抽屉 =====
	const isMobileView = () => window.matchMedia("(max-width: 768px)").matches;
	function setListOpen(open: boolean) {
		root.classList.toggle("list-open", open);
		bList?.setAttribute("aria-expanded", String(open));
		if (open) {
			// 展开时把当前歌曲带到视野里（等抽屉滑出后再滚，避免与过渡打架）
			timelineUserScrolling = false;
			window.setTimeout(() => {
				const active = timeline.querySelector(".track.active");
				active?.scrollIntoView({ block: "center", behavior: "auto" });
			}, 60);
		}
	}
	bList?.addEventListener("click", () =>
		setListOpen(!root.classList.contains("list-open")),
	);
	listBackdrop?.addEventListener("click", () => setListOpen(false));
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") setListOpen(false);
	});

	timeline.addEventListener("click", (e) => {
		const track = (e.target as HTMLElement).closest(
			".track",
		) as HTMLElement | null;
		if (track) {
			mgr.playTrackByIndex(Number.parseInt(track.dataset.index || "0", 10));
			// 手机端选完歌自动收起抽屉
			if (isMobileView()) setListOpen(false);
		}
	});
	lyricsContent.addEventListener("click", (e) => {
		const line = (e.target as HTMLElement).closest(
			".lyric-line",
		) as HTMLElement | null;
		if (line) mgr.seekToTime(Number.parseFloat(line.dataset.time || "0"));
	});

	// ===== 歌词面板手动拖动 =====
	function getLyricTranslateY(): number {
		const m = lyricsContent.style.transform.match(
			/translateY\((-?\d+(?:\.\d+)?)px\)/,
		);
		return m ? Number(m[1]) : 0;
	}
	function pauseLyricAutoFollow(ms: number) {
		lyricUserOffset = getLyricTranslateY();
		if (lyricResumeTimer) window.clearTimeout(lyricResumeTimer);
		lyricResumeTimer = window.setTimeout(() => {
			lyricUserOffset = null;
			// 冷却结束立即回到当前歌词位置
			if (activeLyricIdx >= 0 && lyricOffsets[activeLyricIdx] !== undefined) {
				lyricsContent.style.transform = `translateY(${-lyricOffsets[activeLyricIdx]}px)`;
			}
		}, ms);
	}
	lyricsPanel.addEventListener("pointerdown", (e) => {
		// 点击具体歌词行时是 seek，不进入拖动
		if ((e.target as HTMLElement).closest(".lyric-line")) return;
		isDraggingLyrics = true;
		lyricDragStartY = e.clientY;
		lyricDragStartTransform = getLyricTranslateY();
		lyricsContent.style.transition = "none";
		try {
			lyricsPanel.setPointerCapture(e.pointerId);
		} catch {
			/* noop */
		}
	});
	lyricsPanel.addEventListener("pointermove", (e) => {
		if (!isDraggingLyrics) return;
		const dy = e.clientY - lyricDragStartY;
		lyricsContent.style.transform = `translateY(${lyricDragStartTransform + dy}px)`;
	});
	const endLyricDrag = (e: PointerEvent) => {
		if (!isDraggingLyrics) return;
		isDraggingLyrics = false;
		lyricsContent.style.transition = "";
		try {
			lyricsPanel.releasePointerCapture(e.pointerId);
		} catch {
			/* noop */
		}
		// 用户拖动后冷却 3 秒再恢复自动跟随
		pauseLyricAutoFollow(3000);
	};
	lyricsPanel.addEventListener("pointerup", endLyricDrag);
	lyricsPanel.addEventListener("pointercancel", endLyricDrag);

	// ===== 时间线歌曲列表手动滚动 =====
	timeline.addEventListener("scroll", () => {
		// scrollIntoView 触发的程序滚动不视为用户操作
		if (timelineProgrammaticScroll) return;
		timelineUserScrolling = true;
		if (timelineResumeTimer) window.clearTimeout(timelineResumeTimer);
		timelineResumeTimer = window.setTimeout(() => {
			timelineUserScrolling = false;
		}, 3000);
	});
	// 触摸滑动也走 scroll 事件，无需单独处理

	// ===== 进度条拖拽 =====
	function seekTo(clientX: number) {
		const rect = dockSeek.getBoundingClientRect();
		const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		setPct(p * 100);
		tCur.textContent = (() => {
			const dur = mgr.getState().duration;
			if (!dur) return "0:00";
			const sec = p * dur;
			const m = Math.floor(sec / 60);
			const s = Math.floor(sec % 60);
			return `${m}:${s.toString().padStart(2, "0")}`;
		})();
	}
	dockSeek.addEventListener("pointerdown", (e) => {
		dragging = true;
		dockSeek.classList.add("dragging");
		dockSeek.setPointerCapture(e.pointerId);
		seekTo(e.clientX);
	});
	dockSeek.addEventListener("pointermove", (e) => {
		if (dragging) seekTo(e.clientX);
	});
	const endDrag = (e: PointerEvent) => {
		if (!dragging) return;
		// 松开时把最终位置 seek 到 mgr
		const rect = dockSeek.getBoundingClientRect();
		const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		mgr.seek(p);
		dragging = false;
		dockSeek.classList.remove("dragging");
		try {
			dockSeek.releasePointerCapture(e.pointerId);
		} catch {
			/* noop */
		}
	};
	dockSeek.addEventListener("pointerup", endDrag);
	dockSeek.addEventListener("pointercancel", () => {
		dragging = false;
		dockSeek.classList.remove("dragging");
	});

	// ===== Canvas：波浪背景 + 涟漪 =====
	canvasCtx = canvas.getContext("2d");
	function resizeCanvas() {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		canvasCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resizeCanvas();

	function spawnRipple(x: number, y: number) {
		ripples.push({
			x,
			y,
			radius: 4,
			maxRadius: 280,
			alpha: 0.9,
		});
		// 限制涟漪数量，避免堆积
		if (ripples.length > 14) ripples.shift();
	}

	// 涟漪只在点击时出现（不跟随鼠标移动）
	canvas.addEventListener("click", (e) => {
		const rect = canvas.getBoundingClientRect();
		spawnRipple(e.clientX - rect.left, e.clientY - rect.top);
	});

	// ===== 频谱分析：对数分频 + 自动增益 + 节拍检测（仅用于鼓点触发猫爪与歌名光晕）=====
	// analyser fftSize=1024 → 512 bins（≈43Hz/bin@44.1k），对数铺开 bin 1..320（≈43Hz–13.8kHz）
	const BANDS = 64;
	const BIN_LO = 1;
	const BIN_HI = 320;
	const bandRaw = new Float32Array(BANDS); // 本帧未平滑值
	let gainPeak = 0.4; // 自动增益：跟踪近期最大值，歌曲轻重都能撑满画面
	let bassAvg = 0;
	let lastBeatAt = 0;
	let kick = 0; // 节拍冲量：命中鼓点瞬间≈1，之后指数衰减
	let hueCache = 57;
	let waveEnergy = 0.25; // 背景波浪的当前幅度（0.25 暂停 ~ 1 播放）
	let wavePhase = 0; // 背景波浪的累计相位
	let lastWaveAt = performance.now();
	let hueReadAt = 0;
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	interface Paw {
		x: number;
		y: number;
		vy: number;
		size: number;
		phase: number;
		rot: number;
		hueOff: number;
		alpha: number;
	}
	const paws: Paw[] = [];

	// 读取某个对数频带的能量（0-1）：窄频带插值，宽频带取最大/均值混合
	function sampleBand(freq: Uint8Array, i: number): number {
		const ratio = BIN_HI / BIN_LO;
		const a = BIN_LO * ratio ** (i / BANDS);
		const b = BIN_LO * ratio ** ((i + 1) / BANDS);
		if (b - a <= 1.2) {
			const c = (a + b) / 2;
			const lo = Math.floor(c);
			const f = c - lo;
			return ((freq[lo] ?? 0) * (1 - f) + (freq[lo + 1] ?? 0) * f) / 255;
		}
		let max = 0;
		let sum = 0;
		let n = 0;
		for (let k = Math.floor(a); k < Math.ceil(b); k++) {
			const v = freq[k] ?? 0;
			if (v > max) max = v;
			sum += v;
			n++;
		}
		return (max * 0.6 + (sum / n) * 0.4) / 255;
	}

	// 无法取得真实频谱（如跨域音频）时，播放中用伪频谱兜底，保证仍有律动
	function fakeSpectrum(t: number) {
		const env = 0.55 + 0.45 * Math.max(0, Math.sin(t * Math.PI * 4)) ** 3;
		for (let i = 0; i < BANDS; i++) {
			const lowBias = 1 - (i / BANDS) * 0.55;
			const wave = 0.5 + 0.5 * Math.sin(t * (1.6 + i * 0.09) + i * 0.8);
			bandRaw[i] = Math.min(1, wave * lowBias * (i < 10 ? env : 0.8));
		}
	}

	function analyse(freq: Uint8Array | null, playing: boolean, now: number) {
		const t = now / 1000;
		if (playing && freq) {
			let frameMax = 0;
			for (let i = 0; i < BANDS; i++) {
				// 高频天然能量低，做一点频谱倾斜补偿
				const v = sampleBand(freq, i) * (1 + (i / BANDS) * 0.9);
				bandRaw[i] = v;
				if (v > frameMax) frameMax = v;
			}
			gainPeak = Math.max(gainPeak * 0.997, frameMax, 0.3);
			const norm = 1 / gainPeak;
			for (let i = 0; i < BANDS; i++) {
				bandRaw[i] = Math.min(1, bandRaw[i] * norm) ** 1.6; // 拉开对比，峰值更突出
			}
		} else if (playing) {
			fakeSpectrum(t);
		} else {
			bandRaw.fill(0);
		}

		// 节拍：低频能量显著高于近期均值即视为一次鼓点
		let bass = 0;
		for (let i = 0; i < 7; i++) bass += bandRaw[i];
		bass /= 7;
		bassAvg = bassAvg * 0.94 + bass * 0.06;
		if (playing && bass > bassAvg * 1.28 + 0.08 && now - lastBeatAt > 190) {
			lastBeatAt = now;
			kick = Math.min(1, 0.55 + (bass - bassAvg) * 1.8);
			onBeat();
		} else {
			kick *= 0.9;
		}
	}

	function onBeat() {
		if (reducedMotion) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const count = kick > 0.8 ? 3 : 2;
		for (let n = 0; n < count && paws.length < 36; n++) {
			paws.push({
				x: Math.random() * w,
				y: h + 20,
				vy: 1.3 + Math.random() * 1.9 + kick * 1.2,
				size: 9 + Math.random() * 10,
				phase: Math.random() * Math.PI * 2,
				rot: (Math.random() - 0.5) * 0.8,
				hueOff: Math.random() * 50 - 15,
				alpha: 0.5 + Math.random() * 0.3,
			});
		}
	}

	// 小猫爪：1 个掌垫 + 4 个脚趾
	function drawPaw(p: Paw, alpha: number, hue: number) {
		const ctx = canvasCtx!;
		const s = p.size;
		ctx.save();
		ctx.translate(p.x + Math.sin(p.phase) * 14, p.y);
		ctx.rotate(p.rot + Math.sin(p.phase) * 0.25);
		ctx.globalAlpha = alpha;
		ctx.fillStyle = `hsl(${hue + p.hueOff}, 85%, 78%)`;
		ctx.beginPath();
		ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
		ctx.moveTo(-s * 0.72 + s * 0.2, -s * 0.05);
		ctx.ellipse(-s * 0.72, -s * 0.05, s * 0.2, s * 0.28, -0.35, 0, Math.PI * 2);
		ctx.moveTo(-s * 0.28 + s * 0.2, -s * 0.5);
		ctx.ellipse(-s * 0.28, -s * 0.5, s * 0.2, s * 0.3, -0.1, 0, Math.PI * 2);
		ctx.moveTo(s * 0.28 + s * 0.2, -s * 0.5);
		ctx.ellipse(s * 0.28, -s * 0.5, s * 0.2, s * 0.3, 0.1, 0, Math.PI * 2);
		ctx.moveTo(s * 0.72 + s * 0.2, -s * 0.05);
		ctx.ellipse(s * 0.72, -s * 0.05, s * 0.2, s * 0.28, 0.35, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function drawPaws(h: number, hue: number) {
		for (let i = paws.length - 1; i >= 0; i--) {
			const p = paws[i];
			p.y -= p.vy;
			p.phase += 0.03;
			// 越靠近顶部越透明
			const fade = Math.min(1, Math.max(0, p.y / (h * 0.8)));
			if (p.y < -30 || fade < 0.02) {
				paws.splice(i, 1);
				continue;
			}
			drawPaw(p, p.alpha * fade, hue);
		}
	}

	function drawVisualizer() {
		requestAnimationFrame(drawVisualizer);
		if (!canvasCtx) return;
		const ctx = canvasCtx;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const now = performance.now();
		// --hue 很少变化，每秒读一次即可，避免每帧强制样式计算
		if (now - hueReadAt > 1000) {
			hueReadAt = now;
			hueCache =
				Number(getComputedStyle(root).getPropertyValue("--hue").trim()) || 57;
		}
		const hue = hueCache;

		ctx.clearRect(0, 0, w, h);

		analyse(mgr.getFreqData?.() ?? null, isPlaying, now);

		// 背景波浪：只做缓慢的呼吸流动，不随鼓点起伏。
		// 幅度与速度向目标值缓动、相位累加，播放/暂停切换时不会突然跳变。
		const dt = Math.min(0.1, (now - lastWaveAt) / 1000);
		lastWaveAt = now;
		waveEnergy += ((isPlaying ? 1 : 0.25) - waveEnergy) * 0.04;
		wavePhase += dt * (0.3 + ((waveEnergy - 0.25) / 0.75) * 0.7);
		const energy = waveEnergy;
		const layers = [
			{ freq: 0.7, amp: 0.05 + energy * 0.16, speed: 0.5, alpha: 0.09, hueOff: 0 },
			{ freq: 1.3, amp: 0.07 + energy * 0.12, speed: -0.35, alpha: 0.07, hueOff: 30 },
			{ freq: 2.1, amp: 0.04 + energy * 0.1, speed: 0.25, alpha: 0.05, hueOff: 60 },
		];
		for (const layer of layers) {
			const amp = layer.amp;
			ctx.beginPath();
			ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 4) {
				const y =
					h / 2 +
					Math.sin(x * 0.006 * layer.freq + wavePhase * layer.speed) * (h * amp) +
					Math.sin(x * 0.013 * layer.freq + wavePhase * layer.speed * 1.6) *
						(h * amp * 0.4);
				ctx.lineTo(x, y);
			}
			ctx.lineTo(w, h);
			ctx.closePath();
			const grad = ctx.createLinearGradient(0, 0, 0, h);
			grad.addColorStop(0, `hsla(${hue + layer.hueOff}, 80%, 55%, ${layer.alpha})`);
			grad.addColorStop(1, `hsla(${hue + layer.hueOff}, 80%, 55%, 0)`);
			ctx.fillStyle = grad;
			ctx.fill();
		}

		drawPaws(h, hue);

		// 节拍发光：冲量写入 --beat，驱动封面脉冲与歌名光晕（每 2 帧更新，避免频繁样式重算）
		frameCount++;
		if (frameCount % 2 === 0) {
			root.style.setProperty("--beat", (isPlaying ? kick : 0).toFixed(3));
		}

		// 涟漪
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.radius += 5.5;
			r.alpha *= 0.965;
			if (r.radius > r.maxRadius || r.alpha < 0.02) {
				ripples.splice(i, 1);
				continue;
			}
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
			ctx.strokeStyle = `hsla(${hue}, 85%, 60%, ${r.alpha})`;
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2);
			ctx.strokeStyle = `hsla(${hue}, 85%, 65%, ${r.alpha * 0.5})`;
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
			ctx.fillStyle = `hsla(${hue}, 85%, 70%, ${r.alpha})`;
			ctx.fill();
		}
	}
	drawVisualizer();
	window.addEventListener("resize", () => {
		resizeCanvas();
	});

	// ===== 初始化 =====
	const initState = mgr.getState();
	if (initState.initialized) {
		syncAll();
	} else {
		// 触发 mgr 初始化（加载歌单，不自动播放）
		mgr.init();
		// init 是异步的，fm:init 事件来时会刷新歌单；先同步一次已有状态
		syncAll();
	}
}
