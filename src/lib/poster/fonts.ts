import type { FontPairId, ResolvedFonts } from '@/lib/types';

/**
 * Font pairings offered in the editor. Archivo and Space Mono are self-hosted
 * (see `public/fonts`); the remaining stacks fall back to system faces that are
 * present on every major platform so a poster never renders in a fallback that
 * breaks its layout.
 */
export interface FontPair {
  id: FontPairId;
  name: string;
  description: string;
  fonts: ResolvedFonts;
  /** Tracking for the big display type, relative to font size. */
  displayTracking: number;
  displayWeight: number;
  bodyWeight: number;
  uppercaseDisplay: boolean;
}

const ARCHIVO = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SPACE_MONO = "'Space Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const SERIF = "ui-serif, Georgia, 'Times New Roman', Times, serif";
const CONDENSED =
  "'Archivo', 'Arial Narrow', 'Helvetica Neue Condensed', 'Liberation Sans Narrow', sans-serif";

export const FONT_PAIRS: Record<FontPairId, FontPair> = {
  mono: {
    id: 'mono',
    name: 'Mono',
    description: 'Technical, print-shop feel — the Posterfy signature.',
    fonts: { display: SPACE_MONO, body: SPACE_MONO, mono: SPACE_MONO },
    displayTracking: 0.06,
    displayWeight: 700,
    bodyWeight: 400,
    uppercaseDisplay: true,
  },
  grotesk: {
    id: 'grotesk',
    name: 'Grotesk',
    description: 'Clean Swiss sans for a modern gallery look.',
    fonts: { display: ARCHIVO, body: ARCHIVO, mono: SPACE_MONO },
    displayTracking: -0.015,
    displayWeight: 800,
    bodyWeight: 400,
    uppercaseDisplay: true,
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Serif headline over a sans body — magazine cover energy.',
    fonts: { display: SERIF, body: ARCHIVO, mono: SPACE_MONO },
    displayTracking: -0.01,
    displayWeight: 600,
    bodyWeight: 400,
    uppercaseDisplay: false,
  },
  condensed: {
    id: 'condensed',
    name: 'Condensed',
    description: 'Tall, tight type that fits long album titles on one line.',
    fonts: { display: CONDENSED, body: ARCHIVO, mono: SPACE_MONO },
    displayTracking: 0.02,
    displayWeight: 700,
    bodyWeight: 400,
    uppercaseDisplay: true,
  },
};

export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as FontPairId[];

export function getFontPair(id: FontPairId): FontPair {
  return FONT_PAIRS[id] ?? FONT_PAIRS.mono;
}

/**
 * Canvas draws with whatever is loaded at that instant, so we wait for the
 * webfonts before rendering — otherwise the first paint uses a fallback face
 * and every measurement is wrong.
 */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const faces = [
    "400 16px 'Space Mono'",
    "700 16px 'Space Mono'",
    "400 16px 'Archivo'",
    "700 16px 'Archivo'",
    "800 16px 'Archivo'",
  ];
  try {
    await Promise.all(faces.map((face) => document.fonts.load(face)));
    await document.fonts.ready;
  } catch {
    // Fallback stacks are already in place; rendering can continue.
  }
}
