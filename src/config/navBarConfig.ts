import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接
	const links: NavBarLink[] = [];

	// 扁平导航：常用入口直接摆在桌面导航栏上，次要页面收进「更多」
	links.push(LinkPresets.Home);
	links.push({
		...LinkPresets.Posts,
		name: "文章",
		icon: "material-symbols:article",
	});
	links.push(LinkPresets.Dynamic);
	links.push(LinkPresets.Gallery);
	links.push(LinkPresets.Music);
	links.push(LinkPresets.Friends);
	links.push({ ...LinkPresets.About, name: "关于" });
	links.push({
		name: "更多",
		url: "#",
		icon: "material-symbols:more-horiz",
		children: [
			LinkPresets.Tools,
			LinkPresets.Anime,
			LinkPresets.Books,
			LinkPresets.Booknav,
		],
	});

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const LinkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	Posts: {
		name: "文章列表",
		url: "/articles/",
		icon: "material-symbols:list-alt",
	},
	Dynamic: {
		name: "日记",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Sponsor: {
		name: "打赏",
		url: "/sponsor/",
		icon: "material-symbols:favorite",
		pageKey: "sponsor",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	About: {
		name: "关于我",
		url: "/about/",
		icon: "material-symbols:person",
	},
	Bangumi: {
		name: "番组计划",
		url: "/bangumi/",
		icon: "material-symbols:movie",
		pageKey: "bangumi",
	},
	VNDB: {
		name: "VNDB",
		url: "/vndb/",
		icon: "material-symbols:movie",
		pageKey: "vndb",
	},
	Gallery: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
		pageKey: "gallery",
	},
	Series: {
		name: "连载故事",
		url: "/series/",
		icon: "material-symbols:auto-stories-rounded",
		pageKey: "series",
	},
	Anime: {
		name: "追番",
		url: "/anime/",
		icon: "material-symbols:live-tv",
		pageKey: "anime",
	},
	Booknav: {
		name: "书签导航",
		url: "/booknav/",
		icon: "material-symbols:bookmarks",
		pageKey: "booknav",
	},
	Music: {
		name: "音乐",
		url: "/music/",
		icon: "material-symbols:music-note-rounded",
		pageKey: "music",
	},
	Books: {
		name: "书籍",
		url: "/books/",
		icon: "material-symbols:menu-book-rounded",
		pageKey: "books",
	},
	Tools: {
		name: "工具",
		url: "/tools/",
		icon: "material-symbols:build-rounded",
		pageKey: "tools",
	},
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
