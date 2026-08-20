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
} from '../blocks';
import { drawCoverPlaceholder, drawDuotoneImage } from '../effects';
import { drawText, truncate } from '../text';

export function renderDuotone(rc: RenderContext, locale: string): void {
  drawBackground(rc);

  const { ctx, theme, spec } = rc;
  const box = contentBox(rc);
  const gap = rc.height * 0.024;

  if (rc.cover) {
    drawDuotoneImage(ctx, rc.cover, 0, 0, rc.width, rc.height, theme.background, theme.accent, 0);
  } else {
    drawCoverPlaceholder(ctx, 0, 0, rc.width, rc.height, 0, {
      from: theme.background,
      to: theme.accent,
      mark: theme.foreground,
    });
  }

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
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.accent;
  drawText(ctx, posterArtist(rc), box.x, blockTop, labelFont(rc, artistSize));
  ctx.restore();

  const title = drawHeadline(rc, posterTitle(rc), {
    x: box.x,
    y: blockTop + artistSize * 0.5,
    width: box.width,
    maxSize: scaled(rc, box.width * 0.115),
    maxLines: 2,
    color: foreground,
  });
  blockTop += artistSize * 0.5 + title.height + gap * 0.6;

  const entries = metaEntries(rc, locale);
  if (entries.length > 0) {
    const line = entries.map((entry) => entry.value).join('   ·   ');
    const font = labelFont(rc, metaSize);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = withAlpha(foreground, 0.75);
    drawText(ctx, truncate(ctx, line, box.width, font), box.x, blockTop + metaSize, font);
    ctx.restore();
    blockTop += metaSize * 2.1;
  }

  if (hasTracklist) {
    drawTracklist(rc, {
      x: box.x,
      y: blockTop,
      width: box.width,
      maxHeight: Math.max(0, bottomLimit - blockTop - metaSize * 2.2),
      fontSize: scaled(rc, box.width * 0.025),
    });
  }

  if (spec.options.paletteStyle === 'dots' && theme.palette.length > 0) {
    const dotSize = box.width * 0.016;
    drawPaletteDots(rc, box.x, box.y, dotSize, dotSize * 0.6);
  }

  if (spec.options.showScanCode) {
    const scanWidth = box.width * 0.24;
    drawScanBlock(rc, {
      x: box.x + box.width - scanWidth,
      y: bottomLimit - metaSize * 1.6,
      width: scanWidth,
      height: metaSize * 1.4,
    });
  }

  drawCustomNote(rc, box.x, bottomLimit - metaSize * 1.4, box.width * 0.6, metaSize * 0.85);
}
