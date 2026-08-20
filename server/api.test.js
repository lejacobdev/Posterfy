/**
 * Tests for the shared API handler.
 *
 * The same handler runs behind Vite dev middleware, the Node server and the
 * Vercel catch-all function, so these tests exercise it directly with mock
 * request/response objects rather than booting a server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApiRequest, hasSpotifyCredentials } from './api.js';
import { parseEnv } from './env.js';

function mockReq(url, { method = 'GET', headers = {} } = {}) {
  return {
    url,
    method,
    headers: { host: 'posterfy.app', ...headers },
    socket: { remoteAddress: `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
  };
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    ended: false,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    getHeader(key) {
      return this.headers[key.toLowerCase()];
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.ended = true;
    },
  };
  return res;
}

function json(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

describe('routing', () => {
  it('ignores paths outside /api', async () => {
    const res = mockRes();
    expect(await handleApiRequest(mockReq('/create'), res)).toBe(false);
    expect(res.ended).toBe(false);
  });

  it('answers the health check', async () => {
    const res = mockRes();
    expect(await handleApiRequest(mockReq('/api/health'), res)).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(json(res).status).toBe('ok');
  });

  it('reports which providers are available', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/config'), res);
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ spotify: expect.any(Boolean), imageProxy: true });
  });

  it('404s an unknown /api path', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/nope'), res);
    expect(res.statusCode).toBe(404);
  });

  // Vercel's catch-all keeps query strings and nested paths intact.
  it('dispatches on the path even with a query string', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/health?cachebust=1'), res);
    expect(res.statusCode).toBe(200);
  });

  it('answers CORS preflight', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/config', { method: 'OPTIONS' }), res);
    expect(res.statusCode).toBe(204);
    expect(res.getHeader('access-control-allow-methods')).toContain('GET');
  });

  it('rejects non-GET methods', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/config', { method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
  });
});

// Vercel's splat route can hand over the bracket filename plus the captured
// segments in a `path` parameter. These lock in that nested routes still work.
describe('splat path normalisation', () => {
  it('recovers a single-segment route', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/[...path]?path=config'), res);
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ imageProxy: true });
  });

  it('recovers a nested route', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/[...path]?path=search'), res);
    // Reaches the search handler, which rejects the missing query itself
    // rather than the request falling through to a 404.
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('missing_query');
  });

  it('leaves an already-correct path alone', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/health?path=search'), res);
    expect(res.statusCode).toBe(200);
    expect(json(res).status).toBe('ok');
  });

  it('cannot be walked out of /api', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/[...path]?path=../../etc/passwd'), res);
    // Traversal segments are dropped, so this lands on an unknown API route.
    expect(res.statusCode).toBe(404);
    expect(json(res).error).toBe('not_found');
  });
});

describe('spotify routes', () => {
  it('rejects a search with no query', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/search'), res);
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('missing_query');
  });

  it('rejects a malformed album id before calling out', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/album?id=../../etc/passwd'), res);
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_id');
  });

  // Search deliberately does NOT fail when Spotify is unconfigured any more —
  // it falls back to MusicBrainz. Only the album lookup, which needs a specific
  // Spotify id, still reports the missing configuration.
  it('reports missing configuration only where it cannot fall back', async () => {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;

    expect(hasSpotifyCredentials()).toBe(false);
    const res = mockRes();
    await handleApiRequest(mockReq('/api/album?id=4aawyAB9vmqN3uQ7FjRGTy'), res);
    expect(res.statusCode).toBe(501);
    expect(json(res).error).toBe('spotify_not_configured');

    if (id) process.env.SPOTIFY_CLIENT_ID = id;
    if (secret) process.env.SPOTIFY_CLIENT_SECRET = secret;
  });
});

describe('image proxy', () => {
  it('requires a url', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/image'), res);
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('missing_url');
  });

  it('rejects an unparseable url', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/image?url=not-a-url'), res);
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_url');
  });

  it('requires https', async () => {
    const res = mockRes();
    await handleApiRequest(
      mockReq(`/api/image?url=${encodeURIComponent('http://i.scdn.co/image/abc')}`),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('https_required');
  });

  it('refuses hosts outside the allowlist', async () => {
    for (const host of [
      'https://evil.example.com/x.png',
      'https://scdn.co.evil.com/x.png',
      'http://169.254.169.254/latest/meta-data',
      'https://localhost/x.png',
    ]) {
      const res = mockRes();
      await handleApiRequest(mockReq(`/api/image?url=${encodeURIComponent(host)}`), res);
      expect([400, 403], `${host} was not refused`).toContain(res.statusCode);
    }
  });
});

describe('parseEnv', () => {
  it('reads simple pairs and skips comments', () => {
    const values = parseEnv('# comment\nA=1\n\nB=two\n');
    expect(values).toEqual({ A: '1', B: 'two' });
  });

  it('strips matching quotes but keeps inner ones', () => {
    expect(parseEnv('A="hello"').A).toBe('hello');
    expect(parseEnv("B='hi'").B).toBe('hi');
    expect(parseEnv('C="say "hi""').C).toBe('say "hi"');
  });

  it('keeps = characters inside a value', () => {
    expect(parseEnv('TOKEN=abc=def==').TOKEN).toBe('abc=def==');
  });

  it('ignores malformed lines', () => {
    expect(parseEnv('NOEQUALS\n=novalue\n')).toEqual({});
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    // Each test uses a distinct client address via mockReq.
  });

  it('rejects a client that floods the API', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.99' };
    let limited = false;

    for (let i = 0; i < 130; i += 1) {
      const res = mockRes();
      await handleApiRequest(mockReq('/api/health', { headers }), res);
      if (res.statusCode === 429) {
        limited = true;
        expect(res.getHeader('retry-after')).toBe('60');
        break;
      }
    }

    expect(limited).toBe(true);
  });
});

/**
 * The keyless path. These mock the network so the routing and normalisation
 * are verified without depending on MusicBrainz being reachable.
 */
