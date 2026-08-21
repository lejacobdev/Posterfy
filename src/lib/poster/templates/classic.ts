/**
 * Classic — the signature Posterfy layout: artwork on top, a palette bar down
 * the side, then title, credits and tracklist, with the artist set large at the
 * bottom. Switches to a side-by-side arrangement on landscape formats.
 */

import type { RenderContext } from '@/lib/types';
import { withAlpha } from '@/lib/color/color';
import {
  contentBox,
  drawBackground,
  drawCustomNote,
  drawFittedLine,
  drawMetaColumn,
  drawPaletteBar,
  drawRule,
  drawScanBlock,
  drawTracklist,
  posterArtist,
  posterTitle,
  scaled,
  withOverride,
} from '../blocks';
import { drawCoverPlaceholder, drawImageBox } from '../effects';

export function renderClassic(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const box = contentBox(rc);
  const landscape = rc.height < rc.width;
  const usePaletteBar = rc.spec.options.paletteStyle === 'bar' && rc.theme.palette.length > 0;
  const barWidth = usePaletteBar ? rc.width * 0.026 : 0;
  const barGap = usePaletteBar ? rc.width * 0.026 : 0;

  const columnX = box.x + barWidth + barGap;
  const columnWidth = box.width - barWidth - barGap;

  const titleSize = scaled(rc, columnWidth * 0.055);
  const artistSize = scaled(rc, columnWidth * 0.07);
  const metaSize = scaled(rc, columnWidth * 0.024);
  const gap = rc.height * 0.026;

  if (landscape) {
    renderLandscape(rc, locale, { columnX, columnWidth, box, barWidth, barGap, usePaletteBar });
    return;
  }

  const reserved = titleSize * 1.7 + artistSize * 1.7 + gap * 3;
  const minInfoHeight = box.height * 0.16;
  const coverSize = Math.max(
    columnWidth * 0.45,
    Math.min(columnWidth, box.height - reserved - minInfoHeight),
  );

  withOverride(rc, 'cover', { x: columnX, y: box.y }, { width: coverSize, height: coverSize }, () =>
    drawCover(rc, columnX, box.y, coverSize, coverSize),
  );

  if (usePaletteBar) {
    withOverride(
      rc,
      'palette',
      { x: box.x, y: box.y },
      { width: barWidth, height: coverSize },
      () => drawPaletteBar(rc, box.x, box.y, barWidth, coverSize, 'vertical'),
    );
  }

  let cursorY = box.y + coverSize + gap * 1.3;

  // Title row: album name on the left, scan code hugging the right edge.
  const scanWidth = rc.spec.options.showScanCode ? columnWidth * 0.26 : 0;
  const scanHeight = titleSize * 0.62;
  const titleWidth = columnWidth - (scanWidth > 0 ? scanWidth + columnWidth * 0.04 : 0);
  const title = withOverride(
    rc,
    'title',
    { x: columnX, y: cursorY },
    { width: titleWidth, height: titleSize },
    () =>
      drawFittedLine(rc, posterTitle(rc), {
        x: columnX,
        y: cursorY,
        width: titleWidth,
        maxSize: titleSize,
      }),
  );
  if (scanWidth > 0) {
    const scanY = cursorY + title.fontSize * 0.12;
    withOverride(
      rc,
      'scanCode',
      { x: columnX + columnWidth - scanWidth, y: scanY },
      { width: scanWidth, height: scanHeight },
      () =>
        drawScanBlock(rc, {
          x: columnX + columnWidth - scanWidth,
          y: scanY,
          width: scanWidth,
          height: scanHeight,
        }),
    );
  }

  cursorY += title.fontSize + gap * 0.75;
  drawRule(rc, columnX, cursorY, columnWidth, Math.max(1, rc.width * 0.0016));
  cursorY += gap * 0.9;

  // Credits column on the left, tracklist filling the rest.
  const metaWidth = columnWidth * 0.28;
  const bottomLimit = box.y + box.height - artistSize * 1.5;
  const infoHeight = Math.max(0, bottomLimit - cursorY - gap);

  withOverride(
    rc,
    'meta',
    { x: columnX, y: cursorY },
    { width: metaWidth, height: infoHeight },
    () =>
      drawMetaColumn(rc, { x: columnX, y: cursorY, width: metaWidth, fontSize: metaSize, locale }),
  );

  const tracklistX = columnX + metaWidth + columnWidth * 0.05;
  const tracklistWidth = columnX + columnWidth - tracklistX;
  withOverride(
    rc,
    'tracklist',
    { x: tracklistX, y: cursorY },
    { width: tracklistWidth, height: infoHeight },
    () =>
      drawTracklist(rc, {
        x: tracklistX,
        y: cursorY,
        width: tracklistWidth,
        maxHeight: infoHeight,
        fontSize: scaled(rc, columnWidth * 0.026),
      }),
  );

  const noteY = bottomLimit - metaSize * 1.2;
  withOverride(
    rc,
    'customNote',
    { x: columnX, y: noteY },
    { width: metaWidth * 2, height: metaSize * 1.6 },
    () => drawCustomNote(rc, columnX, noteY, metaWidth * 2, metaSize * 0.85),
  );

  const artistY = box.y + box.height - artistSize * 1.08;
  withOverride(
    rc,
    'artist',
    { x: columnX + columnWidth, y: artistY },
    { width: columnWidth, height: artistSize },
    () =>
      drawFittedLine(rc, posterArtist(rc), {
        x: columnX + columnWidth,
        y: artistY,
        width: columnWidth,
        maxSize: artistSize,
        align: 'right',
      }),
  );
}

