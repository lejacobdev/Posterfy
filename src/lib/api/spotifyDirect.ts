/**
 * Browser-side Spotify client.
 *
 * Used only when the visitor has saved their own credentials in Settings —
 * the case for a static deployment (GitHub Pages and friends) where there is no
 * server to hold a secret. The credentials never leave the visitor's browser
 * except in the request to Spotify itself.
 *
 * When the deployment does have a server, `spotify.ts` is used instead and the
 * secret stays server-side, which is always preferable.
 */

import type { Album, AlbumSummary, Track } from '@/lib/types';
import { ApiError, type RequestOptions } from './client';
import { readStorage, STORAGE_KEYS } from '@/lib/store/storage';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

interface Credentials {
  clientId: string;
  clientSecret: string;
}

let cachedToken: { value: string; expiresAt: number; owner: string } | null = null;

export function getStoredCredentials(): Credentials | null {
  const stored = readStorage<Credentials | null>(STORAGE_KEYS.credentials, null);
  if (!stored?.clientId || !stored?.clientSecret) return null;
  return stored;
}

export function hasStoredCredentials(): boolean {
  return getStoredCredentials() !== null;
}

export function clearTokenCache(): void {
  cachedToken = null;
}

async function getToken(credentials: Credentials): Promise<string> {
  const owner = credentials.clientId;
  if (cachedToken && cachedToken.owner === owner && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new ApiError(
      'Spotify rejected those credentials',
      response.status,
      'spotify_auth_failed',
    );
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    owner,
    expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

async function request<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  options: RequestOptions = {},
): Promise<T> {
  const credentials = getStoredCredentials();
  if (!credentials) throw new ApiError('No stored credentials', 401, 'no_credentials');

  const token = await getToken(credentials);
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: options.signal ?? null,
  });

  if (response.status === 401) {
    // Force a fresh token on the next call and surface the failure.
    cachedToken = null;
    throw new ApiError('Spotify session expired', 401, 'spotify_unauthorized');
  }
  if (response.status === 429) {
    throw new ApiError('Spotify rate limit reached', 429, 'rate_limited');
  }
  if (!response.ok) {
    throw new ApiError('Spotify request failed', response.status, 'spotify_request_failed');
  }
  return (await response.json()) as T;
}

interface SpotifyImage {
  url: string;
  width?: number;
}

interface SpotifyAlbumPayload {
  id: string;
  name?: string;
  uri?: string;
  release_date?: string;
  label?: string;
  genres?: string[];
  total_tracks?: number;
  images?: SpotifyImage[];
  artists?: Array<{ id?: string; name?: string }>;
  external_urls?: { spotify?: string };
  tracks?: { items?: SpotifyTrackPayload[]; next?: string | null };
}

interface SpotifyTrackPayload {
  name?: string;
  duration_ms?: number;
  track_number?: number;
  disc_number?: number;
  explicit?: boolean;
}

/** Spotify ships three sizes per album: roughly 640, 300 and 64 pixels wide. */
function pickImage(
  images: SpotifyImage[] | undefined,
  size: 'large' | 'medium' | 'small',
): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (size === 'small') return sorted[sorted.length - 1]?.url ?? null;
  if (size === 'medium')
    return sorted[Math.floor(sorted.length / 2)]?.url ?? sorted[0]?.url ?? null;
  return sorted[0]?.url ?? null;
}

function artistNames(album: SpotifyAlbumPayload): string {
  return (album.artists ?? [])
    .map((artist) => artist.name ?? '')
    .filter(Boolean)
    .join(', ');
}

export async function searchAlbumsDirect(
  query: string,
  options: RequestOptions & { limit?: number; market?: string } = {},
): Promise<AlbumSummary[]> {
  const data = await request<{ albums?: { items?: SpotifyAlbumPayload[] } }>(
    '/search',
    { q: query, type: 'album', limit: options.limit ?? 12, market: options.market },
    options,
  );

  return (data.albums?.items ?? []).filter(Boolean).map((album) => ({
    id: album.id,
    source: 'spotify' as const,
    title: album.name ?? '',
    artist: artistNames(album),
    releaseDate: album.release_date ?? '',
    // Thumbnail-sized, like the server route: see normalizeSearchResults.
    coverUrl: pickImage(album.images, 'small'),
    totalTracks: album.total_tracks ?? 0,
  }));
}

export async function getAlbumDirect(
  id: string,
  options: RequestOptions & { market?: string } = {},
): Promise<Album> {
  const album = await request<SpotifyAlbumPayload>(
    `/albums/${id}`,
    { market: options.market },
    options,
  );

  const items = [...(album.tracks?.items ?? [])];
  // Albums longer than 50 tracks paginate; pull the rest in order.
  let offset = items.length;
  while (album.tracks?.next && offset < 300 && items.length === offset) {
    const page = await request<{ items?: SpotifyTrackPayload[]; next?: string | null }>(
      `/albums/${id}/tracks`,
      { limit: 50, offset },
      options,
    );
    const pageItems = page.items ?? [];
    if (pageItems.length === 0) break;
    items.push(...pageItems);
    offset += pageItems.length;
    if (!page.next) break;
  }

  const tracks: Track[] = items
    .map((track, index) => ({
      position: track.track_number ?? index + 1,
      title: track.name ?? '',
      durationMs: track.duration_ms ?? 0,
      discNumber: track.disc_number ?? 1,
      explicit: Boolean(track.explicit),
    }))
    .sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || a.position - b.position)
    .map((track, index) => ({ ...track, position: index + 1 }));

  let genres = album.genres ?? [];
  if (genres.length === 0 && album.artists?.[0]?.id) {
    try {
      const artist = await request<{ genres?: string[] }>(
        `/artists/${album.artists[0].id}`,
        {},
        options,
      );
      genres = (artist.genres ?? []).slice(0, 4);
    } catch {
      /* genres are optional */
    }
  }

  return {
    id: album.id,
    source: 'spotify',
    title: album.name ?? '',
    artist: artistNames(album),
    releaseDate: album.release_date ?? '',
    coverUrl: pickImage(album.images, 'medium'),
    coverUrlHiRes: pickImage(album.images, 'large'),
    tracks,
    genres,
    label: album.label ?? null,
    totalDurationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
    uri: album.uri ?? null,
    externalUrl: album.external_urls?.spotify ?? null,
  };
}

/** Verifies a credential pair by asking for a token. */
export async function verifyCredentials(credentials: Credentials): Promise<boolean> {
  try {
    clearTokenCache();
    await getToken(credentials);
    return true;
  } catch {
    return false;
  }
}
