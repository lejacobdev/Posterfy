/**
 * Vinyl — the record slipping out of its sleeve, with the tracklist split into
 * an A and a B side. The disc is drawn procedurally (grooves, label, spindle)
 * so it needs no external assets.
 */

import type { RenderContext } from '@/lib/types';
import { withAlpha } from '@/lib/color/color';
import {
  contentBox,
  drawBackground,
  drawCustomNote,
  drawFittedLine,
  drawHeadline,
  drawMetaColumn,
  drawPaletteDots,
  drawRule,
  drawScanBlock,
  labelFont,
  monoFont,
  posterArtist,
  posterTitle,
  scaled,
} from '../blocks';
import { drawCoverPlaceholder, drawImageBox, roundedRectPath } from '../effects';
import { drawText, splitIntoColumns, truncate } from '../text';

export function renderVinyl(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const box = contentBox(rc);
  const { ctx, theme, spec } = rc;
  const gap = rc.height * 0.026;

  const titleSize = scaled(rc, box.width * 0.062);
  const artistSize = scaled(rc, box.width * 0.03);
  const metaSize = scaled(rc, box.width * 0.022);

  const bottomBlock = titleSize * 1.6 + artistSize * 2 + metaSize * 7 + gap * 2;
  const sleeveSize = Math.max(
    box.width * 0.42,
    Math.min(box.width * 0.72, box.height - bottomBlock - gap),
  );

  const sleeveX = box.x;
  const sleeveY = box.y;

  // Disc first so the sleeve overlaps it, selling the "slipping out" look.
  const discRadius = sleeveSize * 0.46;
  const discCx = sleeveX + sleeveSize + sleeveSize * 0.2;
  const discCy = sleeveY + sleeveSize / 2;
  drawDisc(rc, discCx, discCy, discRadius);

  drawSleeve(rc, sleeveX, sleeveY, sleeveSize);

  let cursorY = sleeveY + sleeveSize + gap * 1.3;

  const title = drawHeadline(rc, posterTitle(rc), {
    x: box.x,
    y: cursorY,
    width: box.width,
    maxSize: titleSize,
    maxLines: 2,
  });
  cursorY += title.height + gap * 0.3;

  const artist = drawFittedLine(rc, posterArtist(rc), {
    x: box.x,
    y: cursorY,
    width: box.width * 0.8,
    maxSize: artistSize,
    color: theme.accent,
  });
  cursorY += artist.fontSize * 1.7;

  drawRule(rc, box.x, cursorY, box.width, Math.max(1, rc.width * 0.0014));
  cursorY += gap * 0.8;

  const sidesTop = cursorY;
  const metaWidth = box.width * 0.26;
  drawMetaColumn(rc, {
    x: box.x,
    y: sidesTop,
    width: metaWidth,
    fontSize: metaSize,
    locale,
  });

  if (spec.options.showTracklist && spec.album.tracks.length > 0) {
    drawSides(rc, {
      x: box.x + metaWidth + box.width * 0.04,
      y: sidesTop,
      width: box.width - metaWidth - box.width * 0.04,
      maxHeight: Math.max(0, box.y + box.height - sidesTop - metaSize * 2.4),
      fontSize: scaled(rc, box.width * 0.024),
    });
  }

  if (spec.options.paletteStyle === 'dots' && theme.palette.length > 0) {
    const dotSize = box.width * 0.016;
    drawPaletteDots(rc, box.x, box.y + box.height - dotSize, dotSize, dotSize * 0.6);
  }

  if (spec.options.showScanCode) {
    const scanWidth = box.width * 0.22;
    drawScanBlock(rc, {
      x: box.x + box.width - scanWidth,
      y: box.y + box.height - metaSize * 1.9,
      width: scanWidth,
      height: metaSize * 1.4,
    });
  }

  ctx.save();
  drawCustomNote(rc, box.x, box.y + box.height - metaSize * 3.4, box.width * 0.6, metaSize * 0.85);
  ctx.restore();
}

