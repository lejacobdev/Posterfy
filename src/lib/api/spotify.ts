/**
 * Spotify provider — talks to our own `/api/search` and `/api/album`
 * endpoints, which hold the client secret server-side.
 *
 * The API surface is deliberately flat (one path segment): nested paths did
 * not route reliably on every static host, and a flat surface behaves
 * identically across the dev server, the Node server and serverless.
 */

import type { Album, AlbumSummary, ProviderId } from '@/lib/types';
import { getJson, type RequestOptions } from './client';

interface SearchResponse {
  results: AlbumSummary[];
  /** Which backend actually answered — the server picks it, not the client. */
  provider?: ProviderId;
}

interface AlbumResponse {
  album: Album;
}

export interface ProviderConfig {
  spotify: boolean;
  /** The keyless provider, served through our own API. */
  musicbrainz?: boolean;
  /**
   * True only when our API answered. Doubles as the "is there a server at all"
   * signal: on a purely static host the config request fails and this is false.
   */
  imageProxy: boolean;
}

let configPromise: Promise<ProviderConfig> | null = null;

/** Tells the UI whether Spotify search is available on this deployment. */
export function getProviderConfig(): Promise<ProviderConfig> {
  if (!configPromise) {
    configPromise = getJson<ProviderConfig>('/api/config', { timeoutMs: 6000 }).catch(() => ({
      spotify: false,
      imageProxy: false,
    }));
  }
  return configPromise;
}

export function resetProviderConfig(): void {
  configPromise = null;
}

export async function searchSpotifyAlbums(
  query: string,
  options: RequestOptions & { limit?: number; market?: string } = {},
): Promise<AlbumSummary[]> {
  return (await searchViaServer(query, options)).items;
}

/**
 * Searches through our own API, which chooses Spotify or MusicBrainz itself.
 * The client no longer has to know which providers are configured.
 */
export async function searchViaServer(
  query: string,
  options: RequestOptions & { limit?: number; market?: string } = {},
): Promise<{ items: AlbumSummary[]; provider: ProviderId }> {
  const params = new URLSearchParams({ q: query, limit: String(options.limit ?? 12) });
  if (options.market) params.set('market', options.market);
  const data = await getJson<SearchResponse>(`/api/search?${params}`, options);
  return { items: data.results ?? [], provider: data.provider ?? 'spotify' };
}

export async function getSpotifyAlbum(
  id: string,
  options: RequestOptions & { market?: string; source?: ProviderId } = {},
): Promise<Album> {
  const params = new URLSearchParams({ id });
  if (options.market) params.set('market', options.market);
  if (options.source) params.set('source', options.source);
  const data = await getJson<AlbumResponse>(`/api/album?${params}`, options);
  return data.album;
}

/** Playlists are a Spotify-only concept — there is no MusicBrainz fallback. */
export async function searchSpotifyPlaylists(
  query: string,
  options: RequestOptions & { limit?: number; market?: string } = {},
): Promise<{ items: AlbumSummary[]; provider: ProviderId }> {
  const params = new URLSearchParams({
    q: query,
    type: 'playlist',
    limit: String(options.limit ?? 12),
  });
  if (options.market) params.set('market', options.market);
  const data = await getJson<SearchResponse>(`/api/search?${params}`, options);
  return { items: data.results ?? [], provider: data.provider ?? 'spotify' };
}

/**
 * A playlist normalised into the same `Album` shape a real album takes, so
 * the response is parsed identically — the server wraps it under the same
 * `album` key.
 */
export async function getSpotifyPlaylist(
  id: string,
  options: RequestOptions & { market?: string } = {},
): Promise<Album> {
  const params = new URLSearchParams({ id });
  if (options.market) params.set('market', options.market);
  const data = await getJson<AlbumResponse>(`/api/playlist?${params}`, options);
  return data.album;
}

/** Accepts a Spotify URL, URI or bare id and returns the album id. */
export function parseSpotifyAlbumId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9]{22}$/.test(value)) return value;

  const uriMatch = /^spotify:album:([A-Za-z0-9]{22})$/.exec(value);
  if (uriMatch?.[1]) return uriMatch[1];

  try {
    const url = new URL(value);
    if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;
    const match = /\/album\/([A-Za-z0-9]{22})/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
