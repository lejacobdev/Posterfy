/** Colour conversion, contrast and palette extraction. */

import { clamp } from '@/lib/utils/misc';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX_RE = /^#?([\da-f]{3}|[\da-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function hexToRgb(hex: string): Rgb {
  const match = HEX_RE.exec(hex.trim());
  if (!match?.[1]) return { r: 0, g: 0, b: 0 };
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const int = Number.parseInt(value, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (channel: number) =>
    Math.round(clamp(channel, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hp >= 0 && hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

/** WCAG relative luminance. */
export function relativeLuminance(color: string | Rgb): number {
  const { r, g, b } = typeof color === 'string' ? hexToRgb(color) : color;
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isDark(color: string): boolean {
  return relativeLuminance(color) < 0.4;
}

export function mix(a: string, b: string, amount = 0.5): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = clamp(amount, 0, 1);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function lighten(color: string, amount: number): string {
  const hsl = hexToHsl(color);
  return hslToHex({ ...hsl, l: clamp(hsl.l + amount, 0, 1) });
}

export function darken(color: string, amount: number): string {
  return lighten(color, -amount);
}

export function saturate(color: string, amount: number): string {
  const hsl = hexToHsl(color);
  return hslToHex({ ...hsl, s: clamp(hsl.s + amount, 0, 1) });
}

export function withAlpha(color: string, alpha: number): string {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

/**
 * Nudges `color` until it reaches `target` contrast against `background`,
 * so generated posters stay readable whatever the artwork throws at us.
 */
export function ensureContrast(color: string, background: string, target = 4.5): string {
  if (contrastRatio(color, background) >= target) return color;
  const goLighter = relativeLuminance(background) < 0.5;
  const hsl = hexToHsl(color);
  for (let step = 1; step <= 20; step += 1) {
    const l = clamp(hsl.l + (goLighter ? step * 0.05 : -step * 0.05), 0, 1);
    const candidate = hslToHex({ ...hsl, l });
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return goLighter ? '#ffffff' : '#000000';
}

/** Picks whichever of black/white reads best on `background`. */
export function readableTextColor(background: string): string {
  return contrastRatio('#ffffff', background) >= contrastRatio('#111111', background)
    ? '#ffffff'
    : '#111111';
}

interface Bucket {
  colors: Rgb[];
  channel: 'r' | 'g' | 'b';
  range: number;
}

function bucketFor(colors: Rgb[]): Bucket {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  for (const c of colors) {
    rMin = Math.min(rMin, c.r);
    rMax = Math.max(rMax, c.r);
    gMin = Math.min(gMin, c.g);
    gMax = Math.max(gMax, c.g);
    bMin = Math.min(bMin, c.b);
    bMax = Math.max(bMax, c.b);
  }
  const ranges = { r: rMax - rMin, g: gMax - gMin, b: bMax - bMin };
  const channel = (Object.keys(ranges) as Array<'r' | 'g' | 'b'>).reduce((best, key) =>
    ranges[key] > ranges[best] ? key : best,
  );
  return { colors, channel, range: ranges[channel] };
}

function averageColor(colors: Rgb[]): Rgb {
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of colors) {
    r += c.r;
    g += c.g;
    b += c.b;
  }
  return { r: r / colors.length, g: g / colors.length, b: b / colors.length };
}

/**
 * Median-cut quantisation. Cheap, deterministic, and good enough for artwork
 * palettes — far lighter than pulling in a colour-thief dependency.
 */
export function quantize(pixels: Rgb[], count: number): Rgb[] {
  if (pixels.length === 0) return [];
  const buckets: Bucket[] = [bucketFor(pixels)];

  while (buckets.length < count) {
    buckets.sort((a, b) => b.range * b.colors.length - a.range * a.colors.length);
    const target = buckets.shift();
    if (!target || target.colors.length < 2) {
      if (target) buckets.push(target);
      break;
    }
    const sorted = [...target.colors].sort((a, b) => a[target.channel] - b[target.channel]);
    const mid = Math.floor(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    if (left.length === 0 || right.length === 0) {
      buckets.push(target);
      break;
    }
    buckets.push(bucketFor(left), bucketFor(right));
  }

  return buckets.map((bucket) => averageColor(bucket.colors));
}

export interface ExtractOptions {
  /** Number of swatches to return. */
  count?: number;
  /** Longest edge used when sampling — smaller is faster. */
  sampleSize?: number;
}

function readPixels(source: CanvasImageSource, sampleSize: number): Rgb[] {
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(source, 0, 0, sampleSize, sampleSize);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  } catch {
    // Tainted canvas (cover served without CORS headers) — caller falls back.
    return [];
  }

  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha < 125) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    pixels.push({ r, g, b });
  }
  return pixels;
}

/** Sorts swatches so the palette reads dark → light, which prints better. */
function sortByLuminance(colors: string[]): string[] {
  return [...colors].sort((a, b) => relativeLuminance(a) - relativeLuminance(b));
}

/**
 * Builds a poster palette from artwork: quantises the pixels, drops
 * near-duplicates and guarantees `count` swatches even for flat covers.
 */
export function extractPalette(source: CanvasImageSource, options: ExtractOptions = {}): string[] {
  const count = options.count ?? 6;
  const pixels = readPixels(source, options.sampleSize ?? 64);
  if (pixels.length === 0) return fallbackPalette(count);

  const quantized = quantize(pixels, count * 2).map(rgbToHex);
  const unique: string[] = [];
  for (const color of quantized) {
    const tooClose = unique.some((existing) => colorDistance(existing, color) < 24);
    if (!tooClose) unique.push(color);
    if (unique.length >= count) break;
  }
  while (unique.length < count && quantized.length > 0) {
    const filler = quantized[unique.length % quantized.length];
    unique.push(filler ? lighten(filler, 0.08 * unique.length) : '#808080');
  }
  return sortByLuminance(unique.slice(0, count));
}

export function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2);
}

export function fallbackPalette(count = 6): string[] {
  const base = ['#12131a', '#2b2f45', '#4b5178', '#8a7f6d', '#c9b79c', '#e8e2d6'];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(base[i % base.length] ?? '#808080');
  return sortByLuminance(out);
}

/** The most saturated swatch, used as the accent colour. */
export function dominantAccent(palette: string[]): string {
  let best = palette[0] ?? '#7c5cff';
  let bestScore = -1;
  for (const color of palette) {
    const { s, l } = hexToHsl(color);
    // Favour saturated mid-tones: they survive both light and dark backgrounds.
    const score = s * (1 - Math.abs(l - 0.55) * 1.4);
    if (score > bestScore) {
      bestScore = score;
      best = color;
    }
  }
  return best;
}

/** Darkest swatch, nudged towards true black so text keeps its punch. */
export function paletteBackground(palette: string[]): string {
  const darkest = sortByLuminance(palette)[0] ?? '#111111';
  return relativeLuminance(darkest) > 0.25 ? darken(darkest, 0.28) : darkest;
}
