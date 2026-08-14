# 书籍页面实现计划

## Context（背景）

用户希望在导航栏「记录」下拉菜单下新增「书籍」页面，用于展示个人藏书（PDF）。

- 用户在 ts 配置文件里写好书名、PDF路径、封面、作者、简介；PDF 文件上传到 asset 目录。
- 点击书籍卡片 → 播放「打开书」动画 → 在当前页面用 iframe 展示 PDF（顶部导航栏保留）。
- 设计「高级」的退出方式（合书动画回到书架）。
- 代码放在独立文件夹，兼容手机端。
- 已确认：PDF 用 iframe 嵌入；书籍字段为 书名+PDF+封面+作者+简介。

参考现有模式：音乐页（`src/pages/music/` + `src/components/music/` + `src/data/music.ts`）。

## 资源目录约定

- PDF 文件：`public/assets/books/`（通过 URL `/assets/books/xxx.pdf` 访问）
- 封面图：`public/assets/books/cover/`（`/assets/books/cover/xxx.jpg`）
- 路径写法：相对 public 的绝对路径，与 `src/data/music.ts` 一致

## 实现步骤

### 1. 新增数据配置 `src/data/books.ts`

参考 [src/data/music.ts](file:///d:/project/CatX_blog/Firefly/src/data/music.ts) 的结构（interface + 导出数组 + 顶部添加步骤注释）：

```ts
export interface BookItem {
  id: string;          // 唯一标识，用作 DOM key 与状态
  title: string;       // 书名
  author: string;      // 作者
  description: string; // 简介
  pdf: string;         // PDF 路径（相对 public，如 /assets/books/xxx.pdf）
  cover?: string;     // 封面图路径（可选，缺失时用毛玻璃占位）
}

export const bookshelf: BookItem[] = [
  // 用户在此添加书籍
];
```

### 2. 修改导航栏配置 `src/config/navBarConfig.ts`

- 在 `LinkPresets`（约 158-249 行）新增 `Books` 预设：
  ```ts
  Books: {
    name: "书籍",
    url: "/books/",
    icon: "material-symbols:menu-book-rounded",
    pageKey: "books",
  },
  ```
- 在「记录」下拉 children（约 83-88 行，`LinkPresets.Music` 之后）加入 `LinkPresets.Books`。

### 3. 新增页面路由 `src/pages/books/index.astro`

照搬 [src/pages/music/index.astro](file:///d:/project/CatX_blog/Firefly/src/pages/music/index.astro) 结构：用 `<Layout>` + 自渲染 Navbar div + 引入 `BookShelf` 组件，传入 `bookshelf` 数据和 `hue`。

### 4. 新增组件 `src/components/books/`

照搬 music 目录的 `.astro / .ts / .css` 三件套拆分（CSS 通过 `import` 引入，数据通过 `data-*` 传给前端 JS，hue 通过 `style={`--hue: ${hue};`}` 传入）：

- `BookShelf.astro` — 书架主组件。接收 `bookshelf` + `hue`，渲染响应式卡片网格（封面 + 书名 + 作者 + 简介）。内部 map 出每张卡片。
- `BookReader.astro` — PDF 阅读层（全屏遮罩 + iframe + 退出按钮 + 翻书动画节点）。默认隐藏，由 `book-shelf.ts` 控制显隐。
- `book-shelf.ts` — 交互逻辑：点击卡片 → 触发「打开书」动画 → 显示阅读层并加载 iframe → 点击退出 → 播放「合书」动画 → 回到书架。监听 ESC 键退出。
- `book-shelf.css` — 样式：半透明毛玻璃卡片、翻书 3D 动画、响应式断点。

### 5. 交互与视觉设计

- **书架视图**：响应式网格（桌面 3-4 列，平板 2 列，手机 1 列）。卡片半透明毛玻璃背景（`backdrop-filter: blur`），hover 抬升 + 发光。封面缺失时用渐变占位。
- **打开书动画**：点击卡片 → 卡片放大 + `rotateY` 翻页过渡（CSS `perspective` + `transform`）→ 阅读层淡入。
- **阅读视图**：顶部导航栏保留（不动），下方全屏区域 iframe 展示 PDF。阅读层用半透明遮罩 + 毛玻璃边框。
- **退出方式（高级）**：阅读层右上角浮动毛玻璃圆形「合上书」按钮（图标 `material-symbols:close`），hover 展开「合上书」文字 + 涟漪动效；点击播放合书动画（翻页收回）后回到书架。支持 ESC 退出。
- **手机端**：卡片单列，阅读层全屏铺满，退出按钮放大易触达。

### 6. hue 应用

参考 [MusicPlayer.astro](file:///d:/project/CatX_blog/Firefly/src/components/music/MusicPlayer.astro) 的 `style={`--hue: ${hue};`}` 与 CSS 中 `hsl(var(--hue) ...)` 用法，为卡片边框、遮罩、按钮应用主题色半透明效果。

## 关键文件清单

**新增：**
- `src/data/books.ts`
- `src/pages/books/index.astro`
- `src/components/books/BookShelf.astro`
- `src/components/books/BookReader.astro`
- `src/components/books/book-shelf.ts`
- `src/components/books/book-shelf.css`

**修改：**
- [src/config/navBarConfig.ts](file:///d:/project/CatX_blog/Firefly/src/config/navBarConfig.ts)（加 `Books` 预设 + 「记录」children）

## 验证

1. `pnpm check` 与 `pnpm type-check` 通过。
2. `pnpm dev` 访问 `/books/`：
   - 导航栏「记录」下出现「书籍」入口。
   - 卡片网格正常，封面/书名/作者/简介显示正确。
   - 点击卡片播放打开书动画，PDF 在 iframe 加载，顶部导航栏保留。
   - 点击「合上书」按钮（或按 ESC）播放合书动画回到书架。
3. 手机端尺寸（Chrome DevTools 移动视图）：卡片单列、阅读层全屏、退出按钮可触达。
4. 不影响其他页面（独立文件夹 + 独立路由）。

## 约定遵守

- Biome：tab 缩进、双引号（CSS 不被 biome 格式化，手动遵循）。
- 组件 PascalCase、配置 camelCase、工具 kebab-case。
- 不复用现有播放器组件，独立实现。
- Conventional Commits 提交（`feat: 新增书籍页面`）。
