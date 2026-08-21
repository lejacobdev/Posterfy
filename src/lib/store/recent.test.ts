import { describe, expect, it } from 'vitest';
import { hasRecentContent, listRecent, removeRecent, upsertRecent } from './recent';
import { createEmptyAlbum, DEFAULT_OPTIONS } from '@/lib/poster/defaults';
import type { Album } from '@/lib/types';

function demoAlbum(overrides: Partial<Album> = {}): Album {
  return {
    ...createEmptyAlbum(),
    id: 'sp1',
    source: 'spotify',
    title: 'Brothers in Arms',
    artist: 'Dire Straits',
    coverUrl: 'https://i.scdn.co/image/x',
    tracks: [{ position: 1, title: 'So Far Away', durationMs: 200_000 }],
    ...overrides,
  };
}

describe('hasRecentContent', () => {
  it('is false for the pristine empty album', () => {
    expect(hasRecentContent(createEmptyAlbum(), DEFAULT_OPTIONS)).toBe(false);
  });

  it('is true once a real album/playlist is selected', () => {
    expect(hasRecentContent(demoAlbum(), DEFAULT_OPTIONS)).toBe(true);
  });

  it('is true for a manual draft with only a title override — no album fields set', () => {
    const album = createEmptyAlbum();
    const options = { ...DEFAULT_OPTIONS, titleOverride: 'My Test Poster' };
    expect(hasRecentContent(album, options)).toBe(true);
  });

  it('is true for a manual draft with only an artist override', () => {
    const album = createEmptyAlbum();
    const options = { ...DEFAULT_OPTIONS, artistOverride: 'Test Artist' };
    expect(hasRecentContent(album, options)).toBe(true);
  });
});

describe('upsertRecent', () => {
  it('never records the pristine draft placeholder', () => {
    upsertRecent(createEmptyAlbum(), DEFAULT_OPTIONS);
    expect(listRecent()).toEqual([]);
  });

  it('records an album, most-recent first', () => {
    upsertRecent(demoAlbum(), DEFAULT_OPTIONS);
    const [entry] = listRecent();
    expect(entry).toMatchObject({
      id: 'sp1',
      kind: 'album',
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
      coverUrl: 'https://i.scdn.co/image/x',
    });
  });

  it('tags a playlist subject with kind: playlist', () => {
    upsertRecent(demoAlbum({ id: 'pl1', kind: 'playlist', artist: 'Spotify' }), DEFAULT_OPTIONS);
    expect(listRecent()[0]).toMatchObject({ id: 'pl1', kind: 'playlist' });
  });

  it('uses the override-aware title/artist for a manual draft, not the blank album fields', () => {
    const album = { ...createEmptyAlbum(), id: 'manual-1' };
    const options = {
      ...DEFAULT_OPTIONS,
      titleOverride: 'My Test Poster',
      artistOverride: 'Test Artist',
    };
    upsertRecent(album, options);
    expect(listRecent()[0]).toMatchObject({ title: 'My Test Poster', artist: 'Test Artist' });
  });

  it('updates and re-fronts an existing entry instead of duplicating it', () => {
    upsertRecent(demoAlbum(), DEFAULT_OPTIONS);
    upsertRecent(demoAlbum({ title: 'Brothers in Arms (Remaster)' }), DEFAULT_OPTIONS);
    const recent = listRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.title).toBe('Brothers in Arms (Remaster)');
  });

  it('moves a re-edited older entry back to the front', () => {
    upsertRecent(demoAlbum({ id: 'a' }), DEFAULT_OPTIONS);
    upsertRecent(demoAlbum({ id: 'b' }), DEFAULT_OPTIONS);
    upsertRecent(demoAlbum({ id: 'a' }), DEFAULT_OPTIONS);
    expect(listRecent().map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('caps the list at 24 entries, dropping the oldest', () => {
    for (let i = 0; i < 30; i += 1) {
      upsertRecent(demoAlbum({ id: `album-${i}` }), DEFAULT_OPTIONS);
    }
    const recent = listRecent();
    expect(recent).toHaveLength(24);
    // Most recently upserted stays at the front; the earliest ones fall off.
    expect(recent[0]?.id).toBe('album-29');
    expect(recent.map((entry) => entry.id)).not.toContain('album-0');
  });

  it('keeps the full spec so the poster can be reopened exactly as it was', () => {
    const album = demoAlbum();
    const options = { ...DEFAULT_OPTIONS, template: 'vinyl' as const };
    upsertRecent(album, options);
    expect(listRecent()[0]?.spec).toEqual({ album, options });
  });
});

describe('removeRecent', () => {
  it('removes only the matching entry', () => {
    upsertRecent(demoAlbum({ id: 'a' }), DEFAULT_OPTIONS);
    upsertRecent(demoAlbum({ id: 'b' }), DEFAULT_OPTIONS);
    removeRecent('a');
    expect(listRecent().map((entry) => entry.id)).toEqual(['b']);
  });

  it('is a no-op for an id that is not in the list', () => {
    upsertRecent(demoAlbum({ id: 'a' }), DEFAULT_OPTIONS);
    removeRecent('missing');
    expect(listRecent()).toHaveLength(1);
  });
});
