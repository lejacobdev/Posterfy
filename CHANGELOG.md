# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Easy/Advanced editing mode: a prominent toggle at the top of the editor
  sidebar switches between the default, simpler tab set and the fuller one
  that adds the Advanced (drag/resize) tab. The choice is remembered across
  visits and defaults to Easy for new users.
- Advanced mode is now a single, self-contained editing surface: switching
  to it drops the tab bar entirely (Album and Export fold into collapsed
  sections above and below it instead) and Design/Content go away, since
  their form fields would just be a second, conflicting way to change what
  Advanced already does directly. Selecting an element — on the canvas or
  in the panel's list, the same shared selection either way — now shows
  every edit that applies to it in one place: artwork upload for the cover,
  visibility toggles and tracklist reordering for the tracklist, palette
  swatches for the palette, and so on, alongside the position/size nudges
  that were already there. Any element with a free-text option — title,
  artist, custom note — can also be double-clicked (or selected and Enter
  pressed) to type into it right on the poster, PowerPoint-style,
  live-updating as you type.
- The homepage hero headline now rotates through five different taglines
  with an old-school typewriter effect — holding the fully-typed line, then
  backspacing it out and typing the next one in, complete with a blinking
  caret. Space is reserved for the tallest possible tagline, so nothing
  below the headline shifts as shorter or longer lines type in. Frozen on
  the first tagline with no caret for reduced-motion.
- Advanced editor mode: a new "Advanced" tab lets you drag any poster element
  (cover, title, artist, tracklist, palette, scan code, custom note) directly
  on the live preview to move or resize it, or dial it in with numeric
  horizontal/vertical/size fields in a side panel — both stay in sync, and
  every nudge folds into the same undo/redo history as everything else. A
  poster with no manual adjustments renders exactly as before; the
  per-element position/size deltas are stored separately from each
  template's own layout math rather than replacing it.
- Four new curated font pairings — Humanist, Typewriter, Literary and Impact —
  alongside the original Mono, Grotesk, Editorial and Condensed, doubling the
  type library. All are self-hosted or safe cross-platform system stacks, so
  there's no upload step and no extra assets to fetch.
- Custom templates: save the current design (template, colours, type, every
  finishing slider, and any advanced-mode position/size tweaks) as a named
  template from the Design panel, then apply it to a completely different
  album later — the album's own title, artist and note are left alone, only
  the design changes. Saved templates persist locally and can be renamed or
  removed.
- A "make your playlist public" explainer in playlist search: Spotify only
  serves playlist tracks to this app for playlists set to public, so the
  toggle now surfaces a collapsible guide — a small CSS mock of the ••• menu,
  the public toggle and the copy-link action, plus plain-text steps for
  screen readers and reduced-motion — rather than a screenshot that would
  drift out of sync with Spotify's own UI.
- Playlist posters: search toggles between Albums and Playlists (Spotify only —
  there is no keyless fallback for playlists). A chosen playlist is normalised
  server-side into the same shape an album takes, so it flows through every
  template, undo/redo and export unchanged; a playlist's mixed authorship
  shows up as a per-track artist line in the tracklist, and its curator
  becomes the poster's "artist".
- My Posters (`/posters`): every album or playlist you've posterised is saved
  automatically and listed most-recently-edited first, with a thumbnail,
  relative time and a one-click reopen back into the editor exactly as you
  left it. The editor's empty state now surfaces the four most recent as a
  shortcut back in, alongside starting a new search.
- Album search also matches by song title. Spotify search now asks for tracks
  alongside albums in the same request; a song's album is added to the results
  with a note showing which track matched, and the fuzzy ranker scores that
  track title alongside the album's own so it isn't dropped for scoring 0
  against unrelated album text. An album Spotify's own album search already
  matched — evidently by track content it never exposes — gets the same
  track name backfilled from the track results rather than left unscoreable.
- `/api/health?spotify=1` runs one real Spotify search and reports what came
  back — configured, ok, HTTP status, latency — never the credentials.
- Search result covers load sooner: the page preconnects to Spotify's image
  CDN, so the first thumbnail costs one round trip instead of a DNS lookup, TCP
  handshake and TLS negotiation first. Cover Art Archive thumbnails route
  through the image proxy, which resolves their redirect to a second host
  server-side and lets the CDN cache the result. The first rows load eagerly
  and carry their intrinsic size, so the list no longer reflows as they arrive.
- Search result caching: an exact repeat answers from memory, and a shorter
  query already fetched is re-ranked to fill the list while the real response
  is in flight. The debounce dropped from 320 ms to 180 ms, and the provider
  config is prefetched so the first search is one round trip rather than two.
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

### Changed

- Toned down the site's colour palette and gradient buttons. The brand hue
  moved from a bright, saturated violet to a more muted indigo, the hero's
  gradient text dropped from a three-stop rainbow to a plain two-stop fade,
  and the background aurora blobs are now fewer, softer and slower rather
  than a fast-drifting neon wash. The primary button is now genuinely
  transparent at rest, like the ghost/outline buttons, with just a thin
  gradient ring around it; the gradient fill and glow are reserved for
  hover, instead of glowing constantly.
- Swapped which demo poster reads as left vs. middle in the homepage hero's
  3D stack.

### Fixed

- The hero tagline's typewriter effect visibly reflowed already-typed
  letters as more of the line was revealed: sliced text plus centered/
  wrapped layout meant each new character could change the wrap points or
  re-center the whole line, dragging earlier letters sideways. Both the
  lead and accent halves now always render their full text — only a
  hidden run's opacity toggles, never whether it's in the DOM — so the
  line's width and wrap points are fixed for the whole reveal and a typed
  letter never moves again once it appears.
