/**
 * Renderer smoke tests.
 *
 * jsdom has no canvas implementation, so the context is a recording stub: the
 * point is to prove that every template × format combination lays out without
 * throwing and actually paints something.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Album, PosterOptions, PosterSpec } from '@/lib/types';
import { DEFAULT_OPTIONS, TEMPLATE_IDS } from './defaults';
import { FORMAT_IDS, designHeight } from './formats';
import { renderPoster, resolveTheme, selectCoverUrl } from './render';
import { contrastRatio } from '@/lib/color/color';

interface Recorder {
  calls: Record<string, number>;
  texts: string[];
}

/** Minimal 2D context stand-in that records what the renderer asked for. */
function createContextStub(): CanvasRenderingContext2D & Recorder {
  const calls: Record<string, number> = {};
  const texts: string[] = [];
  const record = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };

  const gradient = {
    addColorStop: () => undefined,
  };

  const stub: Record<string, unknown> = {
    calls,
    texts,
    canvas: { width: 0, height: 0 },
    save: () => record('save'),
    restore: () => record('restore'),
    scale: () => record('scale'),
    translate: () => record('translate'),
    setTransform: () => record('setTransform'),
    clearRect: () => record('clearRect'),
    fillRect: () => record('fillRect'),
    strokeRect: () => record('strokeRect'),
    beginPath: () => record('beginPath'),
    closePath: () => record('closePath'),
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    arcTo: () => undefined,
    rect: () => undefined,
    roundRect: () => undefined,
    fill: () => record('fill'),
    stroke: () => record('stroke'),
    clip: () => record('clip'),
    drawImage: () => record('drawImage'),
    fillText: (text: string) => {
      record('fillText');
      if (typeof text === 'string' && text.length > 0) {
        record('fillTextNonEmpty');
        texts.push(text);
      }
    },
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => undefined,
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowOffsetY: 0,
    shadowColor: '',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    letterSpacing: '0px',
  };

  return stub as unknown as CanvasRenderingContext2D & Recorder;
}

function createCanvasStub(ctx: CanvasRenderingContext2D) {
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

function demoAlbum(trackCount = 10): Album {
  const tracks = Array.from({ length: trackCount }, (_, index) => ({
    position: index + 1,
    title: `Demo Track ${index + 1}`,
    durationMs: (180 + index * 7) * 1000,
  }));
  return {
    id: 'test-album',
    source: 'manual',
    title: 'Test Album Title',
    artist: 'Test Artist',
    releaseDate: '1999-04-02',
    coverUrl: null,
    coverUrlHiRes: null,
    tracks,
    genres: ['Test Genre', 'Another'],
    label: 'Test Label',
    totalDurationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
    uri: null,
    externalUrl: null,
  };
}

function spec(options: Partial<PosterOptions> = {}, trackCount = 10): PosterSpec {
  return { album: demoAlbum(trackCount), options: { ...DEFAULT_OPTIONS, ...options } };
}

describe('renderPoster', () => {
  it('renders every template without throwing', () => {
    for (const template of TEMPLATE_IDS) {
      const ctx = createContextStub();
      const canvas = createCanvasStub(ctx);
      expect(() => renderPoster({ canvas, spec: spec({ template }), width: 600 })).not.toThrow();
      expect(ctx.calls.fillRect, `${template} painted a background`).toBeGreaterThan(0);
      expect(ctx.calls.fillTextNonEmpty, `${template} drew text`).toBeGreaterThan(0);
    }
  });

  it('renders every format without throwing', () => {
    for (const format of FORMAT_IDS) {
      const ctx = createContextStub();
      const canvas = createCanvasStub(ctx);
      expect(() => renderPoster({ canvas, spec: spec({ format }), width: 500 })).not.toThrow();
    }
  });

  it('sizes the bitmap from the format ratio', () => {
    const ctx = createContextStub();
    const canvas = createCanvasStub(ctx);
    renderPoster({ canvas, spec: spec({ format: 'square' }), width: 800 });
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(800);

    renderPoster({ canvas, spec: spec({ format: 'portrait' }), width: 800 });
    expect(canvas.height).toBe(Math.round(800 * (designHeight('portrait') / 1000)));
  });

  it('copes with a very long tracklist', () => {
    const ctx = createContextStub();
    const canvas = createCanvasStub(ctx);
    expect(() => renderPoster({ canvas, spec: spec({}, 40), width: 600 })).not.toThrow();
  });

  it('copes with an empty album', () => {
    const ctx = createContextStub();
    const canvas = createCanvasStub(ctx);
    const empty: PosterSpec = {
      album: { ...demoAlbum(0), title: '', artist: '', genres: [], releaseDate: '' },
      options: DEFAULT_OPTIONS,
    };
    expect(() => renderPoster({ canvas, spec: empty, width: 400 })).not.toThrow();
  });

  it('throws a clear error when the context is unavailable', () => {
    const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => renderPoster({ canvas, spec: spec(), width: 400 })).toThrow(/context/i);
  });
});

