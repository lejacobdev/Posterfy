/**
 * Posterfy API.
 *
 * A single dependency-free request handler that is mounted three ways:
 *   - Vite dev middleware (`vite.config.ts`)
 *   - the bundled Node production server (`server/index.js`)
 *   - a Vercel serverless function (`api/index.js`)
 *
 * It exists for two reasons: to keep the Spotify client secret off the client,
 * and to re-serve remote artwork with CORS headers so posters can be exported
 * from a canvas without tainting it.
 */

import { Buffer } from 'node:buffer';
import { loadEnv } from './env.js';

// Populate process.env from a local .env before anything reads credentials.
loadEnv();

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1';

/** Hosts the image proxy is willing to fetch from. */
const IMAGE_HOST_ALLOWLIST = [
  /^i\.scdn\.co$/,
  /^mosaic\.scdn\.co$/,
  /^scannables\.scdn\.co$/,
  /^[\w-]+\.spotifycdn\.com$/,
  /^coverartarchive\.org$/,
  /^ia\d*\.us\.archive\.org$/,
  /^archive\.org$/,
];

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
/**
 * Upstream timeout. Deliberately under the 10s ceiling a Vercel Hobby function
 * gets, so a slow upstream returns our own JSON error rather than being killed
 * by the platform with an opaque 504.
 */
const REQUEST_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 8000);

let cachedToken = { value: null, expiresAt: 0 };

/** Naive fixed-window rate limiter — enough to keep a public deploy healthy. */
const rateLimitBuckets = new Map();
const RATE_LIMIT = { windowMs: 60_000, max: 120 };

function rateLimited(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.max) return true;
  return false;
}

// Keep the bucket map from growing without bound on long-lived servers.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (now > bucket.resetAt) rateLimitBuckets.delete(key);
  }
}, RATE_LIMIT.windowMs).unref?.();

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(req, res) {
  const origins = allowedOrigins();
  const origin = req.headers.origin;
  if (origins.length > 0 && origin && origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    cacheSeconds > 0 ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}` : 'no-store',
  );
  res.end(JSON.stringify(body));
}

function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function hasSpotifyCredentials() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/** Client-credentials token, cached until a minute before it expires. */
async function getSpotifyToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  if (!hasSpotifyCredentials())
    throw Object.assign(new Error('spotify_not_configured'), { status: 501 });

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64');

  const response = await fetchWithTimeout(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw Object.assign(new Error('spotify_auth_failed'), { status: 502 });
  }
  const data = await response.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

async function spotifyRequest(path, searchParams = {}) {
  const token = await getSpotifyToken();
  const url = new URL(`${SPOTIFY_API}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }

  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Token was revoked early — drop it so the next call re-authenticates.
    cachedToken = { value: null, expiresAt: 0 };
    throw Object.assign(new Error('spotify_unauthorized'), { status: 502 });
  }
  if (response.status === 429) {
    throw Object.assign(new Error('spotify_rate_limited'), {
      status: 429,
      retryAfter: Number(response.headers.get('retry-after') ?? 5),
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error('spotify_request_failed'), { status: response.status });
  }
  return response.json();
}

function pickImage(images, preference = 'large') {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (preference === 'small') return sorted[sorted.length - 1]?.url ?? null;
  if (preference === 'medium') return sorted[Math.floor(sorted.length / 2)]?.url ?? sorted[0].url;
  return sorted[0]?.url ?? null;
}

function normalizeSearchResults(payload) {
  const items = payload?.albums?.items ?? [];
  return items.filter(Boolean).map((album) => ({
    id: album.id,
    source: 'spotify',
    title: album.name ?? '',
    artist: (album.artists ?? []).map((artist) => artist.name).join(', '),
    releaseDate: album.release_date ?? '',
    coverUrl: pickImage(album.images, 'medium'),
    totalTracks: album.total_tracks ?? 0,
  }));
}

async function fetchAllTracks(albumId, firstPage) {
  const tracks = [...(firstPage?.items ?? [])];
  let next = firstPage?.next;
  let guard = 0;
  while (next && guard < 10) {
    guard += 1;
    const page = await spotifyRequest(`/albums/${albumId}/tracks`, {
      limit: 50,
      offset: tracks.length,
    });
    tracks.push(...(page.items ?? []));
    next = page.next;
  }
  return tracks;
}

