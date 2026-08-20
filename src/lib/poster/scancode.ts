/**
 * The scan strip printed next to the album title.
 *
 * Two sources are supported: the real Spotify scannable (fetched through the
 * image proxy when the album carries a `spotify:album:…` URI) and a locally
 * generated bar pattern that is derived deterministically from the album id, so
 * offline and non-Spotify posters still get the same visual rhythm.
 */

import { hashString, seededRandom } from '@/lib/utils/misc';
import type { LoadedCover } from '@/lib/types';

const BAR_COUNT = 23;

/** Builds the bar heights (0–1) for an album, stable across renders. */
export function scanBars(seedSource: string, count = BAR_COUNT): number[] {
  const random = seededRandom(hashString(seedSource || 'posterfy'));
  const bars: number[] = [];
  for (let i = 0; i < count; i += 1) {
    // Spotify codes read as a skyline: mostly mid-height with occasional peaks.
    const base = 0.35 + random() * 0.65;
    const peak = random() > 0.82 ? 1 : base;
    bars.push(Math.min(1, peak));
  }
  return bars;
}

export function drawScanBars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  seedSource: string,
): void {
  const bars = scanBars(seedSource);
  const gap = width / (bars.length * 2.1);
  const barWidth = (width - gap * (bars.length - 1)) / bars.length;
  const radius = barWidth / 2;

  ctx.save();
  ctx.fillStyle = color;
  bars.forEach((value, index) => {
    const barHeight = Math.max(barWidth, height * value);
    const bx = x + index * (barWidth + gap);
    const by = y + (height - barHeight) / 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx, by, barWidth, barHeight, radius);
    } else {
      ctx.rect(bx, by, barWidth, barHeight);
    }
    ctx.fill();
  });
  ctx.restore();
}

/**
 * The Spotify mark, as vector geometry on a 24×24 grid.
 *
 * The three waves are knocked out of the disc by the path's winding, so the
 * poster background shows through them — which is how the mark is meant to be
 * reproduced. Spotify's design guidelines allow a single-colour version where
 * full colour is not practical, which is the case on a printed poster, so the
 * glyph inherits the poster's foreground colour.
 */
const SPOTIFY_MARK_PATH =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z';

/** Draws the Spotify mark centred on `cx, cy`, sized to `radius`. */
export function drawSpotifyGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  holeColor: string,
): void {
  // Path2D renders the official geometry exactly; the arc fallback below keeps
  // the renderer working where it is unavailable (older engines, jsdom).
  if (typeof Path2D === 'function') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(cx - radius, cy - radius);
    const scale = (radius * 2) / 24;
    ctx.scale(scale, scale);
    ctx.fill(new Path2D(SPOTIFY_MARK_PATH));
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = holeColor;
  ctx.lineCap = 'round';
  const arcs = [
    { r: radius * 0.62, y: -radius * 0.28, w: radius * 0.2, spread: 0.95 },
    { r: radius * 0.46, y: radius * 0.02, w: radius * 0.17, spread: 0.9 },
    { r: radius * 0.3, y: radius * 0.3, w: radius * 0.14, spread: 0.85 },
  ];
  for (const arc of arcs) {
    ctx.lineWidth = arc.w;
    ctx.beginPath();
    const start = Math.PI + (Math.PI * (1 - arc.spread)) / 2;
    const end = Math.PI * 2 - (Math.PI * (1 - arc.spread)) / 2;
    ctx.arc(cx, cy + arc.y, arc.r, start, end);
    ctx.stroke();
  }
  ctx.restore();
}

export interface ScanCodeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  background: string;
  seedSource: string;
  /** Pre-loaded official scannable, when available. */
  image?: LoadedCover | null;
}

/** Draws either the fetched Spotify code or the generated equivalent. */
export function drawScanCode(ctx: CanvasRenderingContext2D, options: ScanCodeOptions): void {
  const { x, y, width, height, color, background, seedSource, image } = options;

  if (image) {
    const ratio = image.width / image.height;
    const drawHeight = Math.min(height, width / ratio);
    const drawWidth = drawHeight * ratio;
    ctx.drawImage(
      image.image,
      x + width - drawWidth,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    return;
  }

  const glyphRadius = height / 2;
  const glyphCx = x + glyphRadius;
  const glyphCy = y + height / 2;
  drawSpotifyGlyph(ctx, glyphCx, glyphCy, glyphRadius, color, background);

  const barsX = glyphCx + glyphRadius * 1.5;
  drawScanBars(ctx, barsX, y, x + width - barsX, height, color, seedSource);
}

/** URL of the official scannable for a Spotify URI, proxied to dodge CORS. */
export function spotifyScanUrl(uri: string, foreground: 'white' | 'black' = 'white'): string {
  const background = foreground === 'white' ? '000000' : 'ffffff';
  const target = `https://scannables.scdn.co/uri/plain/png/${background}/${foreground}/640/${encodeURIComponent(uri)}`;
  return `/api/image?url=${encodeURIComponent(target)}`;
}
