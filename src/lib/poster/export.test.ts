import { describe, expect, it } from 'vitest';
import type { PosterSpec } from '@/lib/types';
import { DEFAULT_OPTIONS, createEmptyAlbum, STYLE_PRESETS, TEMPLATE_META } from './defaults';
import {
  defaultFilename,
  EXPORT_MIME,
  EXPORT_PRESETS,
  exportWidthFor,
  MAX_EXPORT_WIDTH,
} from './export';
import { aspectRatio, designHeight, FORMAT_IDS, getFormat } from './formats';
import { scanBars } from './scancode';
import { FONT_PAIR_IDS, getFontPair } from './fonts';

function spec(overrides: Partial<PosterSpec['options']> = {}): PosterSpec {
  return {
    album: { ...createEmptyAlbum(), title: 'Northern Signal', artist: 'Halden Frost' },
    options: { ...DEFAULT_OPTIONS, ...overrides },
  };
}

describe('defaultFilename', () => {
  it('builds a slug from artist and title', () => {
    expect(defaultFilename(spec(), 'png')).toBe('halden-frost-northern-signal-poster.png');
  });

  it('uses the jpg extension for jpeg', () => {
    expect(defaultFilename(spec(), 'jpeg')).toMatch(/\.jpg$/);
  });

  it('prefers the user overrides', () => {
    const custom = spec({ artistOverride: 'Someone Else', titleOverride: 'New Name' });
    expect(defaultFilename(custom, 'webp')).toBe('someone-else-new-name-poster.webp');
  });

  it('falls back when the album is empty', () => {
    const empty: PosterSpec = { album: createEmptyAlbum(), options: DEFAULT_OPTIONS };
    expect(defaultFilename(empty, 'png')).toBe('poster-album-poster.png');
  });
});

describe('exportWidthFor', () => {
  it('scales with the chosen preset', () => {
    const social = exportWidthFor(spec(), 'social');
    const print = exportWidthFor(spec(), 'print');
    expect(social).toBeLessThan(print);
  });

  it('matches the format print width at 300 DPI', () => {
    expect(exportWidthFor(spec({ format: 'square' }), 'print')).toBe(
      getFormat('square').printWidth,
    );
  });

  it('never exceeds the canvas ceiling in either dimension', () => {
    for (const format of FORMAT_IDS) {
      for (const preset of EXPORT_PRESETS) {
        const width = exportWidthFor(spec({ format }), preset.id);
        const height = Math.round(width * aspectRatio(format));
        expect(width).toBeLessThanOrEqual(MAX_EXPORT_WIDTH);
        expect(height).toBeLessThanOrEqual(MAX_EXPORT_WIDTH + 1);
      }
    }
  });

  it('falls back to the print preset for an unknown id', () => {
    expect(exportWidthFor(spec(), 'nope')).toBe(exportWidthFor(spec(), 'print'));
  });
});

describe('formats', () => {
  it('derives height from the ratio', () => {
    expect(designHeight('square')).toBe(1000);
    expect(designHeight('portrait')).toBe(1500);
  });

  it('exposes a mime type per export format', () => {
    expect(EXPORT_MIME.png).toBe('image/png');
    expect(EXPORT_MIME.jpeg).toBe('image/jpeg');
    expect(EXPORT_MIME.webp).toBe('image/webp');
  });

  it('falls back to portrait for an unknown format', () => {
    expect(getFormat('nope' as never).id).toBe('portrait');
  });
});

describe('scanBars', () => {
  it('is deterministic for the same album', () => {
    expect(scanBars('spotify:album:abc')).toEqual(scanBars('spotify:album:abc'));
  });

  it('differs between albums', () => {
    expect(scanBars('album-a')).not.toEqual(scanBars('album-b'));
  });

  it('stays within the 0–1 range', () => {
    expect(scanBars('album-a').every((value) => value > 0 && value <= 1)).toBe(true);
  });
});

describe('presets and templates', () => {
  it('exposes a font stack for every pairing', () => {
    for (const id of FONT_PAIR_IDS) {
      expect(getFontPair(id).fonts.display.length).toBeGreaterThan(0);
    }
  });

  it('gives every style preset three swatches and a template', () => {
    for (const preset of STYLE_PRESETS) {
      expect(preset.swatches).toHaveLength(3);
      expect(preset.options.template).toBeDefined();
    }
  });

  it('documents every template', () => {
    for (const template of TEMPLATE_META) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
  });
});