interface LandscapeArgs {
  columnX: number;
  columnWidth: number;
  box: ReturnType<typeof contentBox>;
  barWidth: number;
  barGap: number;
  usePaletteBar: boolean;
}

function renderLandscape(rc: RenderContext, locale: string, args: LandscapeArgs): void {
  const { box, barWidth, barGap, usePaletteBar } = args;
  const gap = box.width * 0.035;
  const coverSize = Math.min(box.height, box.width * 0.44);
  const coverX = box.x + barWidth + barGap;

  withOverride(rc, 'cover', { x: coverX, y: box.y }, { width: coverSize, height: coverSize }, () =>
    drawCover(rc, coverX, box.y, coverSize, coverSize),
  );
  if (usePaletteBar) {
    withOverride(
      rc,
      'palette',
      { x: box.x, y: box.y },
      { width: barWidth, height: coverSize },
      () => drawPaletteBar(rc, box.x, box.y, barWidth, coverSize, 'vertical'),
    );
  }

  const infoX = coverX + coverSize + gap;
  const infoWidth = box.x + box.width - infoX;
  const titleSize = scaled(rc, infoWidth * 0.1);
  const metaSize = scaled(rc, infoWidth * 0.042);

  let cursorY = box.y;
  const titleY = cursorY;
  const title = withOverride(
    rc,
    'title',
    { x: infoX, y: titleY },
    { width: infoWidth, height: titleSize },
    () =>
      drawFittedLine(rc, posterTitle(rc), {
        x: infoX,
        y: titleY,
        width: infoWidth,
        maxSize: titleSize,
      }),
  );
  cursorY += title.fontSize * 1.3;

  const artistY = cursorY;
  const artist = withOverride(
    rc,
    'artist',
    { x: infoX, y: artistY },
    { width: infoWidth, height: titleSize * 0.55 },
    () =>
      drawFittedLine(rc, posterArtist(rc), {
        x: infoX,
        y: artistY,
        width: infoWidth,
        maxSize: titleSize * 0.55,
        color: rc.theme.accent,
      }),
  );
  cursorY += artist.fontSize * 1.5;

  drawRule(rc, infoX, cursorY, infoWidth, Math.max(1, rc.width * 0.0014));
  cursorY += gap * 0.6;

  const metaY = cursorY;
  const metaHeight = withOverride(
    rc,
    'meta',
    { x: infoX, y: metaY },
    { width: infoWidth, height: metaSize * 4 },
    () => drawMetaColumn(rc, { x: infoX, y: metaY, width: infoWidth, fontSize: metaSize, locale }),
  );

  const tracklistY = cursorY + metaHeight + gap * 0.4;
  const tracklistHeight = Math.max(0, box.y + box.height - tracklistY - metaSize * 2);
  withOverride(
    rc,
    'tracklist',
    { x: infoX, y: tracklistY },
    { width: infoWidth, height: tracklistHeight },
    () =>
      drawTracklist(rc, {
        x: infoX,
        y: tracklistY,
        width: infoWidth,
        maxHeight: tracklistHeight,
        fontSize: scaled(rc, infoWidth * 0.042),
      }),
  );

  if (rc.spec.options.showScanCode) {
    const scanX = box.x + box.width - infoWidth * 0.3;
    const scanY = box.y + box.height - metaSize * 1.6;
    withOverride(
      rc,
      'scanCode',
      { x: scanX, y: scanY },
      { width: infoWidth * 0.3, height: metaSize * 1.4 },
      () =>
        drawScanBlock(rc, { x: scanX, y: scanY, width: infoWidth * 0.3, height: metaSize * 1.4 }),
    );
  }
}

function drawCover(rc: RenderContext, x: number, y: number, width: number, height: number): void {
  const { options } = rc.spec;
  const radius = (Math.min(width, height) / 2) * options.coverRadius;
  const border = options.showCoverBorder
    ? { width: rc.width * 0.004, color: withAlpha(rc.theme.foreground, 0.6) }
    : null;

  if (rc.cover) {
    drawImageBox(rc.ctx, rc.cover, x, y, width, height, { radius, border });
    return;
  }
  drawCoverPlaceholder(rc.ctx, x, y, width, height, radius, {
    from: rc.theme.palette[0] ?? '#222',
    to: rc.theme.palette[rc.theme.palette.length - 1] ?? '#666',
    mark: rc.theme.foreground,
  });
}
