/**
 * Tests for the shared API handler.
 *
 * The same handler runs behind Vite dev middleware, the Node server and the
 * Vercel catch-all function, so these tests exercise it directly with mock
 * request/response objects rather than booting a server.
 */

import { beforeEach, describe, expect, it } from 'vitest';
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

describe('spotify routes', () => {
  it('rejects a search with no query', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/spotify/search'), res);
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('missing_query');
  });

  it('rejects a malformed album id before calling out', async () => {
    const res = mockRes();
    await handleApiRequest(mockReq('/api/spotify/album?id=../../etc/passwd'), res);
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_id');
  });

  it('reports when Spotify is not configured', async () => {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;

    expect(hasSpotifyCredentials()).toBe(false);
    const res = mockRes();
    await handleApiRequest(mockReq('/api/spotify/search?q=test'), res);
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
