# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firefly is a feature-rich static blog theme built on **Astro 7** with **Svelte 5** for interactive components. It's a fork of [Fuwari](https://github.com/saicaca/fuwari) extended with extensive features. Primary language is Chinese (Simplified) with i18n for en, zh_TW, ja, ko, ru.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server at `localhost:4321` |
| `pnpm build` | Production build (LQIPs → VNDB covers → Astro build → pio asset pruning → font subsetting → font CSS extraction → inline-script minify → Pagefind indexing) |
| `pnpm preview` | Preview production build |
| `pnpm check` | `astro check` for type/error checking |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` (covers `src/` and `scripts/`) |
| `pnpm lint` | Biome lint + auto-fix |
| `pnpm format` | Biome format |
| `pnpm new-post <filename>` | Scaffold a new blog post |
| `pnpm new-dynamic` (`new-d`) | Scaffold a new dynamic (microblog) entry |
| `pnpm lqips` | Regenerate LQIP data into `src/constants/lqips.json` |

Package manager is **pnpm** (enforced). Node.js >= 22 required.

## Architecture

### Astro + Svelte Hybrid

- `.astro` components for static content and layouts
- `.svelte` components for interactive UI (search, settings, pagination, archive) — mounted with `client:load` or `client:visible`
- Swup.js handles SPA-like page transitions with multiple container targets

### Configuration-Driven

All features are toggled/configured via TypeScript files in `src/config/`, exported through the barrel at `src/config/index.ts`. Key configs:

- `siteConfig.ts` — core site settings, theme, pagination
- `sidebarConfig.ts` — sidebar layout (left/right/both, widget ordering)
- `commentConfig.ts`, `analyticsConfig.ts`, `fontConfig.ts`, etc.

### Layout System

- `Layout.astro` — base HTML shell (head, body, theme init, analytics, Swup hooks)
- `MainGridLayout.astro` — full page grid with sidebar(s), navbar, wallpaper, footer

### Content Collections

Defined in `src/content.config.ts`:
- `posts` — blog posts (`.md`/`.mdx`) with frontmatter: title, published, tags, category, draft, pinned, password, comment, etc.
- `spec` — special pages (about, guestbook)
- `dynamic` — microblog entries (`.md`) with frontmatter: published, pinned, location

### Key Directories

- `src/components/` — organized by domain: `analytics/`, `comment/`, `common/`, `controls/`, `features/`, `layout/`, `misc/`, `pages/`, `widget/`
- `src/plugins/` — 15 custom remark/rehype plugins (Mermaid, PlantUML, KaTeX, GitHub cards, reading time, wiki links, etc.)
- `src/i18n/` — translation keys in `i18nKey.ts`, language files in `languages/*.ts`, lookup via `translation.ts`
- `src/utils/` — content sorting, crypto (encrypted posts), date formatting, image processing/LQIP, TOC generation
- `src/pages/` — Astro file-based routing
- `scripts/` — build-time utilities (`generate-lqips.ts`, `generate-vndb-covers.ts`, `subset-fonts.ts`, `new-post.js`, `new-dynamic.js`)

### Path Aliases (tsconfig.json)

`@components/*`, `@assets/*`, `@constants/*`, `@utils/*`, `@i18n/*`, `@layouts/*` → `./src/<dir>/*`; `@/*` → `./src/*`

## Code Style

- **Biome** enforces: tab indentation, double quotes, recommended lint rules
- Relaxed rules for `.svelte`/`.astro`/`.vue` files (`useConst`, `useImportType`, `noUnusedVariables`, `noUnusedImports` off)
- `pnpm lint`/`pnpm format` only target `./src` — `scripts/` is type-checked (tsconfig `include`) but not linted, and currently has pre-existing Biome findings
- `scripts/subset-font.d.ts` is a hand-written ambient declaration for the untyped `subset-font` package
- Commit convention: **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.)

## Build Pipeline

Multi-step: `scripts/generate-lqips.ts` → `scripts/generate-vndb-covers.ts` → `astro build` → `scripts/prune-pio-assets.ts` → `scripts/subset-fonts.ts` → `scripts/extract-font-css.ts` → `scripts/minify-inline-scripts.ts` → `pagefind --site dist`

LQIP data is generated into `src/constants/lqips.json` and committed — regenerate with `pnpm lqips`. Icon data lives in `src/constants/icons-data.json` (committed, Biome-ignored, consumed by `src/components/common/Icon.svelte`) but has no generator script in the current build.

`generate-vndb-covers.ts` downloads VNDB cover art into `public/vndb-covers/` (gitignored, skips files that already exist). It no-ops unless `siteConfig.vndb` has a `userId`, `downloadCovers: true`, and `mode: "static"`.

`prune-pio-assets.ts` deletes unused 看板娘 assets from `dist/` after the Astro build (Astro copies all of `public/` regardless of config). It drops `dist/pio/models/live2d` plus the orphaned `Live2DWidget` client chunk when `live2dWidgetConfig.enable` is false, `dist/pio/models/spine` and `dist/pio/static` when `spineModelConfig.enable` is false, and all of `dist/pio` when both are off (~15 MiB). It no-ops when both are enabled.

`extract-font-css.ts` moves the inline `@font-face` blocks that Astro's `<Font />` emits (~280KB, mostly the sliced CJK font) out of every page into one hashed `dist/_astro/fonts/fonts.<hash>.css`, so swup page fetches don't re-download them.

### Swup script re-execution

`reloadScripts` is off in the swup integration; `src/utils/swup-scripts.ts` (wired in `Layout.astro`) re-runs only scripts inside the swup containers plus head scripts newly added by the head plugin. Scripts outside the containers run once per full page load — if one must react to navigation, listen for `swup:page:view` / `astro:page-load` (swup 4 never fires the v2 `swup:contentReplaced` event). Note Astro drops `data-swup-ignore-script` from `define:vars` scripts, so that attribute can't be relied on there.

### Cross-layout navigation (music keeps playing)

The home, music and books pages use their own layouts without the MainGridLayout containers. Every layout wraps everything except the navbar (`#top-row`) in `<div id="swup-page" class="contents">`; `src/utils/swup-page-swap.ts` switches `visit.containers` to `#swup-page` whenever either end of a visit is one of those pages, so the navbar, the global `MusicManager` `<audio>` and other `Layout.astro` parts persist and music never restarts. Only `/dynamic/comments` (iframe embed) is still ignored by swup. On such whole-page swaps every script inside `#swup-page` re-runs, including `data-swup-ignore-script` ones, so:

- inline scripts in those pages must guard document/window listeners and timers (check `isConnected` / a `window.__flag`) or they pile up on each visit;
- bundled module scripts execute only once per session — page UI that lives inside `#swup-page` must (re)mount on `swup:page:view` and tear down its window listeners when its DOM is gone (see `src/components/music/music-player.ts`);
- the navbar markup must stay identical across layouts, since it is never replaced.

### Local gallery admin (dev only)

`src/integrations/gallery-admin.ts` (registered in `astro.config.mjs`) hooks `astro:server:setup` only, so it exists solely under `pnpm dev`: `/__admin/gallery` serves `gallery-admin.html` plus a JSON API that uploads / deletes images in `public/gallery/<id>/` and creates / edits / deletes albums in `src/data/gallery.json` (which `galleryConfig.ts` imports — don't move albums back into the TS file). It accepts loopback requests only, validates album ids and file names against path traversal, and re-runs `scripts/generate-lqips.ts` (debounced) after image changes. Nothing of it is emitted into `dist/`.

## Deployment

- **Vercel** (default, `vercel.json`)
- **Cloudflare Workers** (`wrangler.jsonc`, set `CF_WORKERS` env var)
- Static output to `dist/`

