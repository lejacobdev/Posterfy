/**
 * Demo records used on the landing page and in the template gallery.
 *
 * Everything here is invented for the demo — fictional artists, fictional
 * albums, fictional track names — and the artwork is generated procedurally, so
 * the marketing pages ship no third-party material and work fully offline.
 */

import type { Album, Track } from '@/lib/types';
import { hashString, seededRandom } from '@/lib/utils/misc';

interface DemoSeed {
  id: string;
  title: string;
  artist: string;
  releaseDate: string;
  genres: string[];
  label: string;
  palette: [string, string, string];
  trackTitles: string[];
}

const DEMO_SEEDS: DemoSeed[] = [
  {
    id: 'demo-northern-signal',
    title: 'Northern Signal',
    artist: 'Halden Frost',
    releaseDate: '1985-05-13',
    genres: ['Art Rock', 'Ambient'],
    label: 'Meridian Sound',
    palette: ['#9db8e0', '#2b3f5e', '#e8d9c2'],
    trackTitles: [
      'Long Way North',
      'Signal Fires',
      'Paper Harbour',
      'Slow Machines',
      'Winter Static',
      'The Quiet Wire',
      'Blue Hour Drive',
      'Anywhere But Down',
      'Northern Signal',
    ],
  },
  {
    id: 'demo-neon-cassette',
    title: 'Neon Cassette',
    artist: 'Vela Motive',
    releaseDate: '2019-09-27',
    genres: ['Synthwave', 'Electronic'],
    label: 'Nightdrive Records',
    palette: ['#ff4d9d', '#2a0d3f', '#ffd166'],
    trackTitles: [
      'Overpass',
      'Chrome Weather',
      'Midnight Arcade',
      'Tape Hiss',
      'Afterglow',
      'Neon Cassette',
      'Static Bloom',
      'Last Exit',
      'Rewind',
      'Sunrise Protocol',
    ],
  },
  {
    id: 'demo-paper-boats',
    title: 'Paper Boats',
    artist: 'June Almeida',
    releaseDate: '2003-03-04',
    genres: ['Folk', 'Indie'],
    label: 'Little River',
    palette: ['#d8a27a', '#3a2b23', '#f2e7d5'],
    trackTitles: [
      'Kitchen Light',
      'Paper Boats',
      'Six Bridges',
      'Everything Keeps',
      'The Long Field',
      'Hold Still',
      'Weathervane',
      'Come Morning',
    ],
  },
  {
    id: 'demo-concrete-garden',
    title: 'Concrete Garden',
    artist: 'The Meridian Set',
    releaseDate: '1997-11-18',
    genres: ['Post Punk', 'Alternative'],
    label: 'Grey Court',
    palette: ['#5ad0c0', '#101418', '#c9d6d3'],
    trackTitles: [
      'Ground Floor',
      'Concrete Garden',
      'Wire and Ivy',
      'Second City',
      'Nothing Grows Here',
      'Repeat Offender',
      'Glasshouse',
      'Late Shift',
      'Terracotta',
      'Exit Music For A Lift',
      'Rooftop',
    ],
  },
];

/** Deterministic track lengths so the demo posters never shift between loads. */
function buildTracks(seed: DemoSeed): Track[] {
  const random = seededRandom(hashString(seed.id));
  return seed.trackTitles.map((title, index) => ({
    position: index + 1,
    title,
    durationMs: Math.round((150 + random() * 180) * 1000),
  }));
}

/**
 * Generates cover art as an inline SVG data URL: layered shapes derived from
 * the album id. No network, no licensing, and it renders identically anywhere.
 */
export function demoCoverDataUrl(seed: DemoSeed): string {
  const random = seededRandom(hashString(seed.id));
  const [primary, deep, light] = seed.palette;
  const shapes: string[] = [];

  for (let i = 0; i < 6; i += 1) {
    const cx = Math.round(random() * 100);
    const cy = Math.round(random() * 100);
    const r = Math.round(12 + random() * 34);
    const fill = [primary, light, deep][i % 3];
    const opacity = (0.25 + random() * 0.45).toFixed(2);
    shapes.push(`<circle cx="${cx}%" cy="${cy}%" r="${r}%" fill="${fill}" opacity="${opacity}"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="${primary}"/>
</linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="26"/></filter></defs>
<rect width="600" height="600" fill="url(#g)"/>
<g filter="url(#b)">${shapes.join('')}</g>
<rect x="150" y="150" width="300" height="300" fill="none" stroke="${light}" stroke-width="3" opacity="0.75"/>
<circle cx="300" cy="300" r="86" fill="none" stroke="${light}" stroke-width="3" opacity="0.6"/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function toAlbum(seed: DemoSeed): Album {
  const tracks = buildTracks(seed);
  const cover = demoCoverDataUrl(seed);
  return {
    id: seed.id,
    source: 'manual',
    title: seed.title,
    artist: seed.artist,
    releaseDate: seed.releaseDate,
    coverUrl: cover,
    coverUrlHiRes: cover,
    tracks,
    genres: seed.genres,
    label: seed.label,
    totalDurationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
    uri: null,
    externalUrl: null,
  };
}

export const DEMO_ALBUMS: Album[] = DEMO_SEEDS.map(toAlbum);

export function demoAlbum(index = 0): Album {
  return DEMO_ALBUMS[index % DEMO_ALBUMS.length] ?? toAlbum(DEMO_SEEDS[0]!);
}

export const DEMO_PALETTES: Record<string, string[]> = Object.fromEntries(
  DEMO_SEEDS.map((seed) => [seed.id, [seed.palette[1], seed.palette[0], seed.palette[2]]]),
);