function normalizeAlbum(album, tracks) {
  const normalizedTracks = tracks
    .filter(Boolean)
    .map((track, index) => ({
      position: track.track_number ?? index + 1,
      title: track.name ?? '',
      durationMs: track.duration_ms ?? 0,
      discNumber: track.disc_number ?? 1,
      explicit: Boolean(track.explicit),
    }))
    .sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || a.position - b.position)
    .map((track, index) => ({ ...track, position: index + 1 }));

  return {
    id: album.id,
    source: 'spotify',
    title: album.name ?? '',
    artist: (album.artists ?? []).map((artist) => artist.name).join(', '),
    releaseDate: album.release_date ?? '',
    coverUrl: pickImage(album.images, 'medium'),
    coverUrlHiRes: pickImage(album.images, 'large'),
    tracks: normalizedTracks,
    genres: album.genres ?? [],
    label: album.label ?? null,
    totalDurationMs: normalizedTracks.reduce((sum, track) => sum + track.durationMs, 0),
    uri: album.uri ?? null,
    externalUrl: album.external_urls?.spotify ?? null,
  };
}

async function handleSearch(url, res) {
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < 1) return sendJson(res, 400, { error: 'missing_query' });

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12)));
  const market = url.searchParams.get('market') ?? undefined;
  const payload = await spotifyRequest('/search', { q: query, type: 'album', limit, market });
  return sendJson(res, 200, { results: normalizeSearchResults(payload) }, 300);
}

async function handleAlbum(url, res) {
  const id = (url.searchParams.get('id') ?? '').trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return sendJson(res, 400, { error: 'invalid_id' });

  const album = await spotifyRequest(`/albums/${id}`, {
    market: url.searchParams.get('market') ?? undefined,
  });
  const tracks = await fetchAllTracks(id, album.tracks);
  let normalized = normalizeAlbum(album, tracks);

  // Album genres are usually empty on Spotify; the artist carries them instead.
  if (normalized.genres.length === 0 && album.artists?.[0]?.id) {
    try {
      const artist = await spotifyRequest(`/artists/${album.artists[0].id}`);
      normalized = { ...normalized, genres: (artist.genres ?? []).slice(0, 4) };
    } catch {
      /* genres stay empty */
    }
  }

  return sendJson(res, 200, { album: normalized }, 3600);
}

async function handleImage(url, res) {
  const target = url.searchParams.get('url');
  if (!target) return sendJson(res, 400, { error: 'missing_url' });

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return sendJson(res, 400, { error: 'invalid_url' });
  }

  if (parsed.protocol !== 'https:') return sendJson(res, 400, { error: 'https_required' });
  if (!IMAGE_HOST_ALLOWLIST.some((pattern) => pattern.test(parsed.hostname))) {
    return sendJson(res, 403, { error: 'host_not_allowed' });
  }

  const upstream = await fetchWithTimeout(parsed, {
    headers: { 'User-Agent': 'Posterfy/1.0 (+https://posterfy.app)' },
  });
  if (!upstream.ok || !upstream.body) {
    return sendJson(res, 502, { error: 'upstream_failed', status: upstream.status });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    return sendJson(res, 415, { error: 'not_an_image' });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return sendJson(res, 413, { error: 'image_too_large' });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.byteLength));
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.end(buffer);
  return true;
}

/**
 * Handles an `/api/*` request.
 * Returns `false` when the path is not ours, so a host can fall through.
 */
export async function handleApiRequest(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) return false;

  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return true;
  }
  if (rateLimited(clientKey(req))) {
    res.setHeader('Retry-After', '60');
    sendJson(res, 429, { error: 'rate_limited' });
    return true;
  }

  try {
    switch (url.pathname) {
      case '/api/health':
        sendJson(res, 200, { status: 'ok', uptime: Math.round(process.uptime()) });
        return true;

      case '/api/config':
        sendJson(res, 200, { spotify: hasSpotifyCredentials(), imageProxy: true }, 60);
        return true;

      case '/api/spotify/search':
        await handleSearch(url, res);
        return true;

      case '/api/spotify/album':
        await handleAlbum(url, res);
        return true;

      case '/api/image':
        await handleImage(url, res);
        return true;

      default:
        sendJson(res, 404, { error: 'not_found' });
        return true;
    }
  } catch (error) {
    const status = error?.status ?? 500;
    const body = { error: error?.message ?? 'internal_error' };
    if (error?.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    // A missing Spotify config is a deployment choice, not a fault worth logging.
    const expected = error?.message === 'spotify_not_configured';
    if (status >= 500 && !expected) console.error('[posterfy:api]', url.pathname, error);
    sendJson(res, status, body);
    return true;
  }
}

export default handleApiRequest;
