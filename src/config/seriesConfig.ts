import type { SeriesConfig, SeriesMeta } from "../types/seriesConfig";

/**
 * 连载故事配置
 *
 * 用法：
 * 1. 在下方 series 数组里登记专辑（id / 名称 / 简介 / 封面 / 状态）
 * 2. 每章文章 frontmatter 标记：
 *      series: changan-night   # 与专辑 id 一致
 *      chapter: 1              # 章节序号（从 1 开始）
 * 3. 章节自动按 chapter 升序聚合到 /series/{id}/
 *    未在此登记的 series id 也会自动生成专辑页（名称直接显示 id）
 */
export const seriesConfig: SeriesConfig = {
	enable: true,

	series: [
		{
  "id": "gathering-kindling",
  "name": "拾薪记",
  "description": "天监四十七年上元夜，建康城燃灯十万盏。临江王萧景琰蹲在河边喝三文钱的酒，一个偷灯贼撞进了他的桌子。那夜之后，酒馆桌角多了一个刻痕——一个人俯身，从将熄的火堆里捡柴。萧景琰不知道，他自己就是那根被捡起来的柴。",
  "status": "ongoing"
}
	] as SeriesMeta[],
};
