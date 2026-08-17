/**
 * 工具箱配置
 * 在这里添加/修改工具分类和工具项
 */

export interface ToolItem {
	/** 唯一标识符（建议使用 kebab-case） */
	id: string;
	/** 工具名称 */
	name: string;
	/** 简短描述 */
	description: string;
	/** 外部链接 */
	url: string;
	/** 图标名称（Iconify 格式，如 material-symbols:download） */
	icon: string;
	/** 可选：标签（如"推荐"、"新"等） */
	badge?: string;
}

export interface ToolCategory {
	/** 分类名称 */
	name: string;
	/** 分类图标 */
	icon: string;
	/** 该分类下的工具列表 */
	tools: ToolItem[];
}

export const toolsConfig: ToolCategory[] = [
	{
		name: "免费视频观看",
		icon: "material-symbols:live-tv-rounded",
		tools: [
			{
				id: "爱壹机",
				name: "爱壹机",
				description: "免费在线观看影视剧、综艺等视频内容",
				url: "https://www.iyf.tv/play/vEQ16j241LF?id=dGMBVfu03pA",
				icon: "material-symbols:play-circle-rounded",
				badge: "推荐",
			},
			{
				id: "nbyy",
				name: "泥巴影院",
				description: "需翻墙访问，免费在线观看影视资源",
				url: "https://www.nbyy.cc/detail/332353986.html",
				icon: "material-symbols:movie-rounded",
				badge: "需翻墙",
			},
		],
	},
	{
		name: "视频下载",
		icon: "material-symbols:download-rounded",
		tools: [
			{
				id: "snapany",
				name: "SnapAny",
				description: "在线下载 B站、抖音、快手等平台视频",
				url: "https://snapany.com/zh/bilibili",
				icon: "material-symbols:play-circle-rounded", // 改为视频相关图标
				badge: "推荐",
			},
			{
				id: "cobalt",
				name: "Cobalt",
				description: "无广告、无追踪的媒体下载工具",
				url: "https://cobalt.tools/",
				icon: "material-symbols:cloud-download-rounded",
			},
		],
	},
	{
	name: "图片处理",
	icon: "material-symbols:image-rounded",
	tools: [
		{
			id: "squoosh",
			name: "Squoosh",
			description: "Google 出品的图片压缩与格式转换",
			url: "https://squoosh.app/",
			icon: "material-symbols:compress-outline-rounded",
		},
		{
			id: "removebg",
			name: "Remove.bg",
			description: "一键 AI 抠图，去除图片背景",
			url: "https://www.remove.bg/",
			icon: "material-symbols:auto-awesome-rounded", // ✅ 修复
		},
		{
			id: "tinypng",
			name: "TinyPNG",
			description: "智能 PNG/JPEG 图片无损压缩，保留画质",
			url: "https://tinypng.com/",
			icon: "material-symbols:photo-size-select-small-rounded",
		},
	],
},
	{
		name: "文件转换",
		icon: "material-symbols:swap-horiz-rounded",
		tools: [
			{
				id: "cloudconvert",
				name: "CloudConvert",
				description: "支持 200+ 格式的在线文件转换",
				url: "https://cloudconvert.com/",
				icon: "material-symbols:cloud-rounded",
			},
			{
				id: "convertio",
				name: "Convertio",
				description: "简单好用的多格式文件转换器",
				url: "https://convertio.co/",
				icon: "material-symbols:sync-rounded",
			},
		],
	},
	{
		name: "开发工具",
		icon: "material-symbols:code-rounded",
		tools: [
			{
				id: "regex101",
				name: "Regex 101",
				description: "正则表达式在线测试与调试",
				url: "https://regex101.com/",
				icon: "material-symbols:functions-rounded",
			},
			{
				id: "json-formatter",
				name: "JSON Formatter",
				description: "JSON 格式化、验证与树形预览",
				url: "https://jsonformatter.org/",
				icon: "material-symbols:data-object-rounded",
			},
			{
				id: "caniuse",
				name: "Can I Use",
				description: "查询 CSS/JS API 的浏览器兼容性",
				url: "https://caniuse.com/",
				icon: "material-symbols:check-circle-outline-rounded",
			},
		],
	},
	{
		name: "效率工具",
		icon: "material-symbols:rocket-rounded",
		tools: [
			{
				id: "excalidraw",
				name: "Excalidraw",
				description: "手绘风格白板，适合画图与头脑风暴",
				url: "https://excalidraw.com/",
				icon: "material-symbols:draw-rounded",
			},
			{
				id: "pdf24",
				name: "PDF24 Tools",
				description: "免费 PDF 合并、拆分、压缩等全套工具",
				url: "https://tools.pdf24.org/",
				icon: "material-symbols:picture-as-pdf-rounded",
			},
		],
	},
];