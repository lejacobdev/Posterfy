/**
 * Poster renderer.
 *
 * One function draws every poster, at any size: templates work on a 1000-unit
 * grid and the context is scaled, so the on-screen preview and a 300 DPI export
 * come out of exactly the same code path.
 */

import type {
  Album,
  LoadedCover,
  PosterLabels,
  PosterSpec,
  RenderContext,
  ResolvedTheme,
} from '@/lib/types';
import {
  dominantAccent,
  ensureContrast,
  extractPalette,
  fallbackPalette,
  isDark,
  mix,
  paletteBackground,
  readableTextColor,
} from '@/lib/color/color';
import { designHeight } from './formats';
import { drawFinish } from './blocks';
import { getTemplateRenderer } from './templates';
import { ensureFontsReady } from './fonts';
import { loadCover } from './cover';
import { spotifyScanUrl } from './scancode';

export const DEFAULT_LABELS: PosterLabels = {
  releaseDate: 'Release Year',
  duration: 'Duration',
  genres: 'Genres',
  label: 'Label',
  tracks: 'Tracks',
  minutes: 'min',
};

/** Turns user options plus artwork colours into the palette the templates use. */
export function resolveTheme(spec: PosterSpec): ResolvedTheme {
  const { options } = spec;
  const palette = options.palette.length > 0 ? options.palette : fallbackPalette(6);

  if (!options.autoColors) {
    const background = options.background;
    const foreground = ensureContrast(options.foreground, background, 4.5);
    return {
      background,
      foreground,
      muted: mix(foreground, background, 0.42),
      accent: ensureContrast(options.accent, background, 3),
      palette,
    };
  }

  const background = paletteBackground(palette);
  const foreground = ensureContrast(readableTextColor(background), background, 7);
  return {
    background,
    foreground,
    muted: mix(foreground, background, 0.42),
    accent: ensureContrast(dominantAccent(palette), background, 3),
    palette,
  };
}

export interface RenderPosterArgs {
  canvas: HTMLCanvasElement;
  spec: PosterSpec;
  /** Bitmap width in device pixels. */
  width: number;
  locale?: string;
  labels?: PosterLabels;
  cover?: LoadedCover | null;
  scanImage?: LoadedCover | null;
}

/** Draws `spec` into `canvas`, resizing the bitmap to `width`. */
export function renderPoster(args: RenderPosterArgs): void {
  const { canvas, spec, width, locale = 'en', labels = DEFAULT_LABELS } = args;
  const designW = 1000;
  const designH = designHeight(spec.options.format);
  const scale = width / designW;
  const pixelHeight = Math.round(designH * scale);

  if (canvas.width !== Math.round(width) || canvas.height !== pixelHeight) {
    canvas.width = Math.round(width);
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const rc: RenderContext = {
    ctx,
    width: designW,
    height: designH,
    scale,
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
    cover: args.cover ?? null,
    scanImage: args.scanImage ?? null,
    spec,
    theme: resolveTheme(spec),
    fonts: { display: '', body: '', mono: '' },
    labels,
  };

  getTemplateRenderer(spec.options.template)(rc, locale);
  drawFinish(rc);

  ctx.restore();
}

/** Previews take the small cover; exports take the largest one available. */
export type CoverQuality = 'preview' | 'export';

/**
 * Picks which artwork URL to load.
 *
 * Both directions fall back to the other size. Previously only the export path
 * did, so an album that had a hi-res cover but no medium one rendered its
 * preview as a placeholder even though artwork existed.
 */
export function selectCoverUrl(
  album: Pick<Album, 'coverUrl' | 'coverUrlHiRes'>,
  quality: CoverQuality,
): string | null {
  return quality === 'export'
    ? (album.coverUrlHiRes ?? album.coverUrl)
    : (album.coverUrl ?? album.coverUrlHiRes);
}

export interface PreparedAssets {
  cover: LoadedCover | null;
  scanImage: LoadedCover | null;
  /** Palette sampled from the artwork, or null when it could not be read. */
  palette: string[] | null;
}

/**
 * Loads everything a render needs: fonts, artwork, the optional Spotify
 * scannable and the sampled palette. Failures degrade instead of throwing —
 * a poster still renders without artwork or without a scan code.
 */
export async function preparePosterAssets(
  spec: PosterSpec,
  options: { samplePalette?: boolean; quality?: CoverQuality } = {},
): Promise<PreparedAssets> {
  const { album, options: posterOptions } = spec;
  await ensureFontsReady();

  const coverUrl = selectCoverUrl(album, options.quality ?? 'preview');

  let cover: LoadedCover | null = null;
  if (coverUrl) {
    try {
      cover = await loadCover(coverUrl);
    } catch {
      cover = null;
    }
  }

  let palette: string[] | null = null;
  if (cover && options.samplePalette !== false) {
    try {
      palette = extractPalette(cover.image, { count: 6 });
    } catch {
      palette = null;
    }
  }

  let scanImage: LoadedCover | null = null;
  if (posterOptions.showScanCode && album.uri?.startsWith('spotify:')) {
    // Fetch the variant that matches the poster background.
    const theme = resolveTheme({
      ...spec,
      options: { ...posterOptions, palette: palette ?? posterOptions.palette },
    });
    try {
      scanImage = await loadCover(
        spotifyScanUrl(album.uri, isDark(theme.background) ? 'white' : 'black'),
      );
    } catch {
      // Falls back to the generated bar pattern.
      scanImage = null;
    }
  }

  return { cover, scanImage, palette };
}
