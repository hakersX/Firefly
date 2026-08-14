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
}
interface Ripple {
	x: number;
	y: number;
	radius: number;
	maxRadius: number;
	alpha: number;
}

const root = document.querySelector(".music-page") as HTMLElement;
const mgr = (window as any).__fireflyMusic as FireflyMusic;

const $ = (id: string) => document.getElementById(id)!;
const coverImg = $("cover-img") as HTMLImageElement;
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
const ripples: Ripple[] = [];
const handlers: Record<string, EventListener> = {};

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
		const active = tracks[index] as HTMLElement | undefined;
		if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
			if (lyricOffsets[index] !== undefined)
				lyricsContent.style.transform = `translateY(${-lyricOffsets[index]}px)`;
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

	function drawVisualizer() {
		requestAnimationFrame(drawVisualizer);
		if (!canvasCtx) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const hue =
			getComputedStyle(root).getPropertyValue("--hue").trim() || "165";

		canvasCtx.clearRect(0, 0, w, h);

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
	window.addEventListener("resize", resizeCanvas);

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
