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

/** The Spotify mark: a filled circle with three concentric “signal” arcs. */
export function drawSpotifyGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  holeColor: string,
): void {
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
