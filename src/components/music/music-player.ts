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
		// 封面尺寸变化后刷新环形频谱的圆心/半径
		requestAnimationFrame(refreshRingMetrics);
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
			// 手机端歌单是横向滑动卡条：按内联方向居中；桌面竖列表按块方向
			const isMobile = window.matchMedia("(max-width: 768px)").matches;
			active.scrollIntoView(
				isMobile
					? { inline: "center", block: "nearest", behavior: "smooth" }
					: { block: "nearest", behavior: "smooth" },
			);
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
			const ph = lyricsPanel.clientHeight;
			lyricOffsets = lyricEls.map(
				(el) => el.offsetTop - ph / 2 + el.clientHeight / 2,
			);
			// 初始把首句居中：长歌词时首句不会顶到面板顶部
			if (activeLyricIdx < 0 && lyricOffsets[0] !== undefined) {
				lyricsContent.style.transform = `translateY(${-lyricOffsets[0]}px)`;
			}
		});
	}

	function updateLrcHighlight(index: number) {
		if (index === activeLyricIdx) return;
		if (activeLyricIdx >= 0 && lyricEls[activeLyricIdx])
			lyricEls[activeLyricIdx].classList.remove("active");
		if (index >= 0 && lyricEls[index]) {
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

	timeline.addEventListener("click", (e) => {
		const track = (e.target as HTMLElement).closest(
			".track",
		) as HTMLElement | null;
		if (track)
			mgr.playTrackByIndex(Number.parseInt(track.dataset.index || "0", 10));
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

	// 环形频谱的帧间平滑缓存（左右镜像，half 长度）
	const ringHalf = 48;
	const lastRingVals: number[] = new Array(ringHalf).fill(0);

	// 环形频谱几何缓存：圆心跟随中央封面舞台中心，基径随封面大小自适应
	// （各断点的 .center-overlay 位置不同，动态读取可保证任何断点都对齐）
	const ringMetrics = { cx: 0, cy: 0, baseR: 190, maxLen: 70 };
	function refreshRingMetrics() {
		const rect = stageCover?.getBoundingClientRect();
		const isMobile = window.matchMedia("(max-width: 768px)").matches;
		ringMetrics.maxLen = isMobile ? 45 : 70;
		if (!rect || rect.width === 0) {
			// 封面未渲染时退回断点估算
			ringMetrics.cx = canvas.clientWidth / 2;
			ringMetrics.cy =
				canvas.clientHeight * (isMobile ? 0.18 : isTablet() ? 0.3 : 0.38);
			ringMetrics.baseR = isMobile
				? Math.min(140, canvas.clientWidth * 0.32)
				: Math.min(210, canvas.clientWidth * 0.22);
			return;
		}
		ringMetrics.cx = rect.left + rect.width / 2;
		ringMetrics.cy = rect.top + rect.height / 2;
		ringMetrics.baseR = rect.width / 2 + 28;
	}
	function isTablet() {
		return window.matchMedia("(max-width: 1024px)").matches;
	}
	refreshRingMetrics();

	// 中心环形频谱：围绕封面的辐射光柱
	function drawSpectrumRing(hue: string, freq: Uint8Array) {
		const { cx, cy, baseR, maxLen } = ringMetrics;
		const bars = ringHalf * 2;

		// 采样 48 bins（跳过能量集中的最低频，对数式铺开到中高频）
		for (let i = 0; i < ringHalf; i++) {
			const bin = 4 + Math.floor(i * 1.9);
			const cur = (freq[bin] ?? 0) / 255;
			// 帧间缓动，消除 bin 映射跳变
			lastRingVals[i] = lastRingVals[i] * 0.72 + cur * 0.28;
		}

		// 基线圆圈：虚线缓慢旋转
		canvasCtx!.save();
		canvasCtx!.beginPath();
		canvasCtx!.setLineDash([2, 10]);
		canvasCtx!.lineDashOffset = -performance.now() / 90;
		canvasCtx!.arc(cx, cy, baseR - 8, 0, Math.PI * 2);
		canvasCtx!.strokeStyle = `hsla(${hue}, 80%, 65%, 0.18)`;
		canvasCtx!.lineWidth = 1;
		canvasCtx!.stroke();
		canvasCtx!.restore();

		// 光柱：双 pass（粗线低透明做光晕，细线做主体）
		for (let pass = 0; pass < 2; pass++) {
			canvasCtx!.lineWidth = pass === 0 ? 5 : 1.8;
			for (let i = 0; i < bars; i++) {
				const side = i < ringHalf ? i : bars - 1 - i;
				const v = lastRingVals[side];
				const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
				const len = 6 + v * maxLen;
				const cosA = Math.cos(angle);
				const sinA = Math.sin(angle);
				canvasCtx!.beginPath();
				canvasCtx!.moveTo(cx + cosA * baseR, cy + sinA * baseR);
				canvasCtx!.lineTo(cx + cosA * (baseR + len), cy + sinA * (baseR + len));
				canvasCtx!.strokeStyle =
					pass === 0
						? `hsla(${Number(hue) + side * 0.8}, 90%, 60%, ${0.08 + v * 0.3})`
						: `hsla(${Number(hue) + side * 0.8}, 90%, ${62 + v * 18}%, ${0.28 + v * 0.6})`;
				canvasCtx!.stroke();
			}
		}
	}

	function drawVisualizer() {
		requestAnimationFrame(drawVisualizer);
		if (!canvasCtx) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const hue =
			getComputedStyle(root).getPropertyValue("--hue").trim() || "165";

		canvasCtx.clearRect(0, 0, w, h);

		// 真实频谱：MusicManager 的 AnalyserNode 就绪后返回 0-255 数据
		const freq = mgr.getFreqData?.() ?? null;
		let bass = 0;
		let mid = 0;
		let treble = 0;
		if (freq) {
			let b = 0;
			let m = 0;
			let t = 0;
			for (let i = 2; i < 16; i++) b += freq[i];
			for (let i = 16; i < 64; i++) m += freq[i];
			for (let i = 64; i < 160; i++) t += freq[i];
			bass = b / (14 * 255);
			mid = m / (48 * 255);
			treble = t / (96 * 255);
		}

		// 播放时波浪更活跃，暂停时低幅呼吸
		const energy = isPlaying ? 1 : 0.25;
		const time = performance.now() / 1000;
		const speed = isPlaying ? 1 : 0.3;

		const layers = [
			{
				freq: 0.7,
				amp: 0.05 + energy * 0.16,
				speed: 0.5 * speed,
				alpha: 0.09,
				hueOff: 0,
			},
			{
				freq: 1.3,
				amp: 0.07 + energy * 0.12,
				speed: -0.35 * speed,
				alpha: 0.07,
				hueOff: 30,
			},
			{
				freq: 2.1,
				amp: 0.04 + energy * 0.1,
				speed: 0.25 * speed,
				alpha: 0.05,
				hueOff: 60,
			},
		];

		for (const layer of layers) {
			canvasCtx.beginPath();
			canvasCtx.moveTo(0, h);
			for (let x = 0; x <= w; x += 4) {
				// 叠加两个正弦让波浪更自然
				const y =
					h / 2 +
					Math.sin(x * 0.006 * layer.freq + time * layer.speed) *
						(h * layer.amp) +
					Math.sin(x * 0.013 * layer.freq + time * layer.speed * 1.6) *
						(h * layer.amp * 0.4);
				canvasCtx.lineTo(x, y);
			}
			canvasCtx.lineTo(w, h);
			canvasCtx.closePath();
			const grad = canvasCtx.createLinearGradient(0, 0, 0, h);
			grad.addColorStop(
				0,
				`hsla(${Number(hue) + layer.hueOff}, 80%, 55%, ${layer.alpha})`,
			);
			grad.addColorStop(1, `hsla(${Number(hue) + layer.hueOff}, 80%, 55%, 0)`);
			canvasCtx.fillStyle = grad;
			canvasCtx.fill();
		}

		// 环形频谱：仅播放时绘制（暂停时光柱会全部回落，画了也接近基线）
		if (freq && isPlaying) {
			drawSpectrumRing(hue, freq);
		}

		// 节拍发光：低频能量写入 --beat，驱动歌名光晕（每 3 帧更新，避免频繁样式重算）
		frameCount++;
		if (freq && frameCount % 3 === 0) {
			root.style.setProperty(
				"--beat",
				(isPlaying ? Math.min(1, bass * 1.4) : 0).toFixed(3),
			);
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
			// 外圈
			canvasCtx.beginPath();
			canvasCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
			canvasCtx.strokeStyle = `hsla(${hue}, 85%, 60%, ${r.alpha})`;
			canvasCtx.lineWidth = 2;
			canvasCtx.stroke();
			// 内圈
			canvasCtx.beginPath();
			canvasCtx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2);
			canvasCtx.strokeStyle = `hsla(${hue}, 85%, 65%, ${r.alpha * 0.5})`;
			canvasCtx.lineWidth = 1;
			canvasCtx.stroke();
			// 中心光点
			canvasCtx.beginPath();
			canvasCtx.arc(r.x, r.y, 3, 0, Math.PI * 2);
			canvasCtx.fillStyle = `hsla(${hue}, 85%, 70%, ${r.alpha})`;
			canvasCtx.fill();
		}
	}
	drawVisualizer();
	window.addEventListener("resize", () => {
		resizeCanvas();
		refreshRingMetrics();
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
