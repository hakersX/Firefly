import { type CollectionEntry, getCollection } from "astro:content";
import { seriesConfig } from "@/config";
import type { SeriesMeta, SeriesStatus } from "@/types/seriesConfig";
import { getPostUrlBySlug, removeFileExtension, url } from "./url-utils";

/**
 * 连载故事工具：按文章 frontmatter 的 series + chapter 字段聚合章节，
 * 合并 seriesConfig 中登记的专辑元信息（名称/简介/封面/状态）。
 * 未登记的 series id 会自动生成默认专辑，名称直接使用 id。
 */

export type ChapterInfo = {
	id: string;
	slug: string;
	url: string;
	title: string;
	description: string;
	chapter: number;
	published: Date;
	image: string;
};

export type SeriesAlbum = {
	id: string;
	name: string;
	description: string;
	cover: string;
	status: SeriesStatus;
	chapters: ChapterInfo[];
	/** 最近一章的发布时间，用于专辑排序 */
	updated: Date;
};

function getEntrySlug(entry: CollectionEntry<"posts">): string {
	return entry.data.slug || removeFileExtension(entry.id);
}

function toChapter(entry: CollectionEntry<"posts">): ChapterInfo {
	const slug = getEntrySlug(entry);
	return {
		id: entry.id,
		slug,
		url: getPostUrlBySlug(slug),
		title: entry.data.title,
		description: entry.data.description,
		chapter: entry.data.chapter || 0,
		published: entry.data.published,
		image: entry.data.image,
	};
}

/**
 * 章节排序：优先按 chapter 升序；chapter 缺失（0）时按发布时间升序兜底。
 * 同一专辑内不混合两种规则：全部有 chapter 用 chapter，否则全按时间。
 */
function sortChapters(entries: CollectionEntry<"posts">[]): ChapterInfo[] {
	const allHaveChapter = entries.every((e) => e.data.chapter > 0);
	const sorted = [...entries].sort((a, b) => {
		if (allHaveChapter && a.data.chapter !== b.data.chapter) {
			return a.data.chapter - b.data.chapter;
		}
		return (
			new Date(a.data.published).getTime() -
			new Date(b.data.published).getTime()
		);
	});
	return sorted.map(toChapter);
}

/** 获取所有连载专辑（含章节），按最近更新时间降序 */
export async function getAllSeries(): Promise<SeriesAlbum[]> {
	const posts = await getCollection("posts", ({ data }) => {
		const visible = import.meta.env.PROD ? data.draft !== true : true;
		return visible && Boolean(data.series && data.series.trim());
	});

	const grouped = new Map<string, CollectionEntry<"posts">[]>();
	for (const post of posts) {
		const id = post.data.series.trim();
		const list = grouped.get(id);
		if (list) list.push(post);
		else grouped.set(id, [post]);
	}

	const metaMap = new Map<string, SeriesMeta>(
		seriesConfig.series.map((meta) => [meta.id, meta]),
	);

	const albums: SeriesAlbum[] = [];
	for (const [id, entries] of grouped) {
		const meta = metaMap.get(id);
		const chapters = sortChapters(entries);
		const cover = meta?.cover || chapters.find((c) => c.image)?.image || "";
		albums.push({
			id,
			name: meta?.name || id,
			description: meta?.description || "",
			cover,
			status: meta?.status || "ongoing",
			chapters,
			updated: chapters[chapters.length - 1]?.published || new Date(0),
		});
	}

	albums.sort(
		(a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
	);
	return albums;
}

/** 按 id 获取单个专辑 */
export async function getSeriesById(id: string): Promise<SeriesAlbum | null> {
	const all = await getAllSeries();
	return all.find((album) => album.id === id) ?? null;
}

export type SeriesNav = {
	album: SeriesAlbum;
	index: number; // 当前章下标（0 起）
	prev: ChapterInfo | null; // 上一章（序号更小）
	next: ChapterInfo | null; // 下一章
};

/** 获取某篇文章的章节导航信息；非连载文章返回 null */
export async function getSeriesNav(
	entry: CollectionEntry<"posts">,
): Promise<SeriesNav | null> {
	const seriesId = entry.data.series?.trim();
	if (!seriesId) return null;
	const album = await getSeriesById(seriesId);
	if (!album) return null;
	const index = album.chapters.findIndex((c) => c.id === entry.id);
	if (index === -1) return null;
	return {
		album,
		index,
		prev: index > 0 ? album.chapters[index - 1] : null,
		next: index < album.chapters.length - 1 ? album.chapters[index + 1] : null,
	};
}

/** 专辑页 URL */
export function getSeriesUrl(id: string): string {
	return url(`/series/${id}/`);
}