function drawSleeve(rc: RenderContext, x: number, y: number, size: number): void {
  const { ctx, theme } = rc;
  const radius = (size / 2) * rc.spec.options.coverRadius * 0.2;

  ctx.save();
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.02;
  ctx.shadowColor = withAlpha('#000000', 0.45);
  ctx.fillStyle = theme.background;
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.fill();
  ctx.restore();

  if (rc.cover) {
    drawImageBox(rc.ctx, rc.cover, x, y, size, size, {
      radius,
      border: { width: rc.width * 0.002, color: withAlpha(theme.foreground, 0.25) },
    });
  } else {
    drawCoverPlaceholder(ctx, x, y, size, size, radius, {
      from: theme.palette[0] ?? '#222',
      to: theme.palette[theme.palette.length - 1] ?? '#666',
      mark: theme.foreground,
    });
  }

  // Sleeve opening: a soft highlight along the top edge.
  //
  // Clipped to the sleeve. Without this the highlight is a square fillRect
  // over a rounded sleeve, so it paints two lit squares in the space the
  // rounded corners cut away — visible as notched top corners.
  ctx.save();
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  const gradient = ctx.createLinearGradient(x, y, x, y + size * 0.06);
  gradient.addColorStop(0, withAlpha('#ffffff', 0.22));
  gradient.addColorStop(1, withAlpha('#ffffff', 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, size, size * 0.06);
  ctx.restore();
}

function drawDisc(rc: RenderContext, cx: number, cy: number, radius: number): void {
  const { ctx, theme } = rc;

  ctx.save();
  ctx.fillStyle = '#0b0b0d';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Grooves.
  ctx.strokeStyle = withAlpha('#ffffff', 0.09);
  for (let i = 0; i < 26; i += 1) {
    const r = radius * (0.42 + (i / 26) * 0.56);
    ctx.lineWidth = radius * 0.004;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Sheen across the disc.
  const sheen = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  sheen.addColorStop(0, withAlpha('#ffffff', 0.14));
  sheen.addColorStop(0.45, withAlpha('#ffffff', 0));
  sheen.addColorStop(0.7, withAlpha('#ffffff', 0.08));
  sheen.addColorStop(1, withAlpha('#ffffff', 0));
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Centre label, taken from the artwork when we have it.
  const labelRadius = radius * 0.36;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, labelRadius, 0, Math.PI * 2);
  ctx.clip();
  if (rc.cover) {
    drawImageBox(
      ctx,
      rc.cover,
      cx - labelRadius,
      cy - labelRadius,
      labelRadius * 2,
      labelRadius * 2,
      {
        fit: 'cover',
      },
    );
  } else {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(cx - labelRadius, cy - labelRadius, labelRadius * 2, labelRadius * 2);
  }
  ctx.restore();

  // Spindle hole.
  ctx.fillStyle = theme.background;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

interface SidesOptions {
  x: number;
  y: number;
  width: number;
  maxHeight: number;
  fontSize: number;
}

/** Splits the tracklist across an A side and a B side. */
function drawSides(rc: RenderContext, options: SidesOptions): void {
  const { ctx, theme, spec } = rc;
  const tracks = spec.album.tracks;
  const { columns } = splitIntoColumns(tracks, tracks.length > 6 ? 2 : 1);
  const sideNames = ['A', 'B', 'C'];
  const columnGap = options.width * 0.06;
  const columnWidth = (options.width - columnGap * (columns.length - 1)) / columns.length;

  let fontSize = options.fontSize;
  const rows = columns.reduce((max, column) => Math.max(max, column.length), 0);
  const headerHeight = fontSize * 2.2;
  while (fontSize > 6 && headerHeight + rows * fontSize * 1.6 > options.maxHeight) {
    fontSize -= 0.25;
  }
  const lineHeight = fontSize * 1.6;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  columns.forEach((column, columnIndex) => {
    const x = options.x + columnIndex * (columnWidth + columnGap);
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.accent;
    drawText(
      ctx,
      `SIDE ${sideNames[columnIndex] ?? String(columnIndex + 1)}`,
      x,
      options.y + fontSize,
      labelFont(rc, fontSize * 0.9),
    );

    const font = monoFont(rc, fontSize);
    column.forEach((track, rowIndex) => {
      ctx.fillStyle = theme.foreground;
      drawText(
        ctx,
        truncate(ctx, `${track.position}. ${track.title}`, columnWidth, font),
        x,
        options.y + fontSize * 2.6 + rowIndex * lineHeight,
        font,
      );
    });
  });
  ctx.restore();
}
