/**
 * Domain types shared by the data providers, the poster renderer and the UI.
 */

export type ProviderId = 'spotify' | 'musicbrainz' | 'manual';

/**
 * What kind of thing this is standing in for `Album`'s shape. Absent means
 * 'album' — every pre-existing `Album`/`AlbumSummary` in the wild, and every
 * one an album provider produces, simply never sets this field. Only a
 * Spotify playlist, normalised into the same shape so the rest of the poster
 * pipeline needs no changes to draw one, sets it to `'playlist'`.
 */
export type SubjectKind = 'album' | 'playlist';

export interface Track {
  /** 1-based position inside the album. */
  position: number;
  title: string;
  durationMs: number;
  discNumber?: number;
  explicit?: boolean;
  /** A playlist track's own artist, which can differ from `Album.artist`. */
  artist?: string;
}

export interface Album {
  id: string;
  source: ProviderId;
  kind?: SubjectKind;
  title: string;
  artist: string;
  /** ISO-ish date as returned by the provider: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  releaseDate: string;
  coverUrl: string | null;
  /** Highest resolution artwork the provider offers, used for exports. */
  coverUrlHiRes: string | null;
  tracks: Track[];
  genres: string[];
  label: string | null;
  totalDurationMs: number;
  /** `spotify:album:…` when known — drives the scan code. */
  uri: string | null;
  externalUrl: string | null;
}

export interface AlbumSummary {
  id: string;
  source: ProviderId;
  kind?: SubjectKind;
  title: string;
  artist: string;
  releaseDate: string;
  coverUrl: string | null;
  totalTracks: number;
  /** Set when this album surfaced because one of its songs matched the search, not the album title itself. */
  matchedTrack?: string;
}

export type TemplateId = 'classic' | 'editorial' | 'minimal' | 'vinyl' | 'split' | 'duotone';

export type FormatId = 'portrait' | 'a-series' | 'square' | 'story' | 'landscape';

export type FontPairId =
  | 'mono'
  | 'grotesk'
  | 'editorial'
  | 'condensed'
  | 'humanist'
  | 'typewriter'
  | 'literary'
  | 'impact';

export type PaletteStyle = 'bar' | 'dots' | 'strip' | 'none';

/**
 * Every element a template can position independently. Not every template
 * draws every one of these (`minimal` has no `meta` column, `vinyl` has no
 * plain `tracklist`) — an id simply never appears in a given render's layout
 * registry when that template doesn't draw it.
 */
export type ElementId =
  'cover' | 'title' | 'artist' | 'meta' | 'tracklist' | 'palette' | 'scanCode' | 'customNote';

/**
 * A user's manual adjustment to one element, in 1000-unit design-grid units
 * — the same space templates already draw in. `dx`/`dy` nudge it from the
 * template's own computed position (0,0 = untouched); `scale` grows/shrinks
 * it anchored at its own top-left corner, so an override-free poster renders
 * byte-identical to one with an empty `layoutOverrides`.
 */
export interface LayoutOverride {
  dx: number;
  dy: number;
  scale: number;
}

/** Where an element actually ended up, in design-grid units — for hit-testing. */
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterOptions {
  template: TemplateId;
  format: FormatId;
  fontPair: FontPairId;

  /** Colours sampled from the artwork, or overridden by the user. */
  palette: string[];
  background: string;
  foreground: string;
  accent: string;
  /** When true the background/foreground follow the artwork palette. */
  autoColors: boolean;

  titleOverride: string;
  artistOverride: string;
  /** Free-form line printed in the footer (studio, dedication, date…). */
  customNote: string;

  showTracklist: boolean;
  showReleaseDate: boolean;
  showDuration: boolean;
  showGenres: boolean;
  showLabel: boolean;
  showScanCode: boolean;
  showTrackNumbers: boolean;
  showCoverBorder: boolean;
  uppercaseTitle: boolean;
  paletteStyle: PaletteStyle;

  /** 0 = square corners, 1 = heavily rounded. */
  coverRadius: number;
  /** Outer margin as a fraction of the poster width. */
  margin: number;
  /** Film grain intensity, 0–1. */
  grain: number;
  /** Corner darkening, 0–1. */
  vignette: number;
  /** 'auto' balances columns based on the track count. */
  tracklistColumns: 'auto' | 1 | 2 | 3;
  /** Multiplies every font size in the layout. */
  textScale: number;

  /** Advanced-mode per-element position/size adjustments. Empty = untouched. */
  layoutOverrides: Partial<Record<ElementId, LayoutOverride>>;
}

export interface PosterSpec {
  album: Album;
  options: PosterOptions;
}

/** A cover image that is safe to draw on an exportable canvas. */
export interface LoadedCover {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  /**
   * Poster size in design units. Templates always draw on a 1000-unit wide
   * grid; the renderer scales the context so the same code produces a small
   * preview or a print-resolution export.
   */
  width: number;
  height: number;
  /** Multiplier from the 1000-unit design grid to device pixels. */
  scale: number;
  /** Final bitmap size in device pixels. */
  pixelWidth: number;
  pixelHeight: number;
  cover: LoadedCover | null;
  /** Official Spotify scannable, when it could be fetched. */
  scanImage: LoadedCover | null;
  spec: PosterSpec;
  /** Resolved colours after auto-colour and contrast fixing. */
  theme: ResolvedTheme;
  fonts: ResolvedFonts;
  /** Translated labels drawn on the poster itself. */
  labels: PosterLabels;
  /**
   * Where each element actually ended up this render, in design-grid units —
   * populated by `withOverride()` as templates draw. Read back after
   * `renderPoster()` returns (via its `onLayout` callback) to drive the
   * advanced-mode drag/select overlay; irrelevant to the pixels themselves.
   */
  layout: Map<ElementId, LayoutBox>;
}

export interface ResolvedTheme {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  palette: string[];
}

export interface ResolvedFonts {
  display: string;
  body: string;
  mono: string;
}

export interface PosterLabels {
  releaseDate: string;
  duration: string;
  genres: string;
  label: string;
  tracks: string;
  minutes: string;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  /** Long-edge resolution in pixels. */
  width: number;
  quality: number;
  filename: string;
}
