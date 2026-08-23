// ============================================================================
// 音乐页面独立歌单配置
// 添加歌曲步骤：
// 1. 将音频文件放入 public/assets/music/
// 2. 将封面图放入 public/assets/music/cover/
// 3. 将歌词文件放入 public/assets/music/lrc/（.lrc 格式，带时间标签）
// 4. 在下方数组添加一条记录
// ============================================================================

export interface MusicTrack {
	/** 歌曲名 */
	name: string;
	/** 艺术家 */
	artist: string;
	/** 音频文件路径（相对 public） */
	url: string;
	/** 封面图路径（相对 public） */
	cover: string;
	/** 歌词文件路径（相对 public，.lrc 格式） */
	lrc: string;
}

export const musicPlaylist: MusicTrack[] = [
	// {
	// 	name: "那首没听过的歌",
	// 	artist: "猫神X",
	// 	url: "/assets/music/那首没听过的歌.mp3",
	// 	cover: "/assets/music/cover/那首没听过的歌.jpg",
	// 	lrc: "/assets/music/lrc/那首没听过的歌.lrc",
	// },
	{
		name: "微弱的信号",
		artist: "猫神X",
		url: "/assets/music/微弱的信号.mp3",
		cover: "/assets/music/cover/65a7b5e3d0ce6f226a66887eeb7c7654.jpg",
		lrc: "/assets/music/lrc/微弱的信号.lrc",
	},
	{
		name: "再靠近一点点",
		artist: "猫神X",
		url: "/assets/music/再靠近一点点.mp3",
		cover: "/assets/music/cover/再靠近一点点.jpg",
		lrc: "/assets/music/lrc/再靠近一点点.lrc",
	},
	{
		name: "夏天路过的一场雨",
		artist: "猫神X",
		url: "/assets/music/夏天路过的一场雨.mp3",
		cover: "/assets/music/cover/微信图片_2026-08-12_212117_378.jpg",
		lrc: "/assets/music/lrc/夏天路过的一场雨.lrc",
	},
	// {
	// 	name: "等一句我在",
	// 	artist: "猫神X",
	// 	url: "/assets/music/等一句我在.mp3",
	// 	cover: "/assets/music/cover/微信图片_2026-08-12_212117_378.jpg",
	// 	lrc: "/assets/music/lrc/等一句我在.lrc",
	// },
	// {
	// 	name: "使一颗心免于哀伤",
	// 	artist: "知更鸟 / HOYO-MiX / Chevy",
	// 	url: "/assets/music/使一颗心免于哀伤-哼唱.mp3",
	// 	cover: "/assets/music/cover/109951169585655912.webp",
	// 	lrc: "/assets/music/lrc/使一颗心免于哀伤.lrc",
	// },
];
