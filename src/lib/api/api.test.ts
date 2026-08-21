import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSpotifyPlaylist, parseSpotifyAlbumId, searchSpotifyPlaylists } from './spotify';
import { getAlbum, looksLikeAlbumLink, searchPlaylists } from './provider';
import { coverArtUrl } from './musicbrainz';
import { createRateLimiter } from './client';
import type { Album, AlbumSummary } from '@/lib/types';

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

function mockJsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('searchSpotifyPlaylists', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests type=playlist and returns the server-normalised results', async () => {
    let requestedUrl = '';
    const summary: AlbumSummary = {
      id: 'pl1',
      source: 'spotify',
      kind: 'playlist',
      title: "Today's Top Hits",
      artist: 'Spotify',
      releaseDate: '',
      coverUrl: null,
      totalTracks: 50,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ results: [summary], provider: 'spotify' }), {
          status: 200,
        });
      }),
    );

    const result = await searchSpotifyPlaylists('today');
    expect(requestedUrl).toContain('/api/search?');
    expect(requestedUrl).toContain('type=playlist');
    expect(result).toEqual({ items: [summary], provider: 'spotify' });
  });
});

describe('getSpotifyPlaylist', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches /api/playlist and unwraps the album key', async () => {
    let requestedUrl = '';
    const album: Album = {
      id: 'pl1',
      source: 'spotify',
      kind: 'playlist',
      title: 'Road Trip',
      artist: 'Jamie',
      releaseDate: '',
      coverUrl: null,
      coverUrlHiRes: null,
      tracks: [],
      genres: [],
      label: null,
      totalDurationMs: 0,
      uri: null,
      externalUrl: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ album }), { status: 200 });
      }),
    );

    const result = await getSpotifyPlaylist('pl1');
    expect(requestedUrl).toContain('/api/playlist?id=pl1');
    expect(result).toEqual(album);
  });
});

describe('provider: playlist routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searchPlaylists never falls back to MusicBrainz — it surfaces whatever the server returns', async () => {
    vi.stubGlobal(
      'fetch',
      mockJsonFetch({
        results: [{ id: 'pl1', source: 'spotify', kind: 'playlist', title: 'Chill', artist: '' }],
        provider: 'spotify',
      }),
    );

    const result = await searchPlaylists('chill');
    expect(result.provider).toBe('spotify');
    expect(result.degraded).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it('returns an empty result for a blank query without calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPlaylists('   ');
    expect(result).toEqual({ items: [], provider: 'spotify', degraded: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getAlbum routes a playlist-kind summary to /api/playlist, skipping the album fallback chain', async () => {
    let requestedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        requestedUrl = String(input);
        return new Response(
          JSON.stringify({
            album: { id: 'pl1', source: 'spotify', kind: 'playlist', title: 'Road Trip' },
          }),
          { status: 200 },
        );
      }),
    );

    const album = await getAlbum({ id: 'pl1', source: 'spotify', kind: 'playlist' });
    expect(requestedUrl).toContain('/api/playlist');
    expect(album.title).toBe('Road Trip');
  });
});
