import { describe, expect, it } from 'vitest';
import { DEMO_ALBUMS, demoAlbum } from './demoAlbums';
import { STYLE_PRESETS, TEMPLATE_META } from '@/lib/poster/defaults';

describe('DEMO_ALBUMS', () => {
  it('has at least one demo album per template plus one per style preset', () => {
    // The gallery shows one card per template and one per preset, each with
    // its own demoAlbum(index) — too few demo albums and the modulo wraps,
    // so distant cards silently show the exact same record. Gallery offsets
    // presets past every template index specifically to avoid that; this
    // only holds if there are enough albums for both sections combined.
    expect(DEMO_ALBUMS.length).toBeGreaterThanOrEqual(TEMPLATE_META.length + STYLE_PRESETS.length);
  });

  it('gives every gallery card (templates followed by presets) a distinct record', () => {
    const templateAlbums = TEMPLATE_META.map((_, index) => demoAlbum(index).id);
    const presetAlbums = STYLE_PRESETS.map(
      (_, index) => demoAlbum(index + TEMPLATE_META.length).id,
    );
    const all = [...templateAlbums, ...presetAlbums];
    expect(new Set(all).size).toBe(all.length);
  });
});