describe('musicbrainz fallback', () => {
  const MB_ID = 'f5093c06-23e3-404f-aeaa-40f72885ee3a';
  let savedId;
  let savedSecret;

  function mockJson(payload) {
    return vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
  }

  beforeEach(() => {
    savedId = process.env.SPOTIFY_CLIENT_ID;
    savedSecret = process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedId) process.env.SPOTIFY_CLIENT_ID = savedId;
    if (savedSecret) process.env.SPOTIFY_CLIENT_SECRET = savedSecret;
  });

  it('answers search from MusicBrainz when Spotify is not configured', async () => {
    const fetchMock = mockJson({
      'release-groups': [
        {
          id: MB_ID,
          title: 'Northern Signal',
          'first-release-date': '1985-05-13',
          'artist-credit': [{ name: 'Halden Frost' }],
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = mockRes();
    await handleApiRequest(mockReq('/api/search?q=northern'), res);

    expect(res.statusCode).toBe(200);
    const body = json(res);
    expect(body.provider).toBe('musicbrainz');
    expect(body.results[0]).toMatchObject({
      id: MB_ID,
      source: 'musicbrainz',
      title: 'Northern Signal',
      artist: 'Halden Frost',
    });
    expect(body.results[0].coverUrl).toContain('coverartarchive.org');

    // MusicBrainz asks for a descriptive User-Agent; a browser cannot set one,
    // which is exactly why this call belongs on the server.
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['User-Agent']).toContain('Posterfy');
  });

  it('routes a UUID album id to MusicBrainz and normalises the tracks', async () => {
    vi.stubGlobal(
      'fetch',
      mockJson({
        releases: [
          {
            id: MB_ID,
            title: 'Northern Signal',
            date: '1985-05-13',
            'artist-credit': [{ name: 'Halden Frost' }],
            'label-info': [{ label: { name: 'Meridian Sound' } }],
            media: [
              {
                position: 1,
                tracks: [
                  { title: 'Long Way North', length: 200000 },
                  { title: 'Signal Fires', length: 180000 },
                ],
              },
            ],
          },
        ],
      }),
    );

    const res = mockRes();
    await handleApiRequest(mockReq(`/api/album?id=${MB_ID}`), res);

    expect(res.statusCode).toBe(200);
    const album = json(res).album;
    expect(album.source).toBe('musicbrainz');
    expect(album.label).toBe('Meridian Sound');
    expect(album.tracks).toHaveLength(2);
    expect(album.tracks[0]).toMatchObject({ position: 1, title: 'Long Way North' });
    expect(album.totalDurationMs).toBe(380000);
  });

  it('picks the release with the most tracks for a group', async () => {
    vi.stubGlobal(
      'fetch',
      mockJson({
        releases: [
          { id: MB_ID, title: 'Single edit', media: [{ tracks: [{ title: 'Only' }] }] },
          {
            id: MB_ID,
            title: 'Full album',
            media: [{ tracks: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }],
          },
        ],
      }),
    );

    const res = mockRes();
    await handleApiRequest(mockReq(`/api/album?id=${MB_ID}`), res);
    expect(json(res).album.tracks).toHaveLength(3);
  });

  it('still rejects a Spotify id when Spotify is unconfigured', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/album?id=4aawyAB9vmqN3uQ7FjRGTy'), res);
    expect(res.statusCode).toBe(501);
    expect(json(res).error).toBe('spotify_not_configured');
  });

  it('advertises the keyless provider in the config', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/config'), res);
    expect(json(res)).toMatchObject({ spotify: false, musicbrainz: true, imageProxy: true });
  });
});

