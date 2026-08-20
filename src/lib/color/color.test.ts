import { describe, expect, it } from 'vitest';
import {
  colorDistance,
  contrastRatio,
  dominantAccent,
  ensureContrast,
  fallbackPalette,
  hexToHsl,
  hexToRgb,
  hslToHex,
  isDark,
  isHexColor,
  mix,
  paletteBackground,
  quantize,
  readableTextColor,
  relativeLuminance,
  rgbToHex,
  withAlpha,
} from './color';

describe('hex conversion', () => {
  it('parses long and short hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('round-trips through rgb', () => {
    expect(rgbToHex(hexToRgb('#3a7bd5'))).toBe('#3a7bd5');
  });

  it('falls back to black for invalid input', () => {
    expect(hexToRgb('nonsense')).toEqual({ r: 0, g: 0, b: 0 });
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('#123456')).toBe(true);
  });

  it('round-trips through hsl', () => {
    const original = '#7c5cff';
    const result = hslToHex(hexToHsl(original));
    expect(colorDistance(original, result)).toBeLessThan(3);
  });
});

describe('contrast', () => {
  it('computes the WCAG extremes', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('raises contrast until the target is met', () => {
    const fixed = ensureContrast('#333333', '#000000', 4.5);
    expect(contrastRatio(fixed, '#000000')).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves already-readable colours untouched', () => {
    expect(ensureContrast('#ffffff', '#000000', 4.5)).toBe('#ffffff');
  });

  it('picks a readable text colour for any background', () => {
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#ffffff')).toBe('#111111');
  });

  it('detects dark colours', () => {
    expect(isDark('#111111')).toBe(true);
    expect(isDark('#f5f5f5')).toBe(false);
  });

  it('orders luminance correctly', () => {
    expect(relativeLuminance('#ffffff')).toBeGreaterThan(relativeLuminance('#808080'));
  });
});

describe('mixing', () => {
  it('blends two colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clamps the blend amount', () => {
    expect(mix('#000000', '#ffffff', 5)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', -5)).toBe('#000000');
  });

  it('produces a valid rgba string', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});

describe('quantize', () => {
  it('returns the requested number of buckets', () => {
    const pixels = Array.from({ length: 400 }, (_, i) => ({
      r: (i * 7) % 256,
      g: (i * 13) % 256,
      b: (i * 29) % 256,
    }));
    expect(quantize(pixels, 6)).toHaveLength(6);
  });

  it('handles an empty input', () => {
    expect(quantize([], 4)).toEqual([]);
  });

  it('collapses a single-colour image to that colour', () => {
    const pixels = Array.from({ length: 50 }, () => ({ r: 10, g: 20, b: 30 }));
    const [first] = quantize(pixels, 4);
    expect(first).toEqual({ r: 10, g: 20, b: 30 });
  });
});

describe('palette helpers', () => {
  it('provides a full fallback palette', () => {
    expect(fallbackPalette(6)).toHaveLength(6);
    expect(fallbackPalette(3).every(isHexColor)).toBe(true);
  });

  it('sorts the fallback palette dark to light', () => {
    const palette = fallbackPalette(6);
    const luminances = palette.map(relativeLuminance);
    const sorted = [...luminances].sort((a, b) => a - b);
    expect(luminances).toEqual(sorted);
  });

  it('picks a saturated accent over a grey one', () => {
    expect(dominantAccent(['#808080', '#ff3366', '#777777'])).toBe('#ff3366');
  });

  it('darkens a light palette for use as a background', () => {
    const background = paletteBackground(['#eeeeee', '#dddddd']);
    expect(relativeLuminance(background)).toBeLessThan(relativeLuminance('#dddddd'));
  });
});
