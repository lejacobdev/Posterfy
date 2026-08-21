/**
 * Split — full-bleed artwork across the top, a solid information block below.
 * Ignores the outer margin on the artwork side so the image runs to the edge.
 */

import type { RenderContext } from '@/lib/types';
import { withAlpha } from '@/lib/color/color';
import {
  bodyFont,
  drawBackground,
  drawCustomNote,
  drawHeadline,
  drawPaletteBar,
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
import { drawText, truncate } from '../text';

export function renderSplit(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const { ctx, theme, spec } = rc;
  const landscape = rc.height < rc.width;
  const inset = rc.width * Math.max(0.05, spec.options.margin);
  const gap = rc.height * 0.022;

  const imageHeight = landscape ? rc.height : rc.height * 0.58;
  const imageWidth = landscape ? rc.width * 0.5 : rc.width;

  withOverride(rc, 'cover', { x: 0, y: 0 }, { width: imageWidth, height: imageHeight }, () =>
    drawArtwork(rc, 0, 0, imageWidth, imageHeight),
  );

  // Gradient tie-in between the artwork and the information block.
  if (!landscape) {
    ctx.save();
    const fade = ctx.createLinearGradient(0, imageHeight - rc.height * 0.09, 0, imageHeight);
    fade.addColorStop(0, withAlpha(theme.background, 0));
    fade.addColorStop(1, withAlpha(theme.background, 0.92));
    ctx.fillStyle = fade;
    ctx.fillRect(0, imageHeight - rc.height * 0.09, rc.width, rc.height * 0.09);
    ctx.restore();
  }

  const panelX = landscape ? imageWidth : 0;
  const panelY = landscape ? 0 : imageHeight;
  const panelWidth = landscape ? rc.width - imageWidth : rc.width;
  const panelHeight = landscape ? rc.height : rc.height - imageHeight;

  ctx.save();
  ctx.fillStyle = theme.background;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.restore();

  if (spec.options.paletteStyle !== 'none' && theme.palette.length > 0) {
    const barHeight = rc.height * 0.009;
    withOverride(
      rc,
      'palette',
      { x: panelX, y: panelY },
      { width: panelWidth, height: barHeight },
      () => drawPaletteBar(rc, panelX, panelY, panelWidth, barHeight, 'horizontal'),
    );
  }

  const contentX = panelX + inset;
  const contentWidth = panelWidth - inset * 2;
  let cursorY = panelY + inset * 0.9;

  const artistSize = scaled(rc, contentWidth * 0.036);
  const artistY = cursorY;
  withOverride(
    rc,
    'artist',
    { x: contentX, y: artistY },
    { width: contentWidth, height: artistSize },
    () => {
      ctx.save();
      ctx.fillStyle = theme.accent;
      ctx.textAlign = 'left';
      drawText(ctx, posterArtist(rc), contentX, artistY + artistSize, labelFont(rc, artistSize));
      ctx.restore();
    },
  );
  cursorY += artistSize * 1.9;

  const titleY = cursorY;
  const title = withOverride(
    rc,
    'title',
    { x: contentX, y: titleY },
    { width: contentWidth, height: scaled(rc, contentWidth * 0.11) * 2 },
    () =>
      drawHeadline(rc, posterTitle(rc), {
        x: contentX,
        y: titleY,
        width: contentWidth,
        maxSize: scaled(rc, contentWidth * 0.11),
        maxLines: 2,
      }),
  );
  cursorY += title.height + gap;

  const metaSize = scaled(rc, contentWidth * 0.026);
  const entries = metaEntries(rc, locale);
  if (entries.length > 0) {
    const metaY = cursorY;
    withOverride(
      rc,
      'meta',
      { x: contentX, y: metaY },
      { width: contentWidth, height: metaSize * 2 },
      () => {
        const line = entries.map((entry) => `${entry.label}: ${entry.value}`).join('    ');
        const font = bodyFont(rc, metaSize);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.muted;
        drawText(ctx, truncate(ctx, line, contentWidth, font), contentX, metaY + metaSize, font);
        ctx.restore();
      },
    );
    cursorY += metaSize * 2.2;
  }

  const bottomReserve = metaSize * (spec.options.showScanCode ? 3.4 : 1.6);
  const tracklistY = cursorY;
  const tracklistMaxHeight = Math.max(0, panelY + panelHeight - cursorY - bottomReserve);
  withOverride(
    rc,
    'tracklist',
    { x: contentX, y: tracklistY },
    { width: contentWidth, height: tracklistMaxHeight },
    () =>
      drawTracklist(rc, {
        x: contentX,
        y: tracklistY,
        width: contentWidth,
        maxHeight: tracklistMaxHeight,
        fontSize: scaled(rc, contentWidth * 0.027),
        showDurations: spec.album.tracks.length <= 16,
      }),
  );

  if (spec.options.showScanCode) {
    const scanWidth = contentWidth * 0.26;
    const scanX = contentX + contentWidth - scanWidth;
    const scanY = panelY + panelHeight - inset * 0.6 - metaSize * 1.4;
    withOverride(
      rc,
      'scanCode',
      { x: scanX, y: scanY },
      { width: scanWidth, height: metaSize * 1.4 },
      () => drawScanBlock(rc, { x: scanX, y: scanY, width: scanWidth, height: metaSize * 1.4 }),
    );
  }

  const noteY = panelY + panelHeight - inset * 0.6 - metaSize;
  withOverride(
    rc,
    'customNote',
    { x: contentX, y: noteY },
    { width: contentWidth * 0.6, height: metaSize * 1.6 },
    () => drawCustomNote(rc, contentX, noteY, contentWidth * 0.6, metaSize * 0.85),
  );
}

function drawArtwork(rc: RenderContext, x: number, y: number, width: number, height: number): void {
  if (rc.cover) {
    drawImageBox(rc.ctx, rc.cover, x, y, width, height, { fit: 'cover' });
    return;
  }
  drawCoverPlaceholder(rc.ctx, x, y, width, height, 0, {
    from: rc.theme.palette[0] ?? '#222',
    to: rc.theme.palette[rc.theme.palette.length - 1] ?? '#666',
    mark: rc.theme.foreground,
  });
}
