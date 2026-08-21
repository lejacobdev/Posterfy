/**
 * Recent posters: every album or playlist the user has posterised, kept as a
 * capped, most-recently-updated-first list so a reload or a return visit can
 * pick straight back up instead of starting from a blank search.
 *
 * Deliberately its own module rather than folded into `poster.tsx`: the
 * single "current poster" the editor holds is one thing, this list of many
 * is another, and neither needs the other's internals.
 */

import type { Album, PosterOptions, PosterSpec, SubjectKind } from '@/lib/types';
import { readStorage, STORAGE_KEYS, writeStorage } from './storage';

export interface RecentPoster {
  /** The subject's own id — an album, a playlist, or a per-session id for a manual draft. */
  id: string;
  kind: SubjectKind;
  title: string;
  artist: string;
  coverUrl: string | null;
  template: PosterOptions['template'];
  updatedAt: number;
  spec: PosterSpec;
}

/** Comfortably more than anyone keeps distinct posters going at once. */
const RECENT_LIMIT = 24;

export function listRecent(): RecentPoster[] {
  return readStorage<RecentPoster[]>(STORAGE_KEYS.recent, []);
}

/**
 * What the poster actually displays: a manual draft's title/artist live in
 * the override fields, not on the album itself (there is no album — it is
 * typed straight into the options), so reading `album.title` alone would
 * call every hand-built poster untitled.
 */
function effectiveTitleAndArtist(album: Album, options: PosterOptions) {
  return {
    title: options.titleOverride.trim() || album.title,
    artist: options.artistOverride.trim() || album.artist,
  };
}

/** Whether this poster has enough content yet to be worth remembering. */
export function hasRecentContent(album: Album, options: PosterOptions): boolean {
  const { title, artist } = effectiveTitleAndArtist(album, options);
  return Boolean(title || artist || album.coverUrl || album.tracks.length > 0);
}

/**
 * Records the current spec as the latest state of its subject. Re-editing an
 * album already in the list updates that entry and moves it to the front
 * rather than adding a duplicate.
 */
export function upsertRecent(album: Album, options: PosterOptions): void {
  // The pristine, never-touched placeholder — nothing to remember yet.
  if (album.id === 'draft') return;

  const { title, artist } = effectiveTitleAndArtist(album, options);
  const entry: RecentPoster = {
    id: album.id,
    kind: album.kind === 'playlist' ? 'playlist' : 'album',
    title,
    artist,
    coverUrl: album.coverUrl,
    template: options.template,
    updatedAt: Date.now(),
    spec: { album, options },
  };

  const next = [entry, ...listRecent().filter((existing) => existing.id !== album.id)].slice(
    0,
    RECENT_LIMIT,
  );
  writeStorage(STORAGE_KEYS.recent, next);
}

export function removeRecent(id: string): void {
  writeStorage(
    STORAGE_KEYS.recent,
    listRecent().filter((entry) => entry.id !== id),
  );
}
