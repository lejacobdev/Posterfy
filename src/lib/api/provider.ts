/**
 * Unified music provider.
 *
 * Search goes to Spotify when the deployment has credentials and falls back to
 * MusicBrainz otherwise (or when Spotify errors), so the editor always has a
 * working search box.
 */

import type { Album, AlbumSummary, ProviderId } from '@/lib/types';
import { ApiError, isAbortError, type RequestOptions } from './client';
import {
  getProviderConfig,
  getSpotifyAlbum,
  parseSpotifyAlbumId,
  searchViaServer,
} from './spotify';
import { getMusicBrainzAlbum, searchMusicBrainzAlbums } from './musicbrainz';
import { getAlbumDirect, hasStoredCredentials, searchAlbumsDirect } from './spotifyDirect';

export interface SearchResult {
  items: AlbumSummary[];
  /** Which backend actually answered — surfaced in the UI. */
  provider: ProviderId;
  /** Set when the preferred provider failed and we degraded. */
  degraded: boolean;
}

export interface SearchOptions extends RequestOptions {
  limit?: number;
  market?: string;
  /** Forces a specific backend instead of auto-selecting. */
  provider?: ProviderId;
}

/**
 * Fetches the provider config ahead of time.
 *
 * `searchAlbums` awaits it before it can pick a backend, so without this the
 * very first search is two serial round trips instead of one. Call it when the
 * search box mounts; it is memoised, so later calls are free.
 */
export function prefetchProviders(): void {
  void getProviderConfig();
}

/**
 * Searches for albums.
 *
 * Whenever our own API is reachable it answers, because it covers *both*
 * providers server-side and picks between them itself. That keeps credentials
 * off the client and avoids calling MusicBrainz from the browser, which is
 * unreliable: it wants a descriptive User-Agent that a browser cannot set and
 * rate-limits per IP.
 *
 * The browser-direct paths below are only for a purely static deployment,
 * where there is no server to ask.
 */
export async function searchAlbums(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { items: [], provider: 'musicbrainz', degraded: false };

  const config = await getProviderConfig();
  const forced = options.provider;

  // `imageProxy` is only true when our API actually answered, so it doubles as
  // the "is there a server here at all" signal.
  if (config.imageProxy && !forced) {
    try {
      const { items, provider } = await searchViaServer(trimmed, options);
      return { items, provider, degraded: provider !== 'spotify' && config.spotify };
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Fall through to whatever the browser can reach on its own.
    }
  }

  if ((forced ?? 'spotify') === 'spotify' && hasStoredCredentials()) {
    try {
      const items = await searchAlbumsDirect(trimmed, options);
      return { items, provider: 'spotify', degraded: false };
    } catch (error) {
      if (isAbortError(error)) throw error;
    }
  }

  const items = await searchMusicBrainzAlbums(trimmed, options);
  return { items, provider: 'musicbrainz', degraded: true };
}

export async function getAlbum(
  summary: Pick<AlbumSummary, 'id' | 'source'>,
  options: RequestOptions & { market?: string } = {},
): Promise<Album> {
  const config = await getProviderConfig();

  // The API resolves both providers, so hand it the source and let it route.
  if (config.imageProxy && (summary.source === 'spotify' || summary.source === 'musicbrainz')) {
    try {
      return await getSpotifyAlbum(summary.id, { ...options, source: summary.source });
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Fall through to the browser-direct paths below.
    }
  }

  if (summary.source === 'spotify') {
    if (hasStoredCredentials()) return getAlbumDirect(summary.id, options);
    return getSpotifyAlbum(summary.id, options);
  }
  if (summary.source === 'musicbrainz') return getMusicBrainzAlbum(summary.id, options);
  throw new ApiError('Manual albums are edited locally', 400, 'manual_album');
}

/**
 * Resolves a pasted Spotify link/URI directly to an album, so users can jump
 * straight to a specific release instead of searching for it.
 */
export async function getAlbumFromLink(
  input: string,
  options: RequestOptions = {},
): Promise<Album | null> {
  const spotifyId = parseSpotifyAlbumId(input);
  if (spotifyId) {
    const config = await getProviderConfig();
    if (!config.spotify) {
      throw new ApiError(
        'Spotify links need Spotify search enabled',
        501,
        'spotify_not_configured',
      );
    }
    return getSpotifyAlbum(spotifyId, options);
  }

  const mbMatch = /musicbrainz\.org\/release-group\/([0-9a-f-]{36})/i.exec(input.trim());
  if (mbMatch?.[1]) return getMusicBrainzAlbum(mbMatch[1], options);

  return null;
}

export function looksLikeAlbumLink(input: string): boolean {
  const value = input.trim();
  return (
    parseSpotifyAlbumId(value) !== null ||
    /musicbrainz\.org\/release-group\/[0-9a-f-]{36}/i.test(value)
  );
}
