import { describe, expect, it } from 'vitest';
import { parseSpotifyAlbumId } from './spotify';
import { looksLikeAlbumLink } from './provider';
import { coverArtUrl } from './musicbrainz';
import { createRateLimiter } from './client';

const ALBUM_ID = '4aawyAB9vmqN3uQ7FjRGTy';

describe('parseSpotifyAlbumId', () => {
  it('accepts a bare id', () => {
    expect(parseSpotifyAlbumId(ALBUM_ID)).toBe(ALBUM_ID);
  });

  it('accepts a spotify URI', () => {
    expect(parseSpotifyAlbumId(`spotify:album:${ALBUM_ID}`)).toBe(ALBUM_ID);
  });

  it('accepts an open.spotify.com link with query parameters', () => {
    expect(parseSpotifyAlbumId(`https://open.spotify.com/album/${ALBUM_ID}?si=abc123`)).toBe(
      ALBUM_ID,
    );
  });

  it('accepts a localised link path', () => {
    expect(parseSpotifyAlbumId(`https://open.spotify.com/intl-de/album/${ALBUM_ID}`)).toBe(
      ALBUM_ID,
    );
  });

  it('rejects other hosts and shapes', () => {
    expect(parseSpotifyAlbumId('https://example.com/album/4aawyAB9vmqN3uQ7FjRGTy')).toBeNull();
    expect(parseSpotifyAlbumId(`https://open.spotify.com/track/${ALBUM_ID}`)).toBeNull();
    expect(parseSpotifyAlbumId('not a link')).toBeNull();
    expect(parseSpotifyAlbumId('')).toBeNull();
  });
});

describe('looksLikeAlbumLink', () => {
  it('detects Spotify and MusicBrainz links', () => {
    expect(looksLikeAlbumLink(`https://open.spotify.com/album/${ALBUM_ID}`)).toBe(true);
    expect(
      looksLikeAlbumLink(
        'https://musicbrainz.org/release-group/f5093c06-23e3-404f-aeaa-40f72885ee3a',
      ),
    ).toBe(true);
  });

  it('treats ordinary search terms as text', () => {
    expect(looksLikeAlbumLink('northern signal')).toBe(false);
  });
});

describe('coverArtUrl', () => {
  it('builds a Cover Art Archive url at the requested size', () => {
    expect(coverArtUrl('abc', 500)).toBe('https://coverartarchive.org/release-group/abc/front-500');
    expect(coverArtUrl('abc', 1200)).toContain('front-1200');
  });
});

describe('createRateLimiter', () => {
  it('runs tasks in order', async () => {
    const schedule = createRateLimiter(0);
    const order: number[] = [];
    await Promise.all([
      schedule(async () => order.push(1)),
      schedule(async () => order.push(2)),
      schedule(async () => order.push(3)),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('keeps running after a task rejects', async () => {
    const schedule = createRateLimiter(0);
    await expect(schedule(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(schedule(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('spaces calls by the configured interval', async () => {
    const schedule = createRateLimiter(40);
    const start = Date.now();
    await schedule(() => Promise.resolve());
    await schedule(() => Promise.resolve());
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });
});
