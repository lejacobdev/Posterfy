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

/* ---------------------------------------------------------------------------
 * MusicBrainz + Cover Art Archive
 *
 * Runs here rather than in the browser for two reasons: MusicBrainz asks for a
 * descriptive User-Agent (which a browser cannot set), and its one-request-per
 * -second limit is far easier to honour from a single place. This is what makes
 * search work on a deployment that has no Spotify credentials.
 * ------------------------------------------------------------------------ */

const MB_API = 'https://musicbrainz.org/ws/2';
const COVER_ART = 'https://coverartarchive.org';
const MB_USER_AGENT = 'Posterfy/1.0 ( https://github.com/lejacobdev/Posterfy )';

let mbChain = Promise.resolve();
let mbLastRun = 0;

/** Serialises MusicBrainz calls with a minimum gap, as their policy requires. */
function mbSchedule(task) {
  const run = mbChain.then(async () => {
    const wait = Math.max(0, mbLastRun + 1100 - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    mbLastRun = Date.now();
    return task();
  });
  mbChain = run.catch(() => undefined);
  return run;
}

async function musicbrainzRequest(path, params) {
  const url = new URL(`${MB_API}${path}`);
  url.searchParams.set('fmt', 'json');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await mbSchedule(() =>
    fetchWithTimeout(url, { headers: { 'User-Agent': MB_USER_AGENT, Accept: 'application/json' } }),
  );

  if (response.status === 503) {
    throw Object.assign(new Error('musicbrainz_busy'), { status: 503, retryAfter: 2 });
  }
  if (!response.ok) {
    throw Object.assign(new Error('musicbrainz_request_failed'), { status: 502 });
  }
  return response.json();
}

function mbCoverUrl(releaseGroupId, size) {
  return `${COVER_ART}/release-group/${releaseGroupId}/front-${size}`;
}

function mbArtist(credits) {
  if (!Array.isArray(credits)) return '';
  return credits
    .map((c) => `${c.name ?? ''}${c.joinphrase ?? ''}`)
    .join('')
    .trim();
}

async function musicbrainzSearch(query, limit) {
  const data = await musicbrainzRequest('/release-group', {
    query: `${query} AND (primarytype:album OR primarytype:ep)`,
    limit,
  });

  return (data['release-groups'] ?? []).map((group) => ({
    id: group.id,
    source: 'musicbrainz',
    title: group.title ?? '',
    artist: mbArtist(group['artist-credit']),
    releaseDate: group['first-release-date'] ?? '',
    coverUrl: mbCoverUrl(group.id, 250),
    totalTracks: 0,
  }));
}

async function musicbrainzAlbum(releaseGroupId) {
  const data = await musicbrainzRequest('/release', {
    'release-group': releaseGroupId,
    inc: 'recordings+artist-credits+labels',
    limit: 25,
  });

  // Prefer the release with the most tracks, then the earliest date.
  const release = [...(data.releases ?? [])].sort((a, b) => {
    const at = (a.media ?? []).reduce((sum, m) => sum + (m.tracks?.length ?? 0), 0);
    const bt = (b.media ?? []).reduce((sum, m) => sum + (m.tracks?.length ?? 0), 0);
    if (at !== bt) return bt - at;
    return (a.date ?? '9999').localeCompare(b.date ?? '9999');
  })[0];

  if (!release) throw Object.assign(new Error('album_not_found'), { status: 404 });

  const tracks = [];
  (release.media ?? []).forEach((disc, discIndex) => {
    (disc.tracks ?? []).forEach((track, trackIndex) => {
      const title = track.title ?? track.recording?.title ?? '';
      if (!title) return;
      tracks.push({
        position: tracks.length + 1,
        title,
        durationMs: track.length ?? track.recording?.length ?? 0,
        discNumber: disc.position ?? discIndex + 1,
        explicit: false,
      });
      void trackIndex;
    });
  });

  return {
    id: releaseGroupId,
    source: 'musicbrainz',
    title: release.title ?? '',
    artist: mbArtist(release['artist-credit']),
    releaseDate: release.date ?? '',
    coverUrl: mbCoverUrl(releaseGroupId, 500),
    coverUrlHiRes: mbCoverUrl(releaseGroupId, 1200),
    tracks,
    genres: [],
    label: release['label-info']?.[0]?.label?.name ?? null,
    totalDurationMs: tracks.reduce((sum, t) => sum + t.durationMs, 0),
    uri: null,
    externalUrl: `https://musicbrainz.org/release-group/${releaseGroupId}`,
  };
}

async function handleSearch(url, res) {
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < 1) return sendJson(res, 400, { error: 'missing_query' });

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12)));
  const market = url.searchParams.get('market') ?? undefined;

  // Spotify when it is configured, MusicBrainz otherwise. Either way the client
  // gets the same shape back and never has to know which one answered.
  if (hasSpotifyCredentials()) {
    try {
      const payload = await spotifyRequest('/search', { q: query, type: 'album', limit, market });
      return sendJson(
        res,
        200,
        { results: normalizeSearchResults(payload), provider: 'spotify' },
        300,
      );
    } catch (error) {
      // A Spotify outage should degrade to the keyless provider, not 500.
      if (error?.status === 429) throw error;
      console.warn('[posterfy:api] spotify search failed, falling back:', error?.message);
    }
  }

  const results = await musicbrainzSearch(query, limit);
  return sendJson(res, 200, { results, provider: 'musicbrainz' }, 300);
}

const MB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{10,40}$/;

async function handleAlbum(url, res) {
  const id = (url.searchParams.get('id') ?? '').trim();
  const source = (url.searchParams.get('source') ?? '').trim();

  // MusicBrainz ids are UUIDs; Spotify ids are base62. The shape is enough to
  // route on, and `source` settles it when a caller is explicit.
  const isMusicBrainz = source === 'musicbrainz' || (source !== 'spotify' && MB_ID_RE.test(id));

  if (isMusicBrainz) {
    if (!MB_ID_RE.test(id)) return sendJson(res, 400, { error: 'invalid_id' });
    const album = await musicbrainzAlbum(id);
    return sendJson(res, 200, { album }, 3600);
  }

  if (!SPOTIFY_ID_RE.test(id)) return sendJson(res, 400, { error: 'invalid_id' });
  if (!hasSpotifyCredentials()) {
    return sendJson(res, 501, { error: 'spotify_not_configured' });
  }

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
 * Restores the real path when a host routes through a splat file.
 *
 * Vercel's `api/[...path].js` normally arrives with `req.url` intact, but some
 * routing paths hand over the bracket filename plus the captured segments in a
 * `path` query parameter instead. Rebuilding the pathname from that parameter
 * makes the dispatcher below correct either way, and it is a no-op everywhere
 * else because no route of ours takes a `path` parameter.
 */
function normalizeSplatPath(url) {
  const captured = url.searchParams.get('path');
  if (!captured) return;
  if (url.pathname.startsWith('/api/') && !url.pathname.includes('[')) return;

  const segments = captured
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..');
  if (segments.length === 0) return;

  url.pathname = `/api/${segments.join('/')}`;
  url.searchParams.delete('path');
}

/**
 * Handles an `/api/*` request.
 * Returns `false` when the path is not ours, so a host can fall through.
 */
export async function handleApiRequest(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  normalizeSplatPath(url);
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
        sendJson(
          res,
          200,
          { spotify: hasSpotifyCredentials(), musicbrainz: true, imageProxy: true },
          60,
        );
        return true;

      case '/api/search':
        await handleSearch(url, res);
        return true;

      case '/api/album':
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
