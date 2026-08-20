/**
 * MusicBrainz + Cover Art Archive provider.
 *
 * This is the keyless fallback: it needs no credentials, so Posterfy works out
 * of the box on a static host and keeps working if Spotify is unreachable.
 * MusicBrainz asks for at most one request per second, which the rate limiter
 * enforces.
 */

import type { Album, AlbumSummary, Track } from '@/lib/types';
import { createRateLimiter, getJson, type RequestOptions } from './client';

const MB_API = 'https://musicbrainz.org/ws/2';
const COVER_ART = 'https://coverartarchive.org';

const schedule = createRateLimiter(1100);

interface MbArtistCredit {
  name?: string;
  joinphrase?: string;
}

interface MbReleaseGroup {
  id: string;
  title?: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'artist-credit'?: MbArtistCredit[];
  tags?: Array<{ name?: string; count?: number }>;
}

interface MbSearchResponse {
  'release-groups'?: MbReleaseGroup[];
}

interface MbTrack {
  position?: number;
  number?: string;
  title?: string;
  length?: number | null;
  recording?: { title?: string; length?: number | null };
}

interface MbMedia {
  position?: number;
  tracks?: MbTrack[];
}

interface MbRelease {
  id: string;
  title?: string;
  date?: string;
  country?: string;
  media?: MbMedia[];
  'artist-credit'?: MbArtistCredit[];
  'label-info'?: Array<{ label?: { name?: string } }>;
}

interface MbReleaseListResponse {
  releases?: MbRelease[];
}

function creditToArtist(credits: MbArtistCredit[] | undefined): string {
  if (!credits || credits.length === 0) return '';
  return credits
    .map((credit) => `${credit.name ?? ''}${credit.joinphrase ?? ''}`)
    .join('')
    .trim();
}

/** Cover Art Archive serves a redirect to archive.org; both allow CORS. */
export function coverArtUrl(releaseGroupId: string, size: 250 | 500 | 1200 = 500): string {
  return `${COVER_ART}/release-group/${releaseGroupId}/front-${size}`;
}

export async function searchMusicBrainzAlbums(
  query: string,
  options: RequestOptions & { limit?: number } = {},
): Promise<AlbumSummary[]> {
  const limit = options.limit ?? 12;
  const params = new URLSearchParams({
    query: `${query} AND (primarytype:album OR primarytype:ep)`,
    fmt: 'json',
    limit: String(limit),
  });

  const data = await schedule(() =>
    getJson<MbSearchResponse>(`${MB_API}/release-group?${params}`, options),
  );

  return (data['release-groups'] ?? []).map((group) => ({
    id: group.id,
    source: 'musicbrainz' as const,
    title: group.title ?? '',
    artist: creditToArtist(group['artist-credit']),
    releaseDate: group['first-release-date'] ?? '',
    coverUrl: coverArtUrl(group.id, 250),
    totalTracks: 0,
  }));
}

function normalizeTracks(release: MbRelease): Track[] {
  const media = release.media ?? [];
  const tracks: Track[] = [];

  media.forEach((disc, discIndex) => {
    (disc.tracks ?? []).forEach((track, trackIndex) => {
      tracks.push({
        position: track.position ?? trackIndex + 1,
        title: track.title ?? track.recording?.title ?? '',
        durationMs: track.length ?? track.recording?.length ?? 0,
        discNumber: disc.position ?? discIndex + 1,
      });
    });
  });

  return tracks
    .filter((track) => track.title.length > 0)
    .map((track, index) => ({ ...track, position: index + 1 }));
}

/** Picks the release that best represents a group: most tracks, earliest date. */
function pickBestRelease(releases: MbRelease[]): MbRelease | null {
  if (releases.length === 0) return null;
  return (
    [...releases].sort((a, b) => {
      const aTracks = (a.media ?? []).reduce((sum, disc) => sum + (disc.tracks?.length ?? 0), 0);
      const bTracks = (b.media ?? []).reduce((sum, disc) => sum + (disc.tracks?.length ?? 0), 0);
      if (aTracks !== bTracks) return bTracks - aTracks;
      return (a.date ?? '9999').localeCompare(b.date ?? '9999');
    })[0] ?? null
  );
}

export async function getMusicBrainzAlbum(
  releaseGroupId: string,
  options: RequestOptions = {},
): Promise<Album> {
  const params = new URLSearchParams({
    'release-group': releaseGroupId,
    fmt: 'json',
    inc: 'recordings+artist-credits+labels',
    limit: '25',
  });

  const data = await schedule(() =>
    getJson<MbReleaseListResponse>(`${MB_API}/release?${params}`, options),
  );

  const release = pickBestRelease(data.releases ?? []);
  if (!release) {
    throw new Error('No release found for this album');
  }

  const tracks = normalizeTracks(release);

  return {
    id: releaseGroupId,
    source: 'musicbrainz',
    title: release.title ?? '',
    artist: creditToArtist(release['artist-credit']),
    releaseDate: release.date ?? '',
    coverUrl: coverArtUrl(releaseGroupId, 500),
    coverUrlHiRes: coverArtUrl(releaseGroupId, 1200),
    tracks,
    genres: [],
    label: release['label-info']?.[0]?.label?.name ?? null,
    totalDurationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
    uri: null,
    externalUrl: `https://musicbrainz.org/release-group/${releaseGroupId}`,
  };
}
