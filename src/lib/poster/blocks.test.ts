import { describe, expect, it } from 'vitest';
import type { Album, PosterOptions, PosterSpec, RenderContext } from '@/lib/types';
import { DEFAULT_OPTIONS } from './defaults';
import { posterArtist, posterTitle, drawTracklist, withOverride } from './blocks';
import { resolveTheme } from './render';

interface Recorder {
  texts: string[];
  calls: Array<{ name: string; args: unknown[] }>;
}

/** Minimal 2D context stand-in that records fillText/transform calls; mirrors render.test.ts's stub. */
function createContextStub(): CanvasRenderingContext2D & Recorder {
  const texts: string[] = [];
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push({ name, args });
  const stub: Record<string, unknown> = {
    texts,
    calls,
    canvas: { width: 0, height: 0 },
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    fillText: (text: string) => {
      if (typeof text === 'string' && text.length > 0) texts.push(text);
    },
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    letterSpacing: '0px',
  };
  return stub as unknown as CanvasRenderingContext2D & Recorder;
}

function demoAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: 'test-album',
    source: 'manual',
    title: '',
    artist: '',
    releaseDate: '1999-04-02',
    coverUrl: null,
    coverUrlHiRes: null,
    tracks: [],
    genres: [],
    label: null,
    totalDurationMs: 0,
    uri: null,
    externalUrl: null,
    ...overrides,
  };
}

function rc(album: Album, options: Partial<PosterOptions> = {}): RenderContext {
  const spec: PosterSpec = {
    album,
    options: { ...DEFAULT_OPTIONS, uppercaseTitle: false, ...options },
  };
  return {
    ctx: createContextStub(),
    width: 1000,
    height: 1000,
    scale: 1,
    pixelWidth: 1000,
    pixelHeight: 1000,
    cover: null,
    scanImage: null,
    spec,
    theme: resolveTheme(spec),
    fonts: { display: '', body: '', mono: '' },
    labels: undefined as never,
    layout: new Map(),
  };
}

describe('posterTitle', () => {
  it('uses the album title when set', () => {
    expect(posterTitle(rc(demoAlbum({ title: 'Northern Signal' })))).toBe('Northern Signal');
  });

  it('falls back to "Untitled album" for a titleless album', () => {
    expect(posterTitle(rc(demoAlbum()))).toBe('Untitled album');
  });

  it('falls back to "Untitled playlist" for a titleless playlist', () => {
    expect(posterTitle(rc(demoAlbum({ kind: 'playlist' })))).toBe('Untitled playlist');
  });

  it('prefers the title override over the album title', () => {
    expect(
      posterTitle(rc(demoAlbum({ title: 'Northern Signal' }), { titleOverride: 'My Poster' })),
    ).toBe('My Poster');
  });
});

describe('posterArtist', () => {
  it('falls back to "Unknown artist" for an artistless album', () => {
    expect(posterArtist(rc(demoAlbum()))).toBe('Unknown artist');
  });

  it('falls back to a track count for an artistless playlist with tracks', () => {
    const album = demoAlbum({
      kind: 'playlist',
      tracks: [
        { position: 1, title: 'A', durationMs: 1000 },
        { position: 2, title: 'B', durationMs: 1000 },
      ],
    });
    expect(posterArtist(rc(album))).toBe('2 tracks');
  });

  it('falls back to "Unknown artist" for a trackless, artistless playlist', () => {
    expect(posterArtist(rc(demoAlbum({ kind: 'playlist' })))).toBe('Unknown artist');
  });

  it('uses the curator name over the track-count fallback', () => {
    const album = demoAlbum({
      kind: 'playlist',
      artist: 'Jamie',
      tracks: [{ position: 1, title: 'A', durationMs: 1000 }],
    });
    expect(posterArtist(rc(album))).toBe('Jamie');
  });
});

describe('drawTracklist', () => {
  it("appends a playlist track's own artist to its label", () => {
    const album = demoAlbum({
      kind: 'playlist',
      tracks: [{ position: 1, title: 'Walk of Life', durationMs: 200_000, artist: 'Dire Straits' }],
    });
    const context = rc(album);
    drawTracklist(context, { x: 0, y: 0, width: 900, maxHeight: 900, fontSize: 14 });

    const texts = (context.ctx as unknown as Recorder).texts;
    expect(texts.some((text) => text.includes('Walk of Life — Dire Straits'))).toBe(true);
  });

  it("leaves an album track's label unchanged — it never carries a per-track artist", () => {
    const album = demoAlbum({
      tracks: [{ position: 1, title: 'So Far Away', durationMs: 200_000 }],
    });
    const context = rc(album);
    drawTracklist(context, { x: 0, y: 0, width: 900, maxHeight: 900, fontSize: 14 });

    const texts = (context.ctx as unknown as Recorder).texts;
    expect(texts.some((text) => text.includes('So Far Away'))).toBe(true);
    expect(texts.some((text) => text.includes('—'))).toBe(false);
  });
});

describe('withOverride', () => {
  it('is a no-op transform-wise when no override is set — untouched posters render identically', () => {
    const context = rc(demoAlbum());
    withOverride(context, 'title', { x: 40, y: 60 }, { width: 300, height: 50 }, () => {
      context.ctx.fillText('hello', 40, 60);
    });

    const calls = (context.ctx as unknown as Recorder).calls.map((call) => call.name);
    expect(calls).toEqual(['save', 'restore']);
    expect(calls).not.toContain('translate');
    expect(calls).not.toContain('scale');
  });

  it('translates by dx/dy and records the shifted box', () => {
    const context = rc(demoAlbum(), { layoutOverrides: { title: { dx: 10, dy: -5, scale: 1 } } });
    withOverride(context, 'title', { x: 40, y: 60 }, { width: 300, height: 50 }, () => undefined);

    const calls = (context.ctx as unknown as Recorder).calls;
    expect(calls.map((call) => call.name)).toEqual([
      'save',
      'translate',
      'scale',
      'translate',
      'restore',
    ]);
    expect(context.layout.get('title')).toEqual({ x: 50, y: 55, width: 300, height: 50 });
  });

  it('anchors scale at the element’s own position, not the canvas origin', () => {
    const context = rc(demoAlbum(), {
      layoutOverrides: { cover: { dx: 0, dy: 0, scale: 2 } },
    });
    withOverride(context, 'cover', { x: 100, y: 200 }, { width: 80, height: 80 }, () => undefined);

    // The anchor point itself does not move — only the box grows around it.
    expect(context.layout.get('cover')).toEqual({ x: 100, y: 200, width: 160, height: 160 });
  });

  it('passes save/scale/translate calls through to the canvas in anchor-preserving order', () => {
    const context = rc(demoAlbum(), {
      layoutOverrides: { cover: { dx: 5, dy: 5, scale: 2 } },
    });
    withOverride(context, 'cover', { x: 100, y: 200 }, { width: 80, height: 80 }, () => undefined);

    const calls = (context.ctx as unknown as Recorder).calls;
    expect(calls).toEqual([
      { name: 'save', args: [] },
      { name: 'translate', args: [105, 205] },
      { name: 'scale', args: [2, 2] },
      { name: 'translate', args: [-100, -200] },
      { name: 'restore', args: [] },
    ]);
  });

  it("returns the wrapped draw call's own return value", () => {
    const context = rc(demoAlbum());
    const result = withOverride(
      context,
      'palette',
      { x: 0, y: 0 },
      { width: 10, height: 10 },
      () => 42,
    );
    expect(result).toBe(42);
  });
});