- The wizard's step rail (Record → Look → Size → Contents → Finish) was
  only centered below 600px; `justify-content: center` had been scoped to
  that one mobile media query, so on every wider screen the steps sat
  flush against the left edge instead. Centered by default everywhere.
- The template gallery only had 4 demo albums for 6 templates plus 6 style
  presets, so several cards silently reused the same record — most visibly,
  Split showed Classic's album and Duotone showed Editorial's, making
  templates that are actually quite different look like duplicates. Added 8
  more demo albums (12 total) and offset the preset section's index past the
  template section's, so all 12 gallery cards now show a distinct record.
- The playlist-import "make it public" mock animation was cropped on mobile:
  its panel centers the mock beside the steps list at their own width for a
  side-by-side row, but the mobile layout only switched to a stacked column
  without also switching to stretch — so both items shrank to their content's
  intrinsic width instead of the panel's full width, and the mock's
  absolutely positioned menu (built for its real ~220px design width)
  overflowed past its own clipped edge.
- My Posters overflowed horizontally on mobile: a long title on `.poster-card`
  (a flex item inside the CSS grid) hit the classic `min-width: auto` trap —
  without an explicit `min-width: 0`, the card refused to shrink below its
  nowrap title's full intrinsic width, dragging the whole page wider than the
  viewport. Same fix for any future long title.
- The language picker menu could blow out the mobile header's width: it sets
  `position: absolute`, but shares a class with `.glass`, which also sets
  `position: relative` at equal specificity — so the winner depended on CSS
  import order alone, and it was losing, turning the dropdown into an in-flow
  flex item. Bumped both it and the album-search results panel (same trap,
  same class combination, still winning today only by coincidence of import
  order) to a two-class selector so the correct value always wins.
- The genres and record label toggles now actually show something. Spotify's
  `genres` field is consistently empty on this app's tier — both the album's
  own and, per live testing, the artist's as well — and `label` is frequently
  null too, so toggling either on drew nothing to draw. Both now fall back to
  a MusicBrainz lookup by title and artist when Spotify came back empty,
  which reliably carries both; a MusicBrainz-native album's genres, which
  were hardcoded to an empty list, come from the same lookup. Getting the
  MusicBrainz side of it right took two follow-up fixes, both confirmed live:
  Spotify's title often carries an edition suffix ("Abbey Road (Remastered)")
  no MusicBrainz release-group is actually titled, so the search strips it
  first; and the query searched `release` (the titles of the releases filed
  under a group, which for an edition-heavy one rarely includes the plain
  name) rather than `releasegroup` (the group's own canonical title). A
  MusicBrainz 503 under its own load (it enforces roughly one request a
  second) still leaves an album's genres/label unfilled that one time, same as
  any other optional enrichment in this file.
- Enter no longer opens the first result on its own. It used to fall back to
  the top-ranked row whenever nothing was highlighted, silently choosing an
  album the user hadn't picked; now it only opens the row explicitly reached
  with the arrow keys.
- Search now actually answers from Spotify instead of MusicBrainz on ordinary
  queries. The detail added just above traced it to the real cause: this app's
  search endpoint isn't approved for Extended Quota Mode, so it 400s above 10
  results — even Spotify's own documented default of 20 fails — while a
  request only asks for one result and stayed healthy. Every real search asks
  for 24, to rank a shorter list from, so it 400'd and fell back every single
  time; the health probe never noticed. The limit sent to Spotify is now
  capped to what this app is actually allowed, in both the search path and the
  probe.
- A Spotify search failure that falls back to MusicBrainz now carries Spotify's
  own error message (`detail`), not just the HTTP status. A 400 and a 403 used
  to look identical from outside a server log — an unsupported market, a
  malformed query and a restricted app all just read `spotify_request_failed`
  — so diagnosing one meant guessing. `/api/health?spotify=1` reports the same
  detail for a probed failure.
- Search and album lookups no longer get killed by Vercel's 10-second function
  ceiling. Retries and fallbacks (Spotify retry, MusicBrainz fallback, Spotify
  cover cross-lookup, track pagination) each used to get a full timeout of
  their own with no shared limit, so a chain of them could add up to well past
  10s and have the whole function killed with an opaque platform error instead
  of our own. Every upstream call in a chain now shares one deadline: a link
  that runs long leaves less for what follows, and once too little remains a
  further call is skipped rather than attempted — returning a clear, fast
  error, or in the case of track pagination, whatever pages were already
  fetched, rather than nothing. `/api/image` is unaffected by this budget: it's
  a single hop with nothing to fall back to afterward, so it keeps its own
  larger, independent timeout — raised, since Cover Art Archive's redirect to
  archive.org is occasionally slow enough on its own to need it.
- Album search no longer degrades to MusicBrainz over a Spotify hiccup. A
  cached token rotated while a serverless instance stayed warm, or a single
  Spotify 5xx, used to drop the whole search to the keyless provider; both are
  now retried once. Other statuses (400/403/429) are still reported rather than
  repeated, and the reason now travels in the response so a fallback can be
  diagnosed from a browser.
- Live search no longer paints stale results. Four races are gone: a response
  landing after the box was cleared repopulated the list; a slow response could
  overwrite a newer one; the spinner switched off when a superseded request
  aborted; and a response landing after an album was chosen reopened the
  dropdown. Enter also no longer opens an album from the previous query while a
  newer search is still in flight.
- The Vinyl template no longer paints lit squares in its sleeve's top corners.
  The sleeve-opening highlight was a square `fillRect` over a rounded sleeve,
  so it filled the space the corner radius had cut away; it is now clipped to
  the sleeve.
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
- Poster meta values (release year, duration, genres, label) no longer carry a
  leading `>`, which read as a "greater than" rather than the arrow it meant.
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
