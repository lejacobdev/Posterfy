/**
 * Composable blocks shared by the poster templates: palette strips, the meta
 * column, tracklists, headlines and the finishing passes.
 */

import type { RenderContext, Track } from '@/lib/types';
import { withAlpha } from '@/lib/color/color';
import {
  formatAlbumDuration,
  formatList,
  formatReleaseDate,
  formatTrackDuration,
} from '@/lib/utils/format';
import { drawGrain, drawHairline, drawVignette } from './effects';
import { drawScanCode } from './scancode';
import { getFontPair } from './fonts';
import {
  autoColumnCount,
  drawText,
  fitFontSize,
  measure,
  splitIntoColumns,
  truncate,
  wrapText,
  type FontSpec,
} from './text';

/** Font sizes are authored against a 1000-unit poster and scaled by the user. */
export function scaled(rc: RenderContext, size: number): number {
  return size * rc.spec.options.textScale;
}

export function displayFont(rc: RenderContext, size: number): FontSpec {
  const pair = getFontPair(rc.spec.options.fontPair);
  return {
    family: pair.fonts.display,
    size,
    weight: pair.displayWeight,
    letterSpacing: size * pair.displayTracking,
  };
}

export function bodyFont(rc: RenderContext, size: number, weight?: number): FontSpec {
  const pair = getFontPair(rc.spec.options.fontPair);
  return { family: pair.fonts.body, size, weight: weight ?? pair.bodyWeight, letterSpacing: 0 };
}

export function monoFont(rc: RenderContext, size: number, weight = 400): FontSpec {
  const pair = getFontPair(rc.spec.options.fontPair);
  return { family: pair.fonts.mono, size, weight, letterSpacing: size * 0.02 };
}

export function labelFont(rc: RenderContext, size: number): FontSpec {
  const pair = getFontPair(rc.spec.options.fontPair);
  return { family: pair.fonts.mono, size, weight: 400, letterSpacing: size * 0.06 };
}

export function posterTitle(rc: RenderContext): string {
  const { album, options } = rc.spec;
  const raw = options.titleOverride.trim() || album.title || 'Untitled album';
  return options.uppercaseTitle ? raw.toUpperCase() : raw;
}

export function posterArtist(rc: RenderContext): string {
  const { album, options } = rc.spec;
  const raw = options.artistOverride.trim() || album.artist || 'Unknown artist';
  return options.uppercaseTitle ? raw.toUpperCase() : raw;
}

export function contentBox(rc: RenderContext) {
  const margin = rc.width * rc.spec.options.margin;
  return {
    x: margin,
    y: margin,
    width: rc.width - margin * 2,
    height: rc.height - margin * 2,
    margin,
  };
}

export function drawBackground(rc: RenderContext): void {
  const { ctx, theme, width, height } = rc;
  ctx.save();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Solid palette bar — horizontal or vertical depending on the template. */
export function drawPaletteBar(
  rc: RenderContext,
  x: number,
  y: number,
  width: number,
  height: number,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): void {
  const colors = rc.theme.palette;
  if (colors.length === 0) return;
  const { ctx } = rc;
  ctx.save();
  if (orientation === 'horizontal') {
    const step = width / colors.length;
    colors.forEach((color, index) => {
      ctx.fillStyle = color;
      // Overlap by a hair so sub-pixel scaling never shows seams.
      ctx.fillRect(x + index * step, y, step + 0.5, height);
    });
  } else {
    const step = height / colors.length;
    colors.forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y + index * step, width, step + 0.5);
    });
  }
  ctx.restore();
}

export function drawPaletteDots(
  rc: RenderContext,
  x: number,
  y: number,
  size: number,
  gap: number,
): number {
  const colors = rc.theme.palette;
  const { ctx } = rc;
  ctx.save();
  colors.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + index * (size + gap) + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  return colors.length * (size + gap) - gap;
}

export function drawPalette(
  rc: RenderContext,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const style = rc.spec.options.paletteStyle;
  if (style === 'none') return;
  if (style === 'dots') {
    drawPaletteDots(rc, x, y, height, height * 0.55);
    return;
  }
  if (style === 'strip') {
    drawPaletteBar(rc, x, y, width, height * 0.55, 'horizontal');
    return;
  }
  drawPaletteBar(rc, x, y, width, height, 'horizontal');
}

export interface MetaEntry {
  label: string;
  value: string;
}

