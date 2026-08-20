import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PosterProvider, usePoster } from './poster';
import { createEmptyAlbum, DEFAULT_OPTIONS, STYLE_PRESETS } from '@/lib/poster/defaults';
import type { Album } from '@/lib/types';

const wrapper = ({ children }: { children: ReactNode }) => (
  <PosterProvider>{children}</PosterProvider>
);

function demoAlbum(): Album {
  return {
    ...createEmptyAlbum(),
    id: 'demo',
    title: 'Northern Signal',
    artist: 'Halden Frost',
    tracks: [
      { position: 1, title: 'One', durationMs: 120_000 },
      { position: 2, title: 'Two', durationMs: 180_000 },
    ],
    totalDurationMs: 300_000,
  };
}

describe('poster store', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    expect(result.current.hasAlbum).toBe(false);
    expect(result.current.options.template).toBe(DEFAULT_OPTIONS.template);
  });

  it('opens the editor for a blank draft', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.startDraft());
    expect(result.current.hasAlbum).toBe(true);
  });

  it('stores a selected album', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setAlbum(demoAlbum()));
    expect(result.current.album.title).toBe('Northern Signal');
    expect(result.current.hasAlbum).toBe(true);
  });

  it('updates a single option', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setOption('template', 'vinyl'));
    expect(result.current.options.template).toBe('vinyl');
  });

  it('applies a style preset', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    const preset = STYLE_PRESETS[1]!;
    act(() => result.current.applyPreset(preset));
    expect(result.current.options.template).toBe(preset.options.template);
  });

  it('recomputes the total duration when tracks change', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setAlbum(demoAlbum()));
    act(() =>
      result.current.setTracks([
        { position: 1, title: 'Only', durationMs: 60_000 },
        { position: 2, title: 'Second', durationMs: 30_000 },
      ]),
    );
    expect(result.current.album.totalDurationMs).toBe(90_000);
  });

  it('undoes and redoes an edit', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setAlbum(demoAlbum()));
    act(() => result.current.setOption('template', 'minimal'));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.options.template).toBe(DEFAULT_OPTIONS.template);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.options.template).toBe('minimal');
  });

  it('ignores undo with nothing in the history', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.undo());
    expect(result.current.options).toEqual(DEFAULT_OPTIONS);
  });

  it('collapses rapid edits to the same control into one history entry', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setOption('grain', 0.2));
    act(() => result.current.setOption('grain', 0.3));
    act(() => result.current.setOption('grain', 0.4));

    act(() => result.current.undo());
    // One undo returns to the value before the drag started, not mid-drag.
    expect(result.current.options.grain).toBe(DEFAULT_OPTIONS.grain);
  });

  it('resets options but keeps the album', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setAlbum(demoAlbum()));
    act(() => result.current.setOption('template', 'duotone'));
    act(() => result.current.reset());
    expect(result.current.options.template).toBe(DEFAULT_OPTIONS.template);
    expect(result.current.album.title).toBe('Northern Signal');
  });

  it('persists to localStorage and restores on remount', () => {
    const first = renderHook(() => usePoster(), { wrapper });
    act(() => first.result.current.setAlbum(demoAlbum()));
    act(() => first.result.current.setOption('format', 'square'));
    first.unmount();

    const second = renderHook(() => usePoster(), { wrapper });
    expect(second.result.current.album.title).toBe('Northern Signal');
    expect(second.result.current.options.format).toBe('square');
  });

  it('sets a custom cover on both resolutions', () => {
    const { result } = renderHook(() => usePoster(), { wrapper });
    act(() => result.current.setCover('data:image/png;base64,abc'));
    expect(result.current.album.coverUrl).toBe('data:image/png;base64,abc');
    expect(result.current.album.coverUrlHiRes).toBe('data:image/png;base64,abc');
  });
});
