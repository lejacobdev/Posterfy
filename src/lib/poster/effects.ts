/** Reusable canvas drawing primitives: shapes, artwork fitting, grain, vignette. */

import { seededRandom } from '@/lib/utils/misc';
import { withAlpha } from '@/lib/color/color';
import type { LoadedCover } from '@/lib/types';

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  if (r === 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.restore();
}

export interface DrawImageBoxOptions {
  radius?: number;
  /** 'cover' crops to fill, 'contain' letterboxes inside the box. */
  fit?: 'cover' | 'contain';
  shadow?: { blur: number; y: number; color: string } | null;
  border?: { width: number; color: string } | null;
}

/** Draws artwork into a box, cropping from the centre like `object-fit: cover`. */
export function drawImageBox(
  ctx: CanvasRenderingContext2D,
  cover: LoadedCover,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DrawImageBoxOptions = {},
): void {
  const { radius = 0, fit = 'cover', shadow = null, border = null } = options;

  if (shadow) {
    ctx.save();
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetY = shadow.y;
    ctx.shadowColor = shadow.color;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.clip();

  const sourceRatio = cover.width / cover.height;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  const shouldMatchWidth = fit === 'cover' ? sourceRatio < boxRatio : sourceRatio > boxRatio;
  if (shouldMatchWidth) {
    drawWidth = width;
    drawHeight = width / sourceRatio;
  } else {
    drawHeight = height;
    drawWidth = height * sourceRatio;
  }

  ctx.drawImage(
    cover.image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();

  if (border && border.width > 0) {
    ctx.save();
    ctx.strokeStyle = border.color;
    ctx.lineWidth = border.width;
    roundedRectPath(
      ctx,
      x + border.width / 2,
      y + border.width / 2,
      width - border.width,
      height - border.width,
      Math.max(0, radius - border.width / 2),
    );
    ctx.stroke();
    ctx.restore();
  }
}

/** Placeholder artwork so the poster still composes before a cover is picked. */
export function drawCoverPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  colors: { from: string; to: string; mark: string },
): void {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, colors.from);
  gradient.addColorStop(1, colors.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  // Concentric rings, echoing a record without needing an external asset.
  ctx.strokeStyle = withAlpha(colors.mark, 0.28);
  const cx = x + width / 2;
  const cy = y + height / 2;
  for (let i = 1; i <= 6; i += 1) {
    ctx.lineWidth = width * 0.004;
    ctx.beginPath();
    ctx.arc(cx, cy, (Math.min(width, height) / 2) * (i / 7), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = withAlpha(colors.mark, 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Film grain. Rendered from a seeded PRNG into a small tile that is then
 * repeated, which keeps a 6000px export from spending seconds on noise.
 */
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  seed = 1,
): void {
  if (intensity <= 0) return;
  const tileSize = 128;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;

  let tileCtx: CanvasRenderingContext2D | null = null;
  try {
    tileCtx = tile.getContext('2d');
  } catch {
    // Environments without a canvas implementation simply skip the grain.
    return;
  }
  if (!tileCtx) return;

  const imageData = tileCtx.createImageData(tileSize, tileSize);
  const random = seededRandom(seed);
  const alpha = Math.round(255 * Math.min(0.5, intensity * 0.35));
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = Math.round(random() * 255);
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
    imageData.data[i + 3] = alpha;
  }
  tileCtx.putImageData(imageData, 0, 0);

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(1, intensity);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
): void {
  if (intensity <= 0) return;
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.75, intensity * 0.7)})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawHairline(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Duotone-maps artwork between two colours, used by the duotone template. */
export function drawDuotoneImage(
  ctx: CanvasRenderingContext2D,
  cover: LoadedCover,
  x: number,
  y: number,
  width: number,
  height: number,
  shadowColor: string,
  highlightColor: string,
  radius = 0,
): void {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.clip();

  ctx.fillStyle = shadowColor;
  ctx.fillRect(x, y, width, height);

  ctx.globalCompositeOperation = 'luminosity';
  drawImageBox(ctx, cover, x, y, width, height, { fit: 'cover' });

  ctx.globalCompositeOperation = 'lighten';
  ctx.fillStyle = shadowColor;
  ctx.fillRect(x, y, width, height);

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = highlightColor;
  ctx.fillRect(x, y, width, height);

  ctx.restore();
}