/** The `Release Year / Duration / Genres` column. */
export function metaEntries(rc: RenderContext, locale: string): MetaEntry[] {
  const { album, options } = rc.spec;
  const { labels } = rc;
  const entries: MetaEntry[] = [];

  if (options.showReleaseDate && album.releaseDate) {
    entries.push({
      label: labels.releaseDate,
      value: formatReleaseDate(album.releaseDate, locale),
    });
  }
  if (options.showDuration && album.totalDurationMs > 0) {
    entries.push({
      label: labels.duration,
      value: formatAlbumDuration(album.totalDurationMs, labels.minutes),
    });
  }
  if (options.showGenres && album.genres.length > 0) {
    entries.push({ label: labels.genres, value: formatList(album.genres, locale, 3) });
  }
  if (options.showLabel && album.label) {
    entries.push({ label: labels.label, value: album.label });
  }
  return entries;
}

export interface MetaColumnOptions {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  locale: string;
  align?: CanvasTextAlign;
}

export function drawMetaColumn(rc: RenderContext, options: MetaColumnOptions): number {
  const entries = metaEntries(rc, options.locale);
  if (entries.length === 0) return 0;

  const { ctx, theme } = rc;
  const { x, y, width, fontSize, align = 'left' } = options;
  const gap = fontSize * 1.85;
  let cursorY = y + fontSize;

  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';

  for (const entry of entries) {
    ctx.fillStyle = theme.muted;
    drawText(ctx, entry.label, x, cursorY, labelFont(rc, fontSize * 0.86));

    ctx.fillStyle = theme.foreground;
    const valueFont = monoFont(rc, fontSize, 700);
    drawText(
      ctx,
      truncate(ctx, entry.value, width, valueFont),
      x,
      cursorY + fontSize * 1.25,
      valueFont,
    );

    cursorY += gap + fontSize * 0.4;
  }
  ctx.restore();
  return cursorY - y;
}

export interface TracklistOptions {
  x: number;
  y: number;
  width: number;
  maxHeight: number;
  /** Upper bound for the type size; the block shrinks to fit. */
  fontSize: number;
  minFontSize?: number;
  showDurations?: boolean;
  columnsOverride?: number;
}

export interface TracklistResult {
  height: number;
  fontSize: number;
  columns: number;
}

/**
 * Draws the tracklist, choosing a column count and shrinking the type until the
 * whole list fits the space the template gave it. Long lists never overflow.
 */
export function drawTracklist(rc: RenderContext, options: TracklistOptions): TracklistResult {
  const { ctx, theme, spec } = rc;
  const tracks = spec.album.tracks;
  if (!spec.options.showTracklist || tracks.length === 0) {
    return { height: 0, fontSize: options.fontSize, columns: 0 };
  }

  const {
    x,
    y,
    width,
    maxHeight,
    fontSize: maxFontSize,
    minFontSize = 7,
    showDurations = false,
  } = options;

  const requested = spec.options.tracklistColumns;
  const maxColumns = requested === 'auto' ? 3 : requested;
  const columnCount =
    options.columnsOverride ??
    (requested === 'auto' ? autoColumnCount(tracks.length, 3) : Math.min(maxColumns, 3));

  const { columns } = splitIntoColumns(tracks, columnCount);
  const rows = columns.reduce((max, column) => Math.max(max, column.length), 0);
  const columnGap = width * 0.045;
  const columnWidth = (width - columnGap * (columns.length - 1)) / Math.max(1, columns.length);

  const label = (track: Track) => {
    const number = spec.options.showTrackNumbers ? `${track.position}. ` : '';
    return `${number}${track.title}`;
  };

  // Pick the largest size where every row fits vertically and horizontally.
  let fontSize = maxFontSize;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const lineHeight = fontSize * 1.62;
    const fitsHeight = rows * lineHeight <= maxHeight;
    const font = monoFont(rc, fontSize);
    const longest = tracks.reduce(
      (max, track) => Math.max(max, measure(ctx, label(track), font)),
      0,
    );
    const durationRoom = showDurations ? columnWidth * 0.2 : 0;
    const fitsWidth = longest <= columnWidth - durationRoom;
    if ((fitsHeight && fitsWidth) || fontSize <= minFontSize) break;
    fontSize = Math.max(minFontSize, fontSize - Math.max(0.25, fontSize * 0.04));
  }

  const lineHeight = fontSize * 1.62;
  const font = monoFont(rc, fontSize);

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  columns.forEach((column, columnIndex) => {
    const columnX = x + columnIndex * (columnWidth + columnGap);
    column.forEach((track, rowIndex) => {
      const rowY = y + fontSize + rowIndex * lineHeight;
      ctx.textAlign = 'left';
      ctx.fillStyle = theme.foreground;
      const durationText = showDurations ? formatTrackDuration(track.durationMs) : '';
      const durationWidth = durationText ? measure(ctx, durationText, font) + fontSize : 0;
      drawText(
        ctx,
        truncate(ctx, label(track), columnWidth - durationWidth, font),
        columnX,
        rowY,
        font,
      );
      if (durationText) {
        ctx.textAlign = 'right';
        ctx.fillStyle = theme.muted;
        drawText(ctx, durationText, columnX + columnWidth, rowY, font);
      }
    });
  });
  ctx.restore();

  return { height: rows * lineHeight, fontSize, columns: columns.length };
}

