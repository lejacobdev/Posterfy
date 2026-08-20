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

  drawCover(rc, columnX, box.y, coverSize, coverSize);

  if (usePaletteBar) {
    drawPaletteBar(rc, box.x, box.y, barWidth, coverSize, 'vertical');
  }

  let cursorY = box.y + coverSize + gap * 1.3;

  // Title row: album name on the left, scan code hugging the right edge.
  const scanWidth = rc.spec.options.showScanCode ? columnWidth * 0.26 : 0;
  const scanHeight = titleSize * 0.62;
  const titleWidth = columnWidth - (scanWidth > 0 ? scanWidth + columnWidth * 0.04 : 0);
  const title = drawFittedLine(rc, posterTitle(rc), {
    x: columnX,
    y: cursorY,
    width: titleWidth,
    maxSize: titleSize,
  });
  if (scanWidth > 0) {
    drawScanBlock(rc, {
      x: columnX + columnWidth - scanWidth,
      y: cursorY + title.fontSize * 0.12,
      width: scanWidth,
      height: scanHeight,
    });
  }

  cursorY += title.fontSize + gap * 0.75;
  drawRule(rc, columnX, cursorY, columnWidth, Math.max(1, rc.width * 0.0016));
  cursorY += gap * 0.9;

  // Credits column on the left, tracklist filling the rest.
  const metaWidth = columnWidth * 0.28;
  const bottomLimit = box.y + box.height - artistSize * 1.5;
  const infoHeight = Math.max(0, bottomLimit - cursorY - gap);

  drawMetaColumn(rc, {
    x: columnX,
    y: cursorY,
    width: metaWidth,
    fontSize: metaSize,
    locale,
  });

  const tracklistX = columnX + metaWidth + columnWidth * 0.05;
  drawTracklist(rc, {
    x: tracklistX,
    y: cursorY,
    width: columnX + columnWidth - tracklistX,
    maxHeight: infoHeight,
    fontSize: scaled(rc, columnWidth * 0.026),
  });

  drawCustomNote(rc, columnX, bottomLimit - metaSize * 1.2, metaWidth * 2, metaSize * 0.85);

  drawFittedLine(rc, posterArtist(rc), {
    x: columnX + columnWidth,
    y: box.y + box.height - artistSize * 1.08,
    width: columnWidth,
    maxSize: artistSize,
    align: 'right',
  });
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

  drawCover(rc, coverX, box.y, coverSize, coverSize);
  if (usePaletteBar) drawPaletteBar(rc, box.x, box.y, barWidth, coverSize, 'vertical');

  const infoX = coverX + coverSize + gap;
  const infoWidth = box.x + box.width - infoX;
  const titleSize = scaled(rc, infoWidth * 0.1);
  const metaSize = scaled(rc, infoWidth * 0.042);

  let cursorY = box.y;
  const title = drawFittedLine(rc, posterTitle(rc), {
    x: infoX,
    y: cursorY,
    width: infoWidth,
    maxSize: titleSize,
  });
  cursorY += title.fontSize * 1.3;

  const artist = drawFittedLine(rc, posterArtist(rc), {
    x: infoX,
    y: cursorY,
    width: infoWidth,
    maxSize: titleSize * 0.55,
    color: rc.theme.accent,
  });
  cursorY += artist.fontSize * 1.5;

  drawRule(rc, infoX, cursorY, infoWidth, Math.max(1, rc.width * 0.0014));
  cursorY += gap * 0.6;

  const metaHeight = drawMetaColumn(rc, {
    x: infoX,
    y: cursorY,
    width: infoWidth,
    fontSize: metaSize,
    locale,
  });

  const tracklistY = cursorY + metaHeight + gap * 0.4;
  drawTracklist(rc, {
    x: infoX,
    y: tracklistY,
    width: infoWidth,
    maxHeight: Math.max(0, box.y + box.height - tracklistY - metaSize * 2),
    fontSize: scaled(rc, infoWidth * 0.042),
  });

  if (rc.spec.options.showScanCode) {
    drawScanBlock(rc, {
      x: box.x + box.width - infoWidth * 0.3,
      y: box.y + box.height - metaSize * 1.6,
      width: infoWidth * 0.3,
      height: metaSize * 1.4,
    });
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
