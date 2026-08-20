import type { CSSProperties } from 'react';
import { demoAlbum } from '@/lib/demo/demoAlbums';

/**
 * Background style for the 3D scene surfaces. Falls back to the generated demo
 * artwork so the hero always has something to show, even before an album is
 * picked and even with no network.
 */
export function demoCoverStyle(coverUrl?: string): CSSProperties {
  const url = coverUrl ?? demoAlbum(0).coverUrl;
  if (!url) return {};
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
