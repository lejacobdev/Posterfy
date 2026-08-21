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
/** Fallback timeout for any call that does not (yet) pass an explicit one. */
const REQUEST_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 8000);

/**
 * Total time a request handler may spend calling upstreams, kept safely under
 * the 10-second ceiling a Vercel function gets. `/api/search` and `/api/album`
 * can each chain several upstream calls — Spotify, a retry of Spotify,
 * MusicBrainz, a Spotify cover lookup — and none of them used to share a
 * budget, so a slow link anywhere in the chain could add up to well past 10s
 * and get the whole function killed with an opaque platform error instead of
 * our own clear one. Every call in a chain now takes a `deadline` (an absolute
 * timestamp) instead of a fixed timeout, so the chain adapts to what actually
 * happened rather than always spending the same amount regardless: a fast
 * Spotify response leaves more room for a MusicBrainz fallback; a slow one
 * leaves less, and eventually an upstream call is skipped rather than
 * attempted, so the handler returns its own error instead of being killed.
 */
function requestBudgetMs() {
  return Number(process.env.REQUEST_BUDGET_MS ?? 8500);
}

/**
 * A proxied image is one hop with nothing to fall back to afterward, so unlike
 * the chains above it can safely spend nearly the whole ceiling rather than
 * sharing their smaller multi-hop budget. It still needs its own bound: Cover
 * Art Archive redirects to archive.org, which is occasionally slow enough that
 * an unbounded wait would hang the function outright.
 */
const IMAGE_TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS ?? 9200);

function newDeadline() {
  return Date.now() + requestBudgetMs();
}

/**
 * Spotify's own docs put `/v1/search`'s `limit` at 1-50, but a Development Mode
 * app that has not been approved for Extended Quota Mode is held to a lower
 * ceiling than that on the search endpoint specifically — this app's has been
 * confirmed at 10: `limit=10` succeeds, `limit=11` and above (even the
 * documented default of 20) come back `400 "Invalid limit"`. Capping what we
 * request keeps every search answering from Spotify instead of a request for
 * more than 10 results falling back to MusicBrainz on every single query.
 */
function spotifySearchLimit() {
  return Number(process.env.SPOTIFY_SEARCH_LIMIT ?? 10);
}

/** Whether at least `minMs` remains before `deadline`. */
function hasBudget(deadline, minMs = 600) {
  return deadline - Date.now() >= minMs;
}

/** Time left before `deadline`, for use as a fetch timeout once hasBudget() passed. */
function timeLeft(deadline) {
  return Math.max(0, deadline - Date.now());
}

function budgetExhausted() {
  return Object.assign(new Error('upstream_timeout'), { status: 503, retryAfter: 2 });
}

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
async function getSpotifyToken(deadline) {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  if (!hasSpotifyCredentials())
    throw Object.assign(new Error('spotify_not_configured'), { status: 501 });
  if (!hasBudget(deadline)) throw budgetExhausted();

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64');

  const response = await fetchWithTimeout(
    SPOTIFY_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    },
    timeLeft(deadline),
  );

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

/**
 * Calls the Spotify API, retrying once for the two failures that a second
 * attempt actually fixes — but only while `deadline` allows it, so a retry can
 * never be what pushes the handler past Vercel's ceiling.
 *
 * Without the retry either failure degrades the whole search to the keyless
 * provider, which is why search could answer from Spotify one moment and
 * MusicBrainz the next:
 *
 *   401 — the cached token was rotated or revoked while this instance stayed
 *         warm. Dropping it and asking again succeeds immediately.
 *   5xx — Spotify itself hiccupped. A single retry costs one round trip and
 *         saves the user a visibly worse set of results.
 *
 * Everything else (400, 403, 429) means a second identical call would fail
 * the same way, so it is reported rather than repeated.
 *
 * `deadline` defaults to a fresh budget so an unmigrated caller still works,
 * but every call site in this file passes the one its handler is already
 * spending, so a whole chain shares one clock rather than each link getting
 * its own.
 */
