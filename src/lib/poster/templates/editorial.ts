/**
 * Editorial — magazine cover treatment: artist kicker, an oversized headline
 * that wraps, framed artwork, then a horizontal credits row and tracklist.
 */

import type { RenderContext } from '@/lib/types';
import { withAlpha } from '@/lib/color/color';
import {
  bodyFont,
  contentBox,
  drawBackground,
  drawCustomNote,
  drawHeadline,
  drawPalette,
  drawRule,
  drawScanBlock,
  drawTracklist,
  labelFont,
  metaEntries,
  posterArtist,
  posterTitle,
  scaled,
} from '../blocks';
import { drawCoverPlaceholder, drawImageBox } from '../effects';
import { drawText, truncate } from '../text';

export function renderEditorial(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const box = contentBox(rc);
  const { ctx, theme } = rc;
  const gap = rc.height * 0.022;
  const kickerSize = scaled(rc, box.width * 0.028);

  let cursorY = box.y;

  // Kicker: artist name over a hairline.
  ctx.save();
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'left';
  drawText(ctx, posterArtist(rc), box.x, cursorY + kickerSize, labelFont(rc, kickerSize));
  ctx.restore();
  cursorY += kickerSize * 1.6;
  drawRule(rc, box.x, cursorY, box.width, Math.max(1, rc.width * 0.0015));
  cursorY += gap;

  const headline = drawHeadline(rc, posterTitle(rc), {
    x: box.x,
    y: cursorY,
    width: box.width,
    maxSize: scaled(rc, box.width * 0.135),
    maxLines: 2,
    lineHeight: 1.04,
  });
  cursorY += headline.height + gap * 1.2;

  // Reserve the bottom block, then give whatever is left to the artwork.
  const metaSize = scaled(rc, box.width * 0.024);
  const tracklistSize = scaled(rc, box.width * 0.025);
  const bottomHeight = Math.min(box.height * 0.34, metaSize * 4 + tracklistSize * 8);
  const coverHeight = Math.max(
    box.width * 0.35,
    box.height - (cursorY - box.y) - bottomHeight - gap,
  );
  const coverWidth = box.width;

  drawArtwork(rc, box.x, cursorY, coverWidth, coverHeight);
  cursorY += coverHeight + gap;

  if (rc.spec.options.paletteStyle !== 'none') {
    drawPalette(rc, box.x, cursorY, box.width, rc.height * 0.012);
    cursorY += rc.height * 0.012 + gap * 0.8;
  }

  // Credits laid out horizontally, newspaper style.
  const entries = metaEntries(rc, locale);
  if (entries.length > 0) {
    const cellWidth = box.width / entries.length;
    ctx.save();
    ctx.textAlign = 'left';
    entries.forEach((entry, index) => {
      const x = box.x + index * cellWidth;
      ctx.fillStyle = theme.muted;
      drawText(
        ctx,
        entry.label.toUpperCase(),
        x,
        cursorY + metaSize * 0.9,
        labelFont(rc, metaSize * 0.8),
      );
      ctx.fillStyle = theme.foreground;
      const valueFont = bodyFont(rc, metaSize * 1.15, 700);
      drawText(
        ctx,
        truncate(ctx, entry.value, cellWidth * 0.94, valueFont),
        x,
        cursorY + metaSize * 2.4,
        valueFont,
      );
    });
    ctx.restore();
    cursorY += metaSize * 3.4;
  }

  const scanWidth = rc.spec.options.showScanCode ? box.width * 0.22 : 0;
  const tracklistWidth = box.width - (scanWidth > 0 ? scanWidth + box.width * 0.04 : 0);
  const remaining = box.y + box.height - cursorY;

  drawTracklist(rc, {
    x: box.x,
    y: cursorY,
    width: tracklistWidth,
    maxHeight: Math.max(0, remaining - metaSize * 1.4),
    fontSize: tracklistSize,
    showDurations: rc.spec.album.tracks.length <= 14,
  });

  if (scanWidth > 0) {
    drawScanBlock(rc, {
      x: box.x + box.width - scanWidth,
      y: box.y + box.height - metaSize * 2.6,
      width: scanWidth,
      height: metaSize * 1.5,
    });
  }

  drawCustomNote(rc, box.x, box.y + box.height - metaSize, tracklistWidth, metaSize * 0.85);
}

function drawArtwork(rc: RenderContext, x: number, y: number, width: number, height: number): void {
  const { options } = rc.spec;
  const radius = (Math.min(width, height) / 2) * options.coverRadius;
  const frame = rc.width * 0.012;

  // The frame is a lighter card that the artwork sits inside.
  rc.ctx.save();
  rc.ctx.fillStyle = withAlpha(rc.theme.foreground, 0.08);
  rc.ctx.fillRect(x, y, width, height);
  rc.ctx.restore();

  const inner = { x: x + frame, y: y + frame, w: width - frame * 2, h: height - frame * 2 };
  if (rc.cover) {
    drawImageBox(rc.ctx, rc.cover, inner.x, inner.y, inner.w, inner.h, {
      radius: Math.max(0, radius - frame),
      border: options.showCoverBorder
        ? { width: rc.width * 0.003, color: withAlpha(rc.theme.foreground, 0.5) }
        : null,
    });
    return;
  }
  drawCoverPlaceholder(rc.ctx, inner.x, inner.y, inner.w, inner.h, Math.max(0, radius - frame), {
    from: rc.theme.palette[0] ?? '#222',
    to: rc.theme.palette[rc.theme.palette.length - 1] ?? '#666',
    mark: rc.theme.foreground,
  });
}
