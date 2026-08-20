/**
 * Export pipeline: re-renders the poster at print resolution into an offscreen
 * canvas and hands back a Blob. The preview canvas is never touched, so the UI
 * stays responsive and the export is never limited by the display size.
 */

import type { ExportFormat, ExportOptions, PosterLabels, PosterSpec } from '@/lib/types';
import { downloadBlob, slugify } from '@/lib/utils/misc';
import { getFormat } from './formats';
import { preparePosterAssets, renderPoster } from './render';

export const EXPORT_MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export interface ExportPreset {
  id: string;
  name: string;
  /** Multiplier applied to the format's 300 DPI print width. */
  scale: number;
  description: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: 'social', name: 'Social', scale: 0.32, description: 'Fast, sized for stories and posts.' },
  { id: 'hd', name: 'HD', scale: 0.55, description: 'Screens, wallpapers and previews.' },
  { id: 'print', name: 'Print 300 DPI', scale: 1, description: 'Ready for a print shop.' },
  { id: 'max', name: 'Maximum', scale: 1.35, description: 'Large-format printing.' },
];

/** Browsers cap canvas dimensions; staying under this keeps Safari happy. */
export const MAX_EXPORT_WIDTH = 8000;

export function exportWidthFor(spec: PosterSpec, presetId: string): number {
  const preset = EXPORT_PRESETS.find((item) => item.id === presetId) ?? EXPORT_PRESETS[2];
  const format = getFormat(spec.options.format);
  const width = Math.round(format.printWidth * (preset?.scale ?? 1));
  const height = Math.round(width * format.ratio);
  if (height > MAX_EXPORT_WIDTH) {
    return Math.floor(MAX_EXPORT_WIDTH / format.ratio);
  }
  return Math.min(width, MAX_EXPORT_WIDTH);
}

export function defaultFilename(spec: PosterSpec, format: ExportFormat): string {
  const artist = slugify(spec.options.artistOverride || spec.album.artist || 'poster');
  const title = slugify(spec.options.titleOverride || spec.album.title || 'album');
  const parts = [artist, title].filter(Boolean);
  return `${parts.join('-') || 'posterfy'}-poster.${format === 'jpeg' ? 'jpg' : format}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the poster'));
      },
      mime,
      quality,
    );
  });
}

export interface RenderToBlobArgs {
  spec: PosterSpec;
  options: ExportOptions;
  locale?: string;
  labels?: PosterLabels;
  onProgress?: (stage: 'loading' | 'rendering' | 'encoding') => void;
}

export async function renderPosterToBlob(args: RenderToBlobArgs): Promise<Blob> {
  const { spec, options, locale, labels, onProgress } = args;

  onProgress?.('loading');
  const assets = await preparePosterAssets(spec, { samplePalette: false, quality: 'export' });

  onProgress?.('rendering');
  const canvas = document.createElement('canvas');
  renderPoster({
    canvas,
    spec,
    width: options.width,
    locale,
    labels,
    cover: assets.cover,
    scanImage: assets.scanImage,
  });

  onProgress?.('encoding');
  const mime = EXPORT_MIME[options.format];

  // JPEG has no alpha: flatten onto the poster background first.
  if (options.format === 'jpeg') {
    const flattened = document.createElement('canvas');
    flattened.width = canvas.width;
    flattened.height = canvas.height;
    const ctx = flattened.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, flattened.width, flattened.height);
      ctx.drawImage(canvas, 0, 0);
      return canvasToBlob(flattened, mime, options.quality);
    }
  }

  return canvasToBlob(canvas, mime, options.quality);
}

export async function downloadPoster(args: RenderToBlobArgs): Promise<Blob> {
  const blob = await renderPosterToBlob(args);
  downloadBlob(blob, args.options.filename);
  return blob;
}

/** True when the device can share files (iOS/Android share sheet). */
export function canSharePoster(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    const probe = new File(['probe'], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function sharePoster(blob: Blob, filename: string, title: string): Promise<boolean> {
  if (!canSharePoster()) return false;
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title, text: title });
    return true;
  } catch (error) {
    // A user cancelling the share sheet is not an error worth surfacing.
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}

export async function copyPosterToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    !('write' in navigator.clipboard)
  ) {
    return false;
  }
  try {
    // Clipboard support is limited to PNG in every current browser.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
