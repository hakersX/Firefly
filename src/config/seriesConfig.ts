import seriesList from "@/data/series.json";
import type { SeriesConfig, SeriesMeta } from "../types/seriesConfig";

/**
 * 连载故事配置
 *
 * 用法：
 * 1. 连载作品登记在 src/data/series.json（id / 名称 / 简介 / 封面 / 状态），
 *    推荐用本地后台（pnpm admin →「连载」）新建和编辑，id 会自动生成
 * 2. 每章文章 frontmatter 标记：
 *      series: changan-night   # 与作品 id 一致
 *      chapter: 1              # 章节序号（从 1 开始）
 * 3. 章节自动按 chapter 升序聚合到 /series/{id}/
 *    未登记的 series id 也会自动生成专辑页（名称直接显示 id）
 */
export const seriesConfig: SeriesConfig = {
	enable: true,

	series: seriesList as SeriesMeta[],
};
