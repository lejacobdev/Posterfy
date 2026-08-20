import type { FormatId } from '@/lib/types';

/**
 * Every template is authored on a 1000-unit wide grid; the height comes from the
 * chosen format's aspect ratio. Rendering multiplies the grid by a scale factor,
 * which is how the same code produces a 380px preview and a 6000px print file.
 */
export interface PosterFormat {
  id: FormatId;
  name: string;
  /** height / width */
  ratio: number;
  description: string;
  /** Common print sizes this ratio maps to. */
  printSizes: string[];
  /** Long-edge pixel target for a 300 DPI print. */
  printWidth: number;
}

export const DESIGN_WIDTH = 1000;

export const POSTER_FORMATS: Record<FormatId, PosterFormat> = {
  portrait: {
    id: 'portrait',
    name: '2:3 Portrait',
    ratio: 1.5,
    description: 'The classic poster ratio.',
    printSizes: ['12×18 in', '20×30 cm', '24×36 in'],
    printWidth: 3600,
  },
  'a-series': {
    id: 'a-series',
    name: 'A-Series',
    ratio: 1.4142,
    description: 'Fits A5 through A2 with no cropping.',
    printSizes: ['A4', 'A3', 'A2'],
    printWidth: 3508,
  },
  square: {
    id: 'square',
    name: 'Square',
    ratio: 1,
    description: 'Made for feeds and sleeve-style prints.',
    printSizes: ['30×30 cm', '12×12 in'],
    printWidth: 3000,
  },
  story: {
    id: 'story',
    name: '9:16 Story',
    ratio: 1.7778,
    description: 'Phone wallpapers and stories.',
    printSizes: ['1080×1920 px'],
    printWidth: 2160,
  },
  landscape: {
    id: 'landscape',
    name: '3:2 Landscape',
    ratio: 0.6667,
    description: 'Wide format for desks and shelves.',
    printSizes: ['18×12 in', '30×20 cm'],
    printWidth: 3600,
  },
};

export const FORMAT_IDS = Object.keys(POSTER_FORMATS) as FormatId[];

export function getFormat(id: FormatId): PosterFormat {
  return POSTER_FORMATS[id] ?? POSTER_FORMATS.portrait;
}

export function designHeight(id: FormatId): number {
  return Math.round(DESIGN_WIDTH * getFormat(id).ratio);
}

export function aspectRatio(id: FormatId): number {
  return getFormat(id).ratio;
}
