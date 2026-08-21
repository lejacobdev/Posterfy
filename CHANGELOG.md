# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Fuzzy ranking on album search results (`src/lib/search/fuzzy.ts`): accent and
  punctuation folding, typo tolerance via bounded optimal-string-alignment
  distance, `artist - album` query splitting, and tie-breaks that prefer the
  full album over a single and the original pressing over a reissue. Search now
  over-fetches 24 results and shows the best 12.
- Vercel Speed Insights on the hosted site.
- Guided poster wizard at `/create`: five steps — record, look, size, contents,
  finish — with a live preview beside the choices and per-preset previews
  rendered from the chosen artwork. Ends with a one-tap PNG download or a
  hand-off to the editor.

### Fixed

- Style presets are applied as a starting point rather than a layer. Because
  presets are partial, picking Vinyl Club and then Editorial Press used to
  leave Vinyl Club's rounded artwork and vignette behind — the wizard's style
  previews visibly changed zoom and gained rounded corners as you clicked
  through them. Applying a preset now resets every option any preset controls,
  and the wizard's cards render each preset's own look instead of the preset
  laid over the current poster.

### Changed

- The editor moved from `/create` to `/editor`, and the header nav item is now
  **Editor**. `/create` opens the wizard; the "Start creating" call to action
  still points there.
- Search results request Spotify's smallest artwork (64 px) instead of the
  300 px image, which is what the 46 px result thumbnails actually need.
- The privacy policy, about page and README now describe the anonymous
  page-speed measurement instead of claiming there is no analytics at all.
- Poster previews and exports select their artwork through `selectCoverUrl`,
  which falls back in both directions instead of only from hi-res to small.

## [1.0.0] — 2026-08-20

First release.

### Added

**Poster engine**

- Canvas 2D renderer working on a 1000-unit design grid, shared by the preview and the export so both are pixel-identical.
- Six templates: Classic, Editorial, Minimal, Vinyl, Split, Duotone.
- Five formats: 2:3 portrait, A-series, square, 9:16 story, 3:2 landscape — with landscape-specific layouts where a template needs one.
- Four type pairings (Mono, Grotesk, Editorial, Condensed) using self-hosted Archivo and Space Mono.
- Palette extraction from artwork by median-cut quantisation, with WCAG contrast enforcement on every text colour.
- Tracklist auto-fitting: column count and type size adapt until the list fits.
- Film grain, vignette, margin, corner radius and text scale controls.
- Spotify scan codes, with a deterministic generated bar pattern as the fallback.
- Export to PNG, JPEG and WebP at four sizes up to 300 DPI, plus Web Share and clipboard.

**Data**

- Spotify search and album lookup through a server-side proxy that keeps the client secret off the browser.
- Keyless MusicBrainz + Cover Art Archive provider, used automatically when Spotify is not configured.
- Optional browser-stored Spotify credentials for static deployments.
- Manual album entry with artwork upload and full tracklist editing.
- CORS-safe image proxy with a host allowlist.

**Interface**

- Landing page, editor, template gallery, FAQ, about, settings, privacy, terms and 404 pages.
- Live search with debouncing, request cancellation, keyboard navigation and link pasting.
- Mobile-first editor: sticky preview, tabbed panels, touch-sized controls, persistent download bar.
- Glass surfaces, an animated ambient background and scroll-driven CSS 3D scenes.
- Undo/redo with drag coalescing, plus `Cmd/Ctrl+Z` shortcuts.
- Six languages with automatic detection from browser language and device time zone.
- Light, dark and system themes; an in-app reduce-motion switch.

**Platform**

- Installable PWA with offline editing and export.
- SEO: per-route meta tags, canonical URLs, FAQ structured data, sitemap and robots.
- Zero-dependency Node server, Dockerfile, Vercel function and GitHub Pages workflow.
- 142 unit and component tests, ESLint, Prettier and a typecheck in CI.