async function spotifyRequest(path, searchParams = {}, deadline = newDeadline(), attempt = 0) {
  if (!hasBudget(deadline)) throw budgetExhausted();

  const token = await getSpotifyToken(deadline);
  const url = new URL(`${SPOTIFY_API}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }

  if (!hasBudget(deadline)) throw budgetExhausted();

  const response = await fetchWithTimeout(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    timeLeft(deadline),
  );

  if (response.status === 401) {
    cachedToken = { value: null, expiresAt: 0 };
    if (attempt === 0 && hasBudget(deadline)) {
      return spotifyRequest(path, searchParams, deadline, attempt + 1);
    }
    // 502, not 401: the caller is not the one who failed to authenticate.
    throw Object.assign(new Error('spotify_unauthorized'), { status: 502 });
  }
  if (response.status === 429) {
    throw Object.assign(new Error('spotify_rate_limited'), {
      status: 429,
      retryAfter: Number(response.headers.get('retry-after') ?? 5),
    });
  }
  if (response.status >= 500 && attempt === 0 && hasBudget(deadline)) {
    return spotifyRequest(path, searchParams, deadline, attempt + 1);
  }
  if (!response.ok) {
    // Spotify's own error body says *why* a 400/403 happened (an unsupported
    // market, a malformed query, a restricted app) — the status code alone
    // does not. Best-effort: a non-JSON body just leaves detail undefined.
    const detail = await spotifyErrorDetail(response);
    throw Object.assign(new Error('spotify_request_failed'), {
      status: response.status,
      detail,
    });
  }
  return response.json();
}

async function spotifyErrorDetail(response) {
  try {
    const data = await response.json();
    return data?.error?.message ?? null;
  } catch {
    return null;
  }
}

function pickImage(images, preference = 'large') {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (preference === 'small') return sorted[sorted.length - 1]?.url ?? null;
  if (preference === 'medium') return sorted[Math.floor(sorted.length / 2)]?.url ?? sorted[0].url;
  return sorted[0]?.url ?? null;
}

function albumToSummary(album, matchedTrack) {
  return {
    id: album.id,
    source: 'spotify',
    title: album.name ?? '',
    artist: (album.artists ?? []).map((artist) => artist.name).join(', '),
    releaseDate: album.release_date ?? '',
    // Search rows draw this into a 46px thumbnail, so take Spotify's smallest
    // image (64px). The full-size artwork is fetched later, per album, by the
    // renderer — a result list would otherwise pull a dozen 300px covers the
    // user never sees.
    coverUrl: pickImage(album.images, 'small'),
    totalTracks: album.total_tracks ?? 0,
    // Set only when this album surfaced because one of its songs matched the
    // query rather than the album itself — the UI uses it to explain the hit.
    ...(matchedTrack ? { matchedTrack } : {}),
  };
}

/**
 * Merges album hits with the albums behind track hits, so searching for a
 * song ("walk of life") finds the record it is on ("Brothers in Arms")
 * without the user having to already know the album title. A track's album
 * payload from `/search` is the same shape `/albums/{id}` normally supplies
 * artwork and metadata from, so no extra request is needed to show it.
 */
function normalizeSearchResults(payload) {
  const albumItems = (payload?.albums?.items ?? []).filter(Boolean);
  const trackItems = (payload?.tracks?.items ?? []).filter(Boolean);

  const byId = new Map();
  const results = [];
  for (const album of albumItems) {
    if (!album.id || byId.has(album.id)) continue;
    const summary = albumToSummary(album);
    byId.set(album.id, summary);
    results.push(summary);
  }
  for (const track of trackItems) {
    const album = track.album;
    // A track with no album at all (a local file placeholder) — nothing to
    // add either way.
    if (!album?.id) continue;
    const existing = byId.get(album.id);
    if (existing) {
      // Spotify's own album search can already match this record for reasons
      // it never exposes (it appears to search track content, not just the
      // album's own title) — the matching track sitting right here is the
      // only way to tell the client's fuzzy ranker why, so a song search
      // doesn't drop an album Spotify itself already vouched for.
      if (!existing.matchedTrack && track.name) existing.matchedTrack = track.name;
      continue;
    }
    const summary = albumToSummary(album, track.name);
    byId.set(album.id, summary);
    results.push(summary);
  }
  return results;
}

async function fetchAllTracks(albumId, firstPage, deadline) {
  const tracks = [...(firstPage?.items ?? [])];
  let next = firstPage?.next;
  let guard = 0;
  // A box set could need several pages; once the budget is gone, returning
  // what has been fetched so far beats throwing away a mostly-complete list.
  while (next && guard < 10 && hasBudget(deadline)) {
    guard += 1;
    const page = await spotifyRequest(
      `/albums/${albumId}/tracks`,
      { limit: 50, offset: tracks.length },
      deadline,
    );
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

async function musicbrainzRequest(path, params, deadline = newDeadline()) {
  // MusicBrainz calls queue behind each other (see mbSchedule) to honour its
  // one-request-per-second policy, so check before even joining that queue —
  // a request with no time left would either wait for nothing or, worse, wait
  // long enough to blow the ceiling on its own.
  if (!hasBudget(deadline, 800)) throw budgetExhausted();

  const url = new URL(`${MB_API}${path}`);
  url.searchParams.set('fmt', 'json');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await mbSchedule(() => {
    // Re-checked here: the wait inside mbSchedule can itself take up to
    // 1100ms, which may have used up what little budget was left.
    if (!hasBudget(deadline, 300)) throw budgetExhausted();
    return fetchWithTimeout(
      url,
      { headers: { 'User-Agent': MB_USER_AGENT, Accept: 'application/json' } },
      timeLeft(deadline),
    );
  });

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

/**
 * Artwork resolution.
 *
 * Cover Art Archive has no image for a large share of release groups, and the
 * ones it does have vary in size. Spotify always serves a consistent 640px
 * cover, so whenever credentials are present the artwork is taken from there
 * and the Archive is kept only as the no-credentials fallback.
 */

/** Loose comparison so punctuation and case do not defeat a real match. */
function normaliseTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Finds the Spotify cover for an album by name. Returns null rather than
 * guessing when nothing matches confidently, so a wrong sleeve is never shown.
 */
async function spotifyCoverFor(title, artist, deadline = newDeadline()) {
  if (!hasSpotifyCredentials() || !title) return null;
  // A nice-to-have enrichment, not the album fetch itself: skip it outright
  // once budget is tight rather than spending what little is left on it.
  if (!hasBudget(deadline, 800)) return null;

  const query = artist ? `album:${title} artist:${artist}` : `album:${title}`;
  let items = [];
  try {
    const payload = await spotifyRequest(
      '/search',
      { q: query, type: 'album', limit: 5 },
      deadline,
    );
    items = payload?.albums?.items ?? [];
  } catch (error) {
    console.warn('[posterfy:api] spotify cover lookup failed:', error?.message);
    return null;
  }

  const wantTitle = normaliseTitle(title);
  const wantArtist = normaliseTitle(artist);

  const match = items.filter(Boolean).find((album) => {
    if (normaliseTitle(album.name) !== wantTitle) return false;
    if (!wantArtist) return true;
    return (album.artists ?? []).some((a) => normaliseTitle(a.name) === wantArtist);
  });
  if (!match) return null;

  return {
    coverUrl: pickImage(match.images, 'medium'),
    coverUrlHiRes: pickImage(match.images, 'large'),
  };
}

async function musicbrainzSearch(query, limit, deadline = newDeadline()) {
  const data = await musicbrainzRequest(
    '/release-group',
    { query: `${query} AND (primarytype:album OR primarytype:ep)`, limit },
    deadline,
  );

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

async function musicbrainzAlbum(releaseGroupId, deadline = newDeadline()) {
  const data = await musicbrainzRequest(
    '/release',
    { 'release-group': releaseGroupId, inc: 'recordings+artist-credits+labels', limit: 25 },
    deadline,
  );

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

  const title = release.title ?? '';
  const artist = mbArtist(release['artist-credit']);

  // One extra request per album selection, which buys consistent artwork.
  const spotifyArt = await spotifyCoverFor(title, artist, deadline);

  return {
    id: releaseGroupId,
    source: 'musicbrainz',
    title,
    artist,
    releaseDate: release.date ?? '',
    coverUrl: spotifyArt?.coverUrl ?? mbCoverUrl(releaseGroupId, 500),
    coverUrlHiRes: spotifyArt?.coverUrlHiRes ?? mbCoverUrl(releaseGroupId, 1200),
    tracks,
    genres: [],
    label: release['label-info']?.[0]?.label?.name ?? null,
    totalDurationMs: tracks.reduce((sum, t) => sum + t.durationMs, 0),
    uri: null,
    externalUrl: `https://musicbrainz.org/release-group/${releaseGroupId}`,
  };
}

