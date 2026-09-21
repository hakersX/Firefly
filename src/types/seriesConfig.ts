// 连载故事专辑的类型定义

export type SeriesStatus = "ongoing" | "completed";

export type SeriesMeta = {
	// 专辑 id：文章 frontmatter 的 series 字段必须与此一致；同时用于 URL（/series/{id}/）
	id: string;
	// 专辑显示名称
	name: string;
	// 简介
	description?: string;
	// 封面图（留空时使用第一章封面或自动渐变占位）
	cover?: string;
	// 连载状态：ongoing 连载中 | completed 已完结
	status?: SeriesStatus;
};

export type SeriesConfig = {
	// 总开关
	enable: boolean;
	// 已登记的专辑列表（文章标记了未登记的 series 时会自动生成默认专辑信息）
	series: SeriesMeta[];
};