describe('layout overrides', () => {
  it('reports a layout box for the elements every template actually draws', () => {
    for (const template of TEMPLATE_IDS) {
      const ctx = createContextStub();
      const canvas = createCanvasStub(ctx);
      let layout: Map<string, unknown> | undefined;
      renderPoster({
        canvas,
        spec: spec({ template }),
        width: 600,
        onLayout: (result) => {
          layout = result;
        },
      });
      expect(layout, `${template} called onLayout`).toBeDefined();
      // Every template draws its own artwork and a title, whatever else it does.
      expect(layout?.has('cover'), `${template} registered cover`).toBe(true);
      expect(layout?.has('title'), `${template} registered title`).toBe(true);
    }
  });

  it('never touches translate, and calls scale only once (the base design-grid scale), when no element has an override', () => {
    // withOverride() wraps every element in every template; this is what
    // guarantees a poster nobody has repositioned still renders through
    // exactly the same draw path as before this feature existed. `translate`
    // is only ever called from inside withOverride, so zero calls to it means
    // no element's transform ran; `scale` is also called once by renderPoster
    // itself for the 1000-unit design grid, so 1 (not 0) is the untouched count.
    for (const template of TEMPLATE_IDS) {
      const ctx = createContextStub();
      renderPoster({ canvas: createCanvasStub(ctx), spec: spec({ template }), width: 600 });
      expect(ctx.calls.translate ?? 0, `${template} called translate`).toBe(0);
      expect(ctx.calls.scale ?? 0, `${template} called scale`).toBe(1);
    }
  });

  it('moves the title element by dx/dy without affecting anything else', () => {
    const ctx = createContextStub();
    let layout: Map<string, { x: number; y: number }> | undefined;
    renderPoster({
      canvas: createCanvasStub(ctx),
      spec: spec({ layoutOverrides: { title: { dx: 25, dy: -10, scale: 1 } } }),
      width: 600,
      onLayout: (result) => {
        layout = result as Map<string, { x: number; y: number }>;
      },
    });

    const baseline = createContextStub();
    let baseLayout: Map<string, { x: number; y: number }> | undefined;
    renderPoster({
      canvas: createCanvasStub(baseline),
      spec: spec(),
      width: 600,
      onLayout: (result) => {
        baseLayout = result as Map<string, { x: number; y: number }>;
      },
    });

    const moved = layout?.get('title');
    const original = baseLayout?.get('title');
    expect(moved).toBeDefined();
    expect(original).toBeDefined();
    expect(moved?.x).toBeCloseTo((original?.x ?? 0) + 25);
    expect(moved?.y).toBeCloseTo((original?.y ?? 0) - 10);

    // Nothing else moved.
    const movedCover = layout?.get('cover');
    const originalCover = baseLayout?.get('cover');
    expect(movedCover).toEqual(originalCover);
  });
});

describe('meta column', () => {
  it('prints the values without a leading marker', () => {
    // The ">" that used to prefix each value read as a "greater than", not as
    // the arrow it was meant to be.
    for (const template of TEMPLATE_IDS) {
      const ctx = createContextStub();
      renderPoster({ canvas: createCanvasStub(ctx), spec: spec({ template }), width: 600 });
      const prefixed = ctx.texts.filter((text) => /^\s*[>»›]/.test(text));
      expect(prefixed, `${template} drew a prefixed value`).toEqual([]);
    }
  });

  it('still prints the values themselves', () => {
    const ctx = createContextStub();
    renderPoster({ canvas: createCanvasStub(ctx), spec: spec(), width: 600 });
    expect(ctx.texts).toContain('1999');
  });
});

describe('resolveTheme', () => {
  it('keeps text readable against the background in auto mode', () => {
    const theme = resolveTheme(spec({ autoColors: true, palette: ['#101010', '#202020'] }));
    expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('honours manual colours but still enforces contrast', () => {
    const theme = resolveTheme(
      spec({ autoColors: false, background: '#000000', foreground: '#050505' }),
    );
    expect(theme.background).toBe('#000000');
    expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to a default palette when none is set', () => {
    const theme = resolveTheme(spec({ palette: [] }));
    expect(theme.palette.length).toBeGreaterThan(0);
  });
});

describe('selectCoverUrl', () => {
  const SMALL = 'https://i.scdn.co/image/small';
  const LARGE = 'https://i.scdn.co/image/large';

  it('keeps previews on the small cover', () => {
    expect(selectCoverUrl({ coverUrl: SMALL, coverUrlHiRes: LARGE }, 'preview')).toBe(SMALL);
  });

  it('gives exports the largest cover', () => {
    expect(selectCoverUrl({ coverUrl: SMALL, coverUrlHiRes: LARGE }, 'export')).toBe(LARGE);
  });

  it('falls back to the hi-res cover when a preview has no small one', () => {
    expect(selectCoverUrl({ coverUrl: null, coverUrlHiRes: LARGE }, 'preview')).toBe(LARGE);
  });

  it('falls back to the small cover when an export has no hi-res one', () => {
    expect(selectCoverUrl({ coverUrl: SMALL, coverUrlHiRes: null }, 'export')).toBe(SMALL);
  });

  it('reports no artwork when the album has none', () => {
    expect(selectCoverUrl({ coverUrl: null, coverUrlHiRes: null }, 'preview')).toBeNull();
    expect(selectCoverUrl({ coverUrl: null, coverUrlHiRes: null }, 'export')).toBeNull();
  });
});

describe('render determinism', () => {
  it('draws the same number of operations for identical input', () => {
    const first = createContextStub();
    const second = createContextStub();
    renderPoster({ canvas: createCanvasStub(first), spec: spec(), width: 600 });
    renderPoster({ canvas: createCanvasStub(second), spec: spec(), width: 600 });
    expect(first.calls).toEqual(second.calls);
  });

  it('does not warn on the console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ctx = createContextStub();
    renderPoster({ canvas: createCanvasStub(ctx), spec: spec(), width: 400 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
