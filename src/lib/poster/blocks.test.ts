import { describe, expect, it } from 'vitest';
import type { Album, PosterOptions, PosterSpec, RenderContext } from '@/lib/types';
import { DEFAULT_OPTIONS } from './defaults';
import { posterArtist, posterTitle, drawTracklist } from './blocks';
import { resolveTheme } from './render';

interface Recorder {
  texts: string[];
}

/** Minimal 2D context stand-in that records fillText calls; mirrors render.test.ts's stub. */
function createContextStub(): CanvasRenderingContext2D & Recorder {
  const texts: string[] = [];
  const stub: Record<string, unknown> = {
    texts,
    canvas: { width: 0, height: 0 },
    save: () => undefined,
    restore: () => undefined,
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