export interface HeadlineOptions {
  x: number;
  y: number;
  width: number;
  maxSize: number;
  maxLines?: number;
  align?: CanvasTextAlign;
  color?: string;
  lineHeight?: number;
}

export interface HeadlineResult {
  height: number;
  fontSize: number;
  lines: string[];
}

/** Sets a headline that shrinks and wraps until it fits the given box. */
export function drawHeadline(
  rc: RenderContext,
  text: string,
  options: HeadlineOptions,
): HeadlineResult {
  const { ctx, theme } = rc;
  const { x, y, width, maxSize, maxLines = 2, align = 'left', color, lineHeight = 1.02 } = options;
  if (!text) return { height: 0, fontSize: maxSize, lines: [] };

  let fontSize = maxSize;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const font = displayFont(rc, fontSize);
    lines = wrapText(ctx, text, width, font, maxLines);
    const fits = lines.every((line) => measure(ctx, line, font) <= width);
    if ((fits && lines.length <= maxLines) || fontSize <= maxSize * 0.35) break;
    fontSize -= Math.max(0.5, fontSize * 0.05);
  }

  const font = displayFont(rc, fontSize);
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color ?? theme.foreground;
  lines.forEach((line, index) => {
    drawText(ctx, line, x, y + fontSize + index * fontSize * lineHeight, font);
  });
  ctx.restore();

  return { height: lines.length * fontSize * lineHeight, fontSize, lines };
}

/** Single-line title that scales down instead of wrapping. */
export function drawFittedLine(
  rc: RenderContext,
  text: string,
  options: HeadlineOptions,
): HeadlineResult {
  const { ctx, theme } = rc;
  const { x, y, width, maxSize, align = 'left', color } = options;
  if (!text) return { height: 0, fontSize: maxSize, lines: [] };

  const base = displayFont(rc, maxSize);
  const fontSize = fitFontSize(ctx, text, width, base, maxSize * 0.3);
  const font = displayFont(rc, fontSize);

  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color ?? theme.foreground;
  drawText(ctx, text, x, y + fontSize, font);
  ctx.restore();

  return { height: fontSize, fontSize, lines: [text] };
}

export function drawRule(
  rc: RenderContext,
  x: number,
  y: number,
  width: number,
  weight = 1.6,
): void {
  drawHairline(rc.ctx, x, y, x + width, y, withAlpha(rc.theme.foreground, 0.35), weight);
}

export interface ScanBlockOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawScanBlock(rc: RenderContext, options: ScanBlockOptions): void {
  if (!rc.spec.options.showScanCode) return;
  drawScanCode(rc.ctx, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    color: rc.theme.foreground,
    background: rc.theme.background,
    seedSource: rc.spec.album.uri ?? rc.spec.album.id ?? rc.spec.album.title,
    image: rc.scanImage,
  });
}

export function drawCustomNote(
  rc: RenderContext,
  x: number,
  y: number,
  width: number,
  size: number,
  align: CanvasTextAlign = 'left',
): number {
  const note = rc.spec.options.customNote.trim();
  if (!note) return 0;
  const { ctx, theme } = rc;
  const font = labelFont(rc, size);
  ctx.save();
  ctx.textAlign = align;
  ctx.fillStyle = theme.muted;
  drawText(ctx, truncate(ctx, note, width, font), x, y + size, font);
  ctx.restore();
  return size * 1.6;
}

/** Grain and vignette are applied last so they sit over every other element. */
export function drawFinish(rc: RenderContext): void {
  const { options, album } = rc.spec;
  drawVignette(rc.ctx, rc.width, rc.height, options.vignette);
  drawGrain(rc.ctx, rc.width, rc.height, options.grain, (album.id || 'posterfy').length * 977 + 13);
}
