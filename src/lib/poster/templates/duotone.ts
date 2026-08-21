/**
 * Duotone — full-bleed artwork mapped onto two colours with the type set
 * straight over it. The overlay panel keeps the credits readable no matter how
 * busy the artwork is.
 */

import type { RenderContext } from '@/lib/types';
import { ensureContrast, withAlpha } from '@/lib/color/color';
import {
  contentBox,
  drawBackground,
  drawCustomNote,
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
import { drawCoverPlaceholder, drawDuotoneImage } from '../effects';
import { drawText, truncate } from '../text';

export function renderDuotone(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const { ctx, theme, spec } = rc;
  const box = contentBox(rc);
  const gap = rc.height * 0.024;

  withOverride(rc, 'cover', { x: 0, y: 0 }, { width: rc.width, height: rc.height }, () => {
    if (rc.cover) {
      drawDuotoneImage(ctx, rc.cover, 0, 0, rc.width, rc.height, theme.background, theme.accent, 0);
    } else {
      drawCoverPlaceholder(ctx, 0, 0, rc.width, rc.height, 0, {
        from: theme.background,
        to: theme.accent,
        mark: theme.foreground,
      });
    }
  });

  // Bottom scrim so the type always has something solid to sit on.
  const scrimTop = rc.height * 0.42;
  ctx.save();
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, rc.height);
  scrim.addColorStop(0, withAlpha(theme.background, 0));
  scrim.addColorStop(0.45, withAlpha(theme.background, 0.75));
  scrim.addColorStop(1, withAlpha(theme.background, 0.97));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, rc.width, rc.height - scrimTop);
  ctx.restore();

  const foreground = ensureContrast(theme.foreground, theme.background, 5);
  const metaSize = scaled(rc, box.width * 0.026);
  const hasTracklist = spec.options.showTracklist && spec.album.tracks.length > 0;
  const tracklistHeight = hasTracklist ? Math.min(box.height * 0.3, rc.height * 0.26) : 0;

  const bottomLimit = box.y + box.height;
  let blockTop = bottomLimit - tracklistHeight - metaSize * (spec.options.showScanCode ? 5.6 : 3.8);

  const artistSize = scaled(rc, box.width * 0.034);
  const artistY = blockTop;
  withOverride(
    rc,
    'artist',
    { x: box.x, y: artistY },
    { width: box.width, height: artistSize },
    () => {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = theme.accent;
      drawText(ctx, posterArtist(rc), box.x, artistY, labelFont(rc, artistSize));
      ctx.restore();
    },
  );

  const titleY = blockTop + artistSize * 0.5;
  const title = withOverride(
    rc,
    'title',
    { x: box.x, y: titleY },
    { width: box.width, height: scaled(rc, box.width * 0.115) * 2 },
    () =>
      drawHeadline(rc, posterTitle(rc), {
        x: box.x,
        y: titleY,
        width: box.width,
        maxSize: scaled(rc, box.width * 0.115),
        maxLines: 2,
        color: foreground,
      }),
  );
  blockTop += artistSize * 0.5 + title.height + gap * 0.6;

  const entries = metaEntries(rc, locale);
  if (entries.length > 0) {
    const metaY = blockTop;
    withOverride(
      rc,
      'meta',
      { x: box.x, y: metaY },
      { width: box.width, height: metaSize * 2 },
      () => {
        const line = entries.map((entry) => entry.value).join('   ·   ');
        const font = labelFont(rc, metaSize);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = withAlpha(foreground, 0.75);
        drawText(ctx, truncate(ctx, line, box.width, font), box.x, metaY + metaSize, font);
        ctx.restore();
      },
    );
    blockTop += metaSize * 2.1;
  }

  if (hasTracklist) {
    const tracklistY = blockTop;
    const tracklistMaxHeight = Math.max(0, bottomLimit - blockTop - metaSize * 2.2);
    withOverride(
      rc,
      'tracklist',
      { x: box.x, y: tracklistY },
      { width: box.width, height: tracklistMaxHeight },
      () =>
        drawTracklist(rc, {
          x: box.x,
          y: tracklistY,
          width: box.width,
          maxHeight: tracklistMaxHeight,
          fontSize: scaled(rc, box.width * 0.025),
        }),
    );
  }

  if (spec.options.paletteStyle === 'dots' && theme.palette.length > 0) {
    const dotSize = box.width * 0.016;
    const totalWidth = theme.palette.length * (dotSize + dotSize * 0.6) - dotSize * 0.6;
    withOverride(
      rc,
      'palette',
      { x: box.x, y: box.y },
      { width: totalWidth, height: dotSize },
      () => drawPaletteDots(rc, box.x, box.y, dotSize, dotSize * 0.6),
    );
  }

  if (spec.options.showScanCode) {
    const scanWidth = box.width * 0.24;
    const scanX = box.x + box.width - scanWidth;
    const scanY = bottomLimit - metaSize * 1.6;
    withOverride(
      rc,
      'scanCode',
      { x: scanX, y: scanY },
      { width: scanWidth, height: metaSize * 1.4 },
      () => drawScanBlock(rc, { x: scanX, y: scanY, width: scanWidth, height: metaSize * 1.4 }),
    );
  }

  const noteY = bottomLimit - metaSize * 1.4;
  withOverride(
    rc,
    'customNote',
    { x: box.x, y: noteY },
    { width: box.width * 0.6, height: metaSize * 1.6 },
    () => drawCustomNote(rc, box.x, noteY, box.width * 0.6, metaSize * 0.85),
  );
}
