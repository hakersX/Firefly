# 🐾 猫神X的猫窝

> 一个充满猫咪元素的个人博客：记录技术、生活，也写连载故事。

**在线访问：[catxblog.online](https://catxblog.online)**

![Node.js >= 22](https://img.shields.io/badge/node.js-%3E%3D22-brightgreen)
![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-blue)
![Astro](https://img.shields.io/badge/Astro-7-orange)
![Svelte](https://img.shields.io/badge/Svelte-5-red)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

本站基于 [Firefly](https://github.com/CuteLeaf/Firefly)（Fuwari 的二次开发主题）改造，是纯静态站点，**没有后端和数据库**，部署在 Cloudflare 上。

---

## ✨ 特色

**猫窝风格**

- 首页是暖色的「猫窝」：窗台上的猫咪剪影会眨眼、摇尾巴，眼睛跟着鼠标转，点它会冒出「喵~」；点空白处会盖一个猫爪印。亮色 / 暗色两套配色。
- 首页与音乐页等独立页面互相跳转时，有猫爪圆形转场；其他页面切换是带回弹的弹簧动画。
- 猫爪 logo 与 favicon、猫窝式文案统一了站点气质。

**内容**

- **文章**：Markdown / MDX，支持分类、标签、归档、置顶、加密文章、全文搜索（Pagefind）、RSS 与站点地图。
- **连载故事**：按「专辑 + 章节」组织，自动聚合到 `/series/<id>/`。
- **动态**：类似微博的碎碎念，支持定位。
- **相册、书架、书签导航、工具箱、友链、追番**等独立页面，均可在配置里开关。

**音乐页**（`/music/`）

- 桌面端三栏：封面在左、歌词居中偏右、歌单在右；当前句放大高亮，窗口缩放自动居中。
- 手机端：封面歌名在上、歌词居中，歌单收进底部抽屉，点药丸里的按钮展开。
- 跨页面持续播放：播放器挂在 swup 容器之外，切页不会中断。

## 🧱 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | [Astro](https://astro.build) 7（静态输出） |
| 交互组件 | Svelte 5 |
| 样式 | Tailwind CSS + Stylus + 原生 CSS |
| 页面切换 | Swup.js |
| 搜索 | Pagefind |
| 代码质量 | Biome、TypeScript |
| 部署 | Cloudflare Workers（也支持 Vercel） |

## 🚀 快速开始

环境要求：**Node.js ≥ 22**，包管理器必须用 **pnpm**。

```bash
pnpm install        # 安装依赖
pnpm dev            # 本地开发，http://localhost:4321
pnpm build          # 生产构建，输出到 dist/
pnpm preview        # 预览生产构建
```

其他常用命令：

| 命令 | 作用 |
|---|---|
| `pnpm new-post <文件名>` | 新建一篇文章（自动生成 frontmatter） |
| `pnpm new-dynamic` | 新建一条动态 |
| `pnpm lqips` | 为新图片生成模糊占位数据（写入 `src/constants/lqips.json`） |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm lint` / `pnpm format` | Biome 检查 / 格式化（仅 `src/`） |

## ✍️ 写内容

文章放在 `src/content/posts/`，frontmatter 示例：

```yaml
---
title: 文章标题
published: 2026-09-21
description: 一句话简介
tags: [故事]
category: 故事
draft: false      # 见下方说明
pinned: false
---
```

> ⚠️ **`draft: true` 的文章只在本地开发时可见，线上构建会过滤掉。**
> 本地能看到、线上看不到时，先检查这个字段。

**连载故事**：先在 `src/config/seriesConfig.ts` 登记专辑，再给每章文章加上：

```yaml
series: 专辑id    # 与配置里的 id 一致
chapter: 1        # 章节序号，从 1 开始
```

**音乐**：音频放 `public/assets/music/`，封面放 `cover/`，歌词（`.lrc`）放 `lrc/`，然后在 `src/data/music.ts` 里加一条记录。

**书籍**：在 `src/data/books.ts` 里登记，`pdf` 字段可以是站内路径，也可以是完整的 `https://…` 链接。

## ⚙️ 配置

所有功能都由 `src/config/` 下的 TypeScript 文件控制，改完无需动组件：

| 文件 | 内容 |
|---|---|
| `siteConfig.ts` | 站点标题、描述、主题色、页面开关、分页等 |
| `profileConfig.ts` | 头像、名字、签名、社交链接 |
| `navBarConfig.ts` | 导航栏菜单 |
| `sidebarConfig.ts` | 侧边栏布局与组件 |
| `effectsConfig.ts` | 樱花、阅读进度条等特效 |
| `musicConfig.ts` / `src/data/music.ts` | 音乐播放器与歌单 |
| `commentConfig.ts`、`analyticsConfig.ts` | 评论与统计 |

首页的猫咪与各区块在 `src/components/home/`，页面入口是 `src/pages/index.astro`。

## ☁️ 部署

### Cloudflare Workers（当前使用）

- 构建命令：`pnpm build`，构建环境变量设置 `CF_WORKERS=1`
- 输出目录：`dist`（见 `wrangler.jsonc`）
- 推送到 `master` 后由 Cloudflare 自动构建部署

### Vercel

仓库内已有 `vercel.json`，导入项目后直接使用默认配置即可。

### 大文件（书、视频）怎么放？

Cloudflare 的静态资源**单文件上限 25 MiB**，书（PDF）和视频很容易超限。做法是把大文件放到 **Cloudflare R2**，并绑定一个自定义域名（例如 `media.example.com`），然后在配置里直接引用完整链接：

```ts
pdf: "https://media.example.com/books/xxx.pdf",
playerUrl: "https://media.example.com/videos/bg.mp4",
```

R2 有免费额度且下载不收流量费。不要把 `r2.dev` 默认地址用于正式环境。音频如果也放 R2，需要在存储桶里配置 CORS，否则音乐页读取不到频谱数据。

## 📁 目录结构

```text
src/
├─ components/     组件（home 首页、music 音乐页、layout、widget 等）
├─ config/         站点配置
├─ content/        文章、动态、特殊页面（Markdown）
├─ data/           歌单、书架等数据
├─ layouts/        基础布局
├─ pages/          路由页面
├─ plugins/        自定义 remark / rehype 插件
├─ styles/         全局样式
└─ i18n/           多语言文案
public/            静态资源（音乐、相册、字体等）
scripts/           构建脚本（LQIP、字体子集化等）
```

## 🙏 致谢

- [Firefly](https://github.com/CuteLeaf/Firefly) by CuteLeaf —— 本站所基于的主题
- [Fuwari](https://github.com/saicaca/fuwari) by saicaca —— Firefly 的上游模板
- [Astro](https://astro.build)、[Svelte](https://svelte.dev)、[Swup](https://swup.js.org)、[Pagefind](https://pagefind.app)

## 📄 协议

[MIT](LICENSE)。原作者的版权声明保留在 `LICENSE` 中。