/**
 * Runs one real Spotify search and reports the outcome.
 *
 * Search degrades to MusicBrainz silently by design — a working search matters
 * more than which backend answered — but that makes a persistent Spotify
 * failure invisible without server logs. This says exactly what happened, and
 * never leaks the credentials themselves.
 *
 * `market` and `limit` mirror what the browser sends, because a bare probe
 * cannot prove the real search works: an unsupported market is rejected with a
 * 400 that a parameterless probe would never see.
 */
async function probeSpotify({ market, limit } = {}) {
  const configured = hasSpotifyCredentials();
  if (!configured) {
    return { configured: false, ok: false, reason: 'no_credentials' };
  }

  const startedAt = Date.now();
  const params = {
    q: 'abbey road',
    type: 'album',
    limit: Math.min(limit ?? 1, spotifySearchLimit()),
    market,
  };
  try {
    const payload = await spotifyRequest('/search', params, newDeadline());
    return {
      configured: true,
      ok: true,
      results: payload?.albums?.items?.length ?? 0,
      market: market ?? null,
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      reason: error?.message ?? 'unknown',
      status: error?.status ?? null,
      detail: error?.detail ?? null,
      market: market ?? null,
      ms: Date.now() - startedAt,
    };
  }
}

async function handleSearch(url, res) {
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < 1) return sendJson(res, 400, { error: 'missing_query' });

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12)));
  const market = url.searchParams.get('market') ?? undefined;
  let degradedReason = null;
  let degradedDetail = null;
  // Shared by every upstream call this request makes, Spotify and MusicBrainz
  // alike, so a slow link anywhere in the chain leaves less for what follows
  // instead of each one getting a full timeout of its own.
  const deadline = newDeadline();

  // Spotify when it is configured, MusicBrainz otherwise. Either way the client
  // gets the same shape back and never has to know which one answered.
  if (hasSpotifyCredentials()) {
    try {
      const payload = await spotifyRequest(
        '/search',
        // Both types in one call, so a song title finds its album without a
        // second request: Spotify applies `limit` per type, not shared.
        { q: query, type: 'album,track', limit: Math.min(limit, spotifySearchLimit()), market },
        deadline,
      );
      return sendJson(
        res,
        200,
        { results: normalizeSearchResults(payload), provider: 'spotify' },
        300,
      );
    } catch (error) {
      // A Spotify outage should degrade to the keyless provider, not 500.
      if (error?.status === 429) throw error;
      // The status is the whole diagnosis — 401 means the credentials are
      // dead, 403 means the app is restricted — so log it, not just the name.
      degradedReason = `${error?.message ?? 'unknown'}:${error?.status ?? '?'}`;
      degradedDetail = error?.detail ?? null;
      console.warn(
        `[posterfy:api] spotify search failed (${degradedReason}), falling back to musicbrainz`,
        degradedDetail ? `— ${degradedDetail}` : '',
      );
    }
  }

  if (!hasBudget(deadline, 800)) {
    // Whatever Spotify spent has left too little to also try MusicBrainz.
    // Saying so plainly beats attempting a call almost certain to be killed
    // by the platform instead of answered by us.
    throw Object.assign(new Error(degradedReason ?? 'search_timeout'), {
      status: 503,
      retryAfter: 2,
    });
  }

  const results = await musicbrainzSearch(query, limit, deadline);
  // `reason` (and `detail`, Spotify's own error message when it had one)
  // travel with the response so a fallback can be diagnosed from a browser,
  // without access to the server logs.
  return sendJson(
    res,
    200,
    {
      results,
      provider: 'musicbrainz',
      ...(degradedReason ? { reason: degradedReason } : {}),
      ...(degradedDetail ? { detail: degradedDetail } : {}),
    },
    300,
  );
}

