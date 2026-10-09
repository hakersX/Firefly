import galleryAlbums from "@/data/gallery.json";
import type { GalleryAlbum, GalleryConfig } from "@/types/galleryConfig";

// 相册配置
export const galleryConfig: GalleryConfig = {
	// 相册列表存放在 src/data/gallery.json，推荐用本地后台管理：
	// pnpm dev 后打开 http://localhost:4321/__admin/gallery（上传 / 删除图片、新建 / 编辑 / 删除相册）
	// 也可以手动编辑 JSON，每一项的字段：
	// id: 相册唯一标识符（用于目录命名和URL路径），比如 "firefly-2026" 对应 public/gallery/firefly-2026/ 目录
	// name: 相册名称
	// description: 相册描述
	// location: 相册拍摄地点
	// date: 相册日期，格式为 YYYY-MM-DD，用于排序和显示
	// tags: 相册标签，用于分类和过滤
	// cover: 手动指定封面图（可选，不填会把 cover.* 文件作为封面图，没有则用第一张图片）
	// password: 访问密码，设置后需要输入密码才能查看相册内容（可选）
	// passwordHint: 密码提示，设置后在输入密码错误时显示（可选，需配合 password 使用）
	// 图片放在 public/gallery/<id>/ 目录下，支持 jpg/png/webp/avif/gif；也可在该目录的 urls.txt 里每行写一个远程图片地址
	albums: galleryAlbums as GalleryAlbum[],

	// 瀑布流最小列宽(px)，浏览器根据容器宽度自动计算列数，默认 240
	// 值越小列数越多，值越大列数越少
	columnWidth: 240,
};
