import type { Album, PosterOptions, TemplateId } from '@/lib/types';
import { fallbackPalette } from '@/lib/color/color';

export const DEFAULT_OPTIONS: PosterOptions = {
  template: 'classic',
  format: 'portrait',
  fontPair: 'mono',

  palette: fallbackPalette(6),
  background: '#0d0d0f',
  foreground: '#f4f2ec',
  accent: '#8fb3ff',
  autoColors: true,

  titleOverride: '',
  artistOverride: '',
  customNote: '',

  showTracklist: true,
  showReleaseDate: true,
  showDuration: true,
  showGenres: true,
  showLabel: false,
  showScanCode: true,
  showTrackNumbers: true,
  showCoverBorder: false,
  uppercaseTitle: true,
  paletteStyle: 'bar',

  coverRadius: 0,
  margin: 0.075,
  grain: 0.12,
  vignette: 0,
  tracklistColumns: 'auto',
  textScale: 1,
};

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  /** Swatches shown on the preset chip. */
  swatches: [string, string, string];
  options: Partial<PosterOptions>;
}

/**
 * Curated starting points. Every one of them is just a bundle of options, so
 * the user can pick a preset and then keep tweaking every single control.
 */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight Mono',
    description: 'Ink-black paper, monospaced type, palette bar down the side.',
    swatches: ['#0d0d0f', '#f4f2ec', '#8fb3ff'],
    options: {
      template: 'classic',
      fontPair: 'mono',
      autoColors: false,
      background: '#0d0d0f',
      foreground: '#f4f2ec',
      accent: '#8fb3ff',
      paletteStyle: 'bar',
      grain: 0.14,
      coverRadius: 0,
    },
  },
  {
    id: 'gallery',
    name: 'Gallery White',
    description: 'Museum wall: warm paper, generous margins, quiet type.',
    swatches: ['#f6f4ef', '#16161a', '#b4553c'],
    options: {
      template: 'minimal',
      fontPair: 'grotesk',
      autoColors: false,
      background: '#f6f4ef',
      foreground: '#16161a',
      accent: '#b4553c',
      paletteStyle: 'dots',
      margin: 0.095,
      grain: 0.06,
      showScanCode: false,
    },
  },
  {
    id: 'press',
    name: 'Editorial Press',
    description: 'Magazine cover treatment with a serif headline.',
    swatches: ['#111014', '#f3ece1', '#e0b15c'],
    options: {
      template: 'editorial',
      fontPair: 'editorial',
      autoColors: true,
      paletteStyle: 'strip',
      uppercaseTitle: false,
      grain: 0.1,
    },
  },
  {
    id: 'club',
    name: 'Vinyl Club',
    description: 'Record on the turntable, tracklist beside it.',
    swatches: ['#151013', '#efe6d8', '#d8624a'],
    options: {
      template: 'vinyl',
      fontPair: 'condensed',
      autoColors: true,
      paletteStyle: 'dots',
      coverRadius: 0.5,
      grain: 0.16,
      vignette: 0.18,
    },
  },
  {
    id: 'split',
    name: 'Split Bleed',
    description: 'Full-bleed artwork up top, information block below.',
    swatches: ['#0b0f14', '#eef3f7', '#5ad0c0'],
    options: {
      template: 'split',
      fontPair: 'grotesk',
      autoColors: true,
      paletteStyle: 'strip',
      margin: 0,
      grain: 0.08,
    },
  },
  {
    id: 'neon',
    name: 'Neon Duotone',
    description: 'Two-tone artwork with a hard accent — built to be noticed.',
    swatches: ['#120b1f', '#f5e9ff', '#ff4d9d'],
    options: {
      template: 'duotone',
      fontPair: 'condensed',
      autoColors: false,
      background: '#120b1f',
      foreground: '#f5e9ff',
      accent: '#ff4d9d',
      paletteStyle: 'none',
      grain: 0.18,
      vignette: 0.12,
    },
  },
];

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Cover on top, palette bar, tracklist and credits below.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Oversized headline with the artwork framed inside the page.',
  },
  { id: 'minimal', name: 'Minimal', description: 'Just the artwork, the names and a lot of air.' },
  { id: 'vinyl', name: 'Vinyl', description: 'The record slipping out of its sleeve.' },
  { id: 'split', name: 'Split', description: 'Full-bleed artwork over a solid information block.' },
  { id: 'duotone', name: 'Duotone', description: 'Artwork mapped onto two brand colours.' },
];

export const TEMPLATE_IDS = TEMPLATE_META.map((template) => template.id);

/** Empty album used by the editor before anything is picked. */
export function createEmptyAlbum(): Album {
  return {
    id: 'draft',
    source: 'manual',
    title: '',
    artist: '',
    releaseDate: '',
    coverUrl: null,
    coverUrlHiRes: null,
    tracks: [],
    genres: [],
    label: null,
    totalDurationMs: 0,
    uri: null,
    externalUrl: null,
  };
}

export function applyPreset(options: PosterOptions, preset: StylePreset): PosterOptions {
  return { ...options, ...preset.options };
}