const MB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{10,40}$/;

async function handleAlbum(url, res) {
  const id = (url.searchParams.get('id') ?? '').trim();
  const source = (url.searchParams.get('source') ?? '').trim();

  // MusicBrainz ids are UUIDs; Spotify ids are base62. The shape is enough to
  // route on, and `source` settles it when a caller is explicit.
  const isMusicBrainz = source === 'musicbrainz' || (source !== 'spotify' && MB_ID_RE.test(id));
  const deadline = newDeadline();

  if (isMusicBrainz) {
    if (!MB_ID_RE.test(id)) return sendJson(res, 400, { error: 'invalid_id' });
    const album = await musicbrainzAlbum(id, deadline);
    return sendJson(res, 200, { album }, 3600);
  }

  if (!SPOTIFY_ID_RE.test(id)) return sendJson(res, 400, { error: 'invalid_id' });
  if (!hasSpotifyCredentials()) {
    return sendJson(res, 501, { error: 'spotify_not_configured' });
  }

  const album = await spotifyRequest(
    `/albums/${id}`,
    { market: url.searchParams.get('market') ?? undefined },
    deadline,
  );
  const tracks = await fetchAllTracks(id, album.tracks, deadline);
  let normalized = normalizeAlbum(album, tracks);

  // Album genres are usually empty on Spotify; the artist carries them
  // instead. Optional enrichment, so only attempted while budget allows it.
  if (normalized.genres.length === 0 && album.artists?.[0]?.id && hasBudget(deadline, 800)) {
    try {
      const artist = await spotifyRequest(`/artists/${album.artists[0].id}`, {}, deadline);
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

  // A single hop with nothing to fall back to afterward, so it gets its own
  // larger, independent timeout rather than the multi-hop chains' budget —
  // see IMAGE_TIMEOUT_MS.
  const upstream = await fetchWithTimeout(
    parsed,
    { headers: { 'User-Agent': 'Posterfy/1.0 (+https://posterfy.app)' } },
    IMAGE_TIMEOUT_MS,
  );
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
        // `?spotify=1` actually calls Spotify and reports what came back, so a
        // "results from MusicBrainz" fallback can be diagnosed from a phone.
        if (url.searchParams.get('spotify')) {
          sendJson(
            res,
            200,
            await probeSpotify({
              market: url.searchParams.get('market') ?? undefined,
              limit: Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 1))),
            }),
          );
          return true;
        }
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
