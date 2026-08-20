/**
 * Cover loading.
 *
 * Exporting a poster reads pixels back out of the canvas, so every image drawn
 * into it has to be CORS-clean. We try the cheapest route first and fall back
 * through progressively more defensive ones.
 */

import type { LoadedCover } from '@/lib/types';

const cache = new Map<string, Promise<LoadedCover>>();

function toLoadedCover(image: HTMLImageElement): LoadedCover {
  return {
    image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

function loadImageElement(src: string, crossOrigin: string | null): Promise<LoadedCover> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.decoding = 'async';
    image.onload = () => resolve(toLoadedCover(image));
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

/** Same-origin proxy that re-serves remote artwork with permissive CORS headers. */
export function proxiedUrl(url: string): string {
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}

async function loadThroughFetch(url: string): Promise<LoadedCover> {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await loadImageElement(objectUrl, null);
  } finally {
    // The decoded bitmap stays valid after revoking the URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}

/**
 * Resolves a drawable, export-safe cover.
 *
 * Order: local sources directly → cross-origin with `crossOrigin=anonymous` →
 * fetch to a blob → same-origin proxy. The first that works wins.
 */
export async function loadCover(url: string): Promise<LoadedCover> {
  const cached = cache.get(url);
  if (cached) return cached;

  const task = (async () => {
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
      return loadImageElement(url, null);
    }
    try {
      return await loadImageElement(url, 'anonymous');
    } catch {
      /* fall through */
    }
    try {
      return await loadThroughFetch(url);
    } catch {
      /* fall through */
    }
    return loadImageElement(proxiedUrl(url), 'anonymous');
  })();

  cache.set(url, task);
  try {
    return await task;
  } catch (error) {
    cache.delete(url);
    throw error;
  }
}

export function clearCoverCache(): void {
  cache.clear();
}

/** Reads an uploaded file into a data URL, which is always export-safe. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export function isSupportedImage(file: File): boolean {
  return /^image\/(png|jpeg|jpg|webp|avif|gif)$/i.test(file.type);
}
