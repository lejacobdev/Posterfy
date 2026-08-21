/**
 * Minimal — centred artwork, generous white space, quiet credits.
 * Everything is optional here; the layout re-centres around whatever is left on.
 */

import type { RenderContext } from '@/lib/types';
import { withAlpha } from '@/lib/color/color';
import {
  contentBox,
  drawBackground,
  drawCustomNote,
  drawFittedLine,
  drawHeadline,
  drawPaletteDots,
  drawScanBlock,
  drawTracklist,
  labelFont,
  metaEntries,
  posterArtist,
  posterTitle,
  scaled,
  withOverride,
} from '../blocks';
import { drawCoverPlaceholder, drawImageBox } from '../effects';
import { drawText } from '../text';

export function renderMinimal(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const box = contentBox(rc);
  const { ctx, theme, spec } = rc;
  const centerX = box.x + box.width / 2;
  const gap = rc.height * 0.028;

  const titleSize = scaled(rc, box.width * 0.072);
  const artistSize = scaled(rc, box.width * 0.032);
  const metaSize = scaled(rc, box.width * 0.022);

  const hasTracklist = spec.options.showTracklist && spec.album.tracks.length > 0;
  const tracklistShare = hasTracklist ? Math.min(0.26, spec.album.tracks.length * 0.014 + 0.08) : 0;

  const textBlockHeight = titleSize * 1.5 + artistSize * 2 + metaSize * 3;
  const availableForCover = box.height - textBlockHeight - box.height * tracklistShare - gap * 3;
  const coverSize = Math.max(box.width * 0.4, Math.min(box.width, availableForCover));

  const coverX = centerX - coverSize / 2;
  let cursorY = box.y;

  const coverY = cursorY;
  withOverride(rc, 'cover', { x: coverX, y: coverY }, { width: coverSize, height: coverSize }, () =>
    drawArtwork(rc, coverX, coverY, coverSize, coverSize),
  );
  cursorY += coverSize + gap * 1.4;

  if (spec.options.paletteStyle === 'dots' && theme.palette.length > 0) {
    const dotSize = box.width * 0.018;
    const totalWidth = theme.palette.length * (dotSize + dotSize * 0.55) - dotSize * 0.55;
    const paletteY = cursorY;
    withOverride(
      rc,
      'palette',
      { x: centerX - totalWidth / 2, y: paletteY },
      { width: totalWidth, height: dotSize },
      () => drawPaletteDots(rc, centerX - totalWidth / 2, paletteY, dotSize, dotSize * 0.55),
    );
    cursorY += dotSize + gap;
  } else if (spec.options.paletteStyle !== 'none' && theme.palette.length > 0) {
    const stripHeight = box.width * 0.01;
    const stripWidth = coverSize * 0.5;
    const step = stripWidth / theme.palette.length;
    const paletteY = cursorY;
    withOverride(
      rc,
      'palette',
      { x: centerX - stripWidth / 2, y: paletteY },
      { width: stripWidth, height: stripHeight },
      () => {
        ctx.save();
        theme.palette.forEach((color, index) => {
          ctx.fillStyle = color;
          ctx.fillRect(centerX - stripWidth / 2 + index * step, paletteY, step + 0.5, stripHeight);
        });
        ctx.restore();
      },
    );
    cursorY += stripHeight + gap;
  }

  const titleY = cursorY;
  const title = withOverride(
    rc,
    'title',
    { x: centerX, y: titleY },
    { width: box.width * 0.98, height: titleSize * 2 },
    () =>
      drawHeadline(rc, posterTitle(rc), {
        x: centerX,
        y: titleY,
        width: box.width * 0.98,
        maxSize: titleSize,
        maxLines: 2,
        align: 'center',
      }),
  );
  cursorY += title.height + gap * 0.5;

  const artistY = cursorY;
  const artist = withOverride(
    rc,
    'artist',
    { x: centerX, y: artistY },
    { width: box.width * 0.9, height: artistSize },
    () =>
      drawFittedLine(rc, posterArtist(rc), {
        x: centerX,
        y: artistY,
        width: box.width * 0.9,
        maxSize: artistSize,
        align: 'center',
        color: theme.accent,
      }),
  );
  cursorY += artist.fontSize * 1.9;

  // Credits condensed into a single centred line: `1985 · 54 min · Rock`.
  const entries = metaEntries(rc, locale);
  if (entries.length > 0) {
    const metaY = cursorY;
    withOverride(
      rc,
      'meta',
      { x: centerX, y: metaY },
      { width: box.width * 0.9, height: metaSize * 2 },
      () => {
        const line = entries.map((entry) => entry.value).join('   ·   ');
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.muted;
        drawText(ctx, line, centerX, metaY + metaSize, labelFont(rc, metaSize));
        ctx.restore();
      },
    );
    cursorY += metaSize * 2.4;
  }

  if (hasTracklist) {
    const bottomReserve = spec.options.showScanCode ? metaSize * 3.2 : metaSize * 1.6;
    const tracklistY = cursorY;
    const tracklistMaxHeight = Math.max(0, box.y + box.height - cursorY - bottomReserve);
    withOverride(
      rc,
      'tracklist',
      { x: box.x + box.width * 0.1, y: tracklistY },
      { width: box.width * 0.8, height: tracklistMaxHeight },
      () =>
        drawTracklist(rc, {
          x: box.x + box.width * 0.1,
          y: tracklistY,
          width: box.width * 0.8,
          maxHeight: tracklistMaxHeight,
          fontSize: scaled(rc, box.width * 0.023),
        }),
    );
  }

  if (spec.options.showScanCode) {
    const scanWidth = box.width * 0.24;
    const scanX = centerX - scanWidth / 2;
    const scanY = box.y + box.height - metaSize * 2.2;
    withOverride(
      rc,
      'scanCode',
      { x: scanX, y: scanY },
      { width: scanWidth, height: metaSize * 1.4 },
      () => drawScanBlock(rc, { x: scanX, y: scanY, width: scanWidth, height: metaSize * 1.4 }),
    );
  }

  const noteY = box.y + box.height - metaSize * 0.6;
  withOverride(
    rc,
    'customNote',
    { x: centerX, y: noteY },
    { width: box.width, height: metaSize * 1.6 },
    () => drawCustomNote(rc, centerX, noteY, box.width, metaSize * 0.85, 'center'),
  );
}

function drawArtwork(rc: RenderContext, x: number, y: number, width: number, height: number): void {
  const { options } = rc.spec;
  const radius = (Math.min(width, height) / 2) * options.coverRadius;
  if (rc.cover) {
    drawImageBox(rc.ctx, rc.cover, x, y, width, height, {
      radius,
      shadow: { blur: rc.width * 0.05, y: rc.width * 0.012, color: withAlpha('#000000', 0.35) },
      border: options.showCoverBorder
        ? { width: rc.width * 0.003, color: withAlpha(rc.theme.foreground, 0.4) }
        : null,
    });
    return;
  }
  drawCoverPlaceholder(rc.ctx, x, y, width, height, radius, {
    from: rc.theme.palette[0] ?? '#222',
    to: rc.theme.palette[rc.theme.palette.length - 1] ?? '#666',
    mark: rc.theme.foreground,
  });
}