/**
 * Artwork source. Cover Art Archive is missing art for many release groups, so
 * Spotify supplies it whenever credentials exist.
 */
describe('artwork resolution', () => {
  const MB_ID = 'f5093c06-23e3-404f-aeaa-40f72885ee3a';

  const RELEASE = {
    releases: [
      {
        id: MB_ID,
        title: 'Brothers in Arms',
        date: '1985-05-13',
        'artist-credit': [{ name: 'Dire Straits' }],
        media: [{ position: 1, tracks: [{ title: 'So Far Away', length: 300000 }] }],
      },
    ],
  };

  /** Routes each request by URL: MusicBrainz, Spotify token, Spotify search. */
  function routedFetch(spotifyItems) {
    return vi.fn(async (input) => {
      const url = String(input);
      const body = url.includes('musicbrainz.org')
        ? RELEASE
        : url.includes('accounts.spotify.com')
          ? { access_token: 'test-token', expires_in: 3600 }
          : { albums: { items: spotifyItems } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
  }

  const SPOTIFY_MATCH = [
    {
      id: 'sp1',
      name: 'Brothers in Arms',
      artists: [{ name: 'Dire Straits' }],
      images: [
        { url: 'https://i.scdn.co/image/big', width: 640 },
        { url: 'https://i.scdn.co/image/mid', width: 300 },
      ],
    },
  ];

  let savedId;
  let savedSecret;

  beforeEach(() => {
    savedId = process.env.SPOTIFY_CLIENT_ID;
    savedSecret = process.env.SPOTIFY_CLIENT_SECRET;
    process.env.SPOTIFY_CLIENT_ID = 'id';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedId) process.env.SPOTIFY_CLIENT_ID = savedId;
    else delete process.env.SPOTIFY_CLIENT_ID;
    if (savedSecret) process.env.SPOTIFY_CLIENT_SECRET = savedSecret;
    else delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  it('uses Spotify artwork for a MusicBrainz album', async () => {
    vi.stubGlobal('fetch', routedFetch(SPOTIFY_MATCH));

    const res = mockRes();
    await handleApiRequest(mockReq(`/api/album?id=${MB_ID}&source=musicbrainz`), res);

    const album = json(res).album;
    expect(album.coverUrl).toContain('i.scdn.co');
    expect(album.coverUrlHiRes).toBe('https://i.scdn.co/image/big');
    // Metadata still comes from MusicBrainz.
    expect(album.source).toBe('musicbrainz');
    expect(album.tracks).toHaveLength(1);
  });

  it('keeps Cover Art Archive when Spotify has no confident match', async () => {
    vi.stubGlobal(
      'fetch',
      routedFetch([
        {
          id: 'sp2',
          name: 'A Totally Different Record',
          artists: [{ name: 'Someone Else' }],
          images: [],
        },
      ]),
    );

    const res = mockRes();
    await handleApiRequest(mockReq(`/api/album?id=${MB_ID}&source=musicbrainz`), res);

    const album = json(res).album;
    expect(album.coverUrl).toContain('coverartarchive.org');
  });

  it('falls back to Cover Art Archive with no Spotify credentials', async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    vi.stubGlobal('fetch', routedFetch(SPOTIFY_MATCH));

    const res = mockRes();
    await handleApiRequest(mockReq(`/api/album?id=${MB_ID}&source=musicbrainz`), res);

    expect(json(res).album.coverUrl).toContain('coverartarchive.org');
  });
});
