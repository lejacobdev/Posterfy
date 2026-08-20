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
  searchSpotifyAlbums,
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
 * Resolves which backend to use.
 *
 * A server-side proxy is always preferred (the secret stays off the client);
 * credentials the visitor stored in their own browser are the fallback for
 * static deployments; MusicBrainz needs no credentials at all.
 */
async function resolveProvider(
  explicit?: ProviderId,
): Promise<{ id: ProviderId; direct: boolean }> {
  if (explicit) return { id: explicit, direct: explicit === 'spotify' && hasStoredCredentials() };
  const config = await getProviderConfig();
  if (config.spotify) return { id: 'spotify', direct: false };
  if (hasStoredCredentials()) return { id: 'spotify', direct: true };
  return { id: 'musicbrainz', direct: false };
}

export async function searchAlbums(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { items: [], provider: 'musicbrainz', degraded: false };

  const preferred = await resolveProvider(options.provider);

  if (preferred.id === 'spotify') {
    try {
      const items = preferred.direct
        ? await searchAlbumsDirect(trimmed, options)
        : await searchSpotifyAlbums(trimmed, options);
      return { items, provider: 'spotify', degraded: false };
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Spotify is optional: fall through to the keyless provider.
      const items = await searchMusicBrainzAlbums(trimmed, options);
      return { items, provider: 'musicbrainz', degraded: true };
    }
  }

  const items = await searchMusicBrainzAlbums(trimmed, options);
  return { items, provider: 'musicbrainz', degraded: false };
}

export async function getAlbum(
  summary: Pick<AlbumSummary, 'id' | 'source'>,
  options: RequestOptions & { market?: string } = {},
): Promise<Album> {
  if (summary.source === 'spotify') {
    const config = await getProviderConfig();
    if (!config.spotify && hasStoredCredentials()) return getAlbumDirect(summary.id, options);
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
