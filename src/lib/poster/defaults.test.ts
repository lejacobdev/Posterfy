/**
 * Preset application.
 *
 * Presets are partial by design, so the interesting cases are all about what
 * happens to the keys a given preset does *not* set.
 */

import { describe, expect, it } from 'vitest';
import {
  applyPreset,
  DEFAULT_OPTIONS,
  PRESET_KEYS,
  presetPreviewOptions,
  STYLE_PRESETS,
} from './defaults';

function preset(id: string) {
  const found = STYLE_PRESETS.find((item) => item.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
}

describe('PRESET_KEYS', () => {
  it('covers every option any preset sets', () => {
    for (const item of STYLE_PRESETS) {
      for (const key of Object.keys(item.options)) {
        expect(PRESET_KEYS, `${item.id} sets ${key}`).toContain(key);
      }
    }
  });

  it('lists nothing that is not a real option', () => {
    for (const key of PRESET_KEYS) expect(DEFAULT_OPTIONS).toHaveProperty(key);
  });
});

describe('applyPreset', () => {
  it('applies the preset it was given', () => {
    const result = applyPreset(DEFAULT_OPTIONS, preset('club'));
    expect(result.template).toBe('vinyl');
    expect(result.coverRadius).toBe(0.5);
  });

  it('clears the previous preset instead of layering on top of it', () => {
    // Reported as: templates "get rounded corners" or "change their zoom"
    // after selecting one preset and going back to another. Vinyl Club sets
    // coverRadius and vignette, Split Bleed sets margin, Editorial Press sets
    // none of the three — so it used to inherit all of them.
    const viaVinyl = applyPreset(DEFAULT_OPTIONS, preset('club'));
    const viaSplit = applyPreset(viaVinyl, preset('split'));
    const result = applyPreset(viaSplit, preset('press'));

    expect(result.template).toBe('editorial');
    expect(result.coverRadius).toBe(DEFAULT_OPTIONS.coverRadius);
    expect(result.margin).toBe(DEFAULT_OPTIONS.margin);
    expect(result.vignette).toBe(DEFAULT_OPTIONS.vignette);
  });

  it('reaches the same result whatever was selected before', () => {
    const direct = applyPreset(DEFAULT_OPTIONS, preset('press'));
    const roundabout = STYLE_PRESETS.reduce(
      (options, item) => applyPreset(options, item),
      DEFAULT_OPTIONS,
    );
    expect(applyPreset(roundabout, preset('press'))).toEqual(direct);
  });

  it('restores a manual colour to the default when the next preset has none', () => {
    // Gallery White paints the page cream; Vinyl Club samples the artwork
    // instead, so it must not keep the cream background.
    const cream = applyPreset(DEFAULT_OPTIONS, preset('gallery'));
    expect(cream.background).toBe('#f6f4ef');
    expect(applyPreset(cream, preset('club')).background).toBe(DEFAULT_OPTIONS.background);
  });

  it('leaves options no preset controls alone', () => {
    const edited = {
      ...DEFAULT_OPTIONS,
      titleOverride: 'My Title',
      customNote: 'Pressed at home',
      format: 'square' as const,
      showTracklist: false,
      textScale: 1.2,
    };
    const result = applyPreset(edited, preset('neon'));
    expect(result.titleOverride).toBe('My Title');
    expect(result.customNote).toBe('Pressed at home');
    expect(result.format).toBe('square');
    expect(result.showTracklist).toBe(false);
    expect(result.textScale).toBe(1.2);
  });
});

describe('presetPreviewOptions', () => {
  it('describes the preset alone, not the current poster', () => {
    expect(presetPreviewOptions(preset('press')).coverRadius).toBe(DEFAULT_OPTIONS.coverRadius);
    expect(presetPreviewOptions(preset('club')).coverRadius).toBe(0.5);
  });

  it('honours the overrides a preview should still reflect', () => {
    const palette = ['#111111', '#222222'];
    const result = presetPreviewOptions(preset('midnight'), { palette, format: 'story' });
    expect(result.palette).toBe(palette);
    expect(result.format).toBe('story');
    // ...without losing the preset's own look.
    expect(result.template).toBe('classic');
  });

  it('gives every preset a distinct look', () => {
    const looks = STYLE_PRESETS.map((item) => JSON.stringify(presetPreviewOptions(item)));
    expect(new Set(looks).size).toBe(STYLE_PRESETS.length);
  });
});
