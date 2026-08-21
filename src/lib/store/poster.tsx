/**
 * Editor state: the album being posterised, every design option, and an
 * undo/redo history. Persisted to localStorage so a refresh never loses work.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type {
  Album,
  ElementId,
  LayoutOverride,
  PosterOptions,
  PosterSpec,
  Track,
} from '@/lib/types';
import {
  applyPreset as applyPresetOptions,
  createEmptyAlbum,
  DEFAULT_OPTIONS,
  type StylePreset,
} from '@/lib/poster/defaults';
import { readStorage, STORAGE_KEYS, writeStorage } from './storage';
import { hasRecentContent, upsertRecent } from './recent';
import {
  applyCustomTemplate as applyCustomTemplateOptions,
  type CustomTemplate,
} from './customTemplates';

interface PosterState {
  album: Album;
  options: PosterOptions;
  /** True once the user has picked an album or chosen to start from scratch. */
  started: boolean;
  past: Snapshot[];
  future: Snapshot[];
  /** Key of the last edited option, used to coalesce slider drags. */
  lastTouched: string | null;
  lastTouchedAt: number;
}

interface Snapshot {
  album: Album;
  options: PosterOptions;
}

interface StoredPoster extends Snapshot {
  started?: boolean;
}

type Action =
  | { type: 'setAlbum'; album: Album }
  | { type: 'setOption'; key: keyof PosterOptions; value: PosterOptions[keyof PosterOptions] }
  | { type: 'setOptions'; options: Partial<PosterOptions> }
  | { type: 'applyPreset'; preset: StylePreset }
  | { type: 'setTracks'; tracks: Track[] }
  | { type: 'setCover'; coverUrl: string | null }
  | { type: 'startDraft' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'hydrate'; snapshot: Snapshot };

const HISTORY_LIMIT = 60;
/** Consecutive edits to the same control inside this window collapse into one. */
const COALESCE_MS = 700;

function snapshot(state: PosterState): Snapshot {
  return { album: state.album, options: state.options };
}

function pushHistory(state: PosterState, key: string | null): Snapshot[] {
  const now = Date.now();
  const isContinuation =
    key !== null && key === state.lastTouched && now - state.lastTouchedAt < COALESCE_MS;
  if (isContinuation) return state.past;
  return [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
}

function totalDuration(tracks: Track[]): number {
  return tracks.reduce((sum, track) => sum + (track.durationMs || 0), 0);
}

function reducer(state: PosterState, action: Action): PosterState {
  switch (action.type) {
    case 'startDraft':
      return {
        ...state,
        started: true,
        // A fresh id per manual poster, so each one gets its own entry in the
        // recent-posters list instead of every manual draft ever started
        // colliding on the one shared placeholder id.
        album:
          state.album.id === 'draft'
            ? {
                ...state.album,
                id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              }
            : state.album,
      };

    case 'setAlbum':
      return {
        ...state,
        past: pushHistory(state, null),
        future: [],
        started: true,
        album: action.album,
        lastTouched: null,
        lastTouchedAt: Date.now(),
      };

    case 'setOption':
      return {
        ...state,
        past: pushHistory(state, String(action.key)),
        future: [],
        options: { ...state.options, [action.key]: action.value },
        lastTouched: String(action.key),
        lastTouchedAt: Date.now(),
      };

    case 'setOptions':
      return {
        ...state,
        past: pushHistory(state, null),
        future: [],
        options: { ...state.options, ...action.options },
        lastTouched: null,
        lastTouchedAt: Date.now(),
      };

    case 'applyPreset':
      return {
        ...state,
        past: pushHistory(state, null),
        future: [],
        // Not a spread: a preset is a starting point, so it replaces the
        // previous one's settings rather than layering over them.
        options: applyPresetOptions(state.options, action.preset),
        lastTouched: null,
        lastTouchedAt: Date.now(),
      };

    case 'setTracks':
      return {
        ...state,
        past: pushHistory(state, null),
        future: [],
        album: {
          ...state.album,
          tracks: action.tracks,
          totalDurationMs: totalDuration(action.tracks),
        },
        lastTouched: null,
        lastTouchedAt: Date.now(),
      };

    case 'setCover':
      return {
        ...state,
        past: pushHistory(state, null),
        future: [],
        album: { ...state.album, coverUrl: action.coverUrl, coverUrlHiRes: action.coverUrl },
        lastTouched: null,
        lastTouchedAt: Date.now(),
      };

    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
        album: previous.album,
        options: previous.options,
        lastTouched: null,
      };
    }

    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        album: next.album,
        options: next.options,
        lastTouched: null,
      };
    }

    case 'reset':
      return {
        ...state,
        past: pushHistory(state, null),
        future: [],
        options: { ...DEFAULT_OPTIONS },
        lastTouched: null,
      };

    case 'hydrate':
      // Loading a saved poster replaces the session outright — its own undo
      // history would be confusing to carry over from whatever was open
      // before it.
      return {
        ...state,
        album: action.snapshot.album,
        options: action.snapshot.options,
        started: true,
        past: [],
        future: [],
        lastTouched: null,
      };

    default:
      return state;
  }
}

function initialState(): PosterState {
  const stored = readStorage<StoredPoster | null>(STORAGE_KEYS.poster, null);
  const album = stored?.album ?? createEmptyAlbum();
  return {
    album,
    // Merge with defaults so posters saved by an older version still load.
    options: { ...DEFAULT_OPTIONS, ...(stored?.options ?? {}) },
    started: stored?.started ?? Boolean(album.title || album.artist || album.coverUrl),
    past: [],
    future: [],
    lastTouched: null,
    lastTouchedAt: 0,
  };
}

export interface PosterContextValue {
  album: Album;
  options: PosterOptions;
  spec: PosterSpec;
  canUndo: boolean;
  canRedo: boolean;
  /** Whether the editor should be shown instead of the pick-an-album state. */
  hasAlbum: boolean;
  setAlbum: (album: Album) => void;
  /** Opens the editor with a blank poster the user fills in by hand. */
  startDraft: () => void;
  setOption: <K extends keyof PosterOptions>(key: K, value: PosterOptions[K]) => void;
  setOptions: (options: Partial<PosterOptions>) => void;
  applyPreset: (preset: StylePreset) => void;
  /** Loads a saved custom template as a new design starting point. */
  applyCustomTemplate: (template: CustomTemplate) => void;
  setTracks: (tracks: Track[]) => void;
  setCover: (coverUrl: string | null) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  /** Replaces the whole session with a previously saved poster. */
  load: (spec: PosterSpec) => void;
  /**
   * Advanced mode: nudges/resizes one element. Repeated calls for the same
   * element within the usual coalescing window (a drag gesture, most of all)
   * collapse into a single undo step, same as a slider drag already does.
   */
  setLayoutOverride: (id: ElementId, override: LayoutOverride) => void;
  /** Returns one element to the template's own computed position. */
  resetLayoutOverride: (id: ElementId) => void;
  /** Returns every element in the current template to its default layout. */
  resetAllLayoutOverrides: () => void;
}

const PosterContext = createContext<PosterContextValue | null>(null);

export function PosterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Persist on every change; localStorage writes are cheap and this is small.
  useEffect(() => {
    writeStorage(STORAGE_KEYS.poster, {
      album: state.album,
      options: state.options,
      started: state.started,
    });
    // A poster only earns a spot in "recent" once it is more than the blank
    // starting point — otherwise clicking "start blank" alone would already
    // create an entry before the user has typed anything into it. A manual
    // draft's title/artist live in the option overrides, not on the album
    // itself, so that check has to look there too.
    if (state.started && hasRecentContent(state.album, state.options)) {
      upsertRecent(state.album, state.options);
    }
  }, [state.album, state.options, state.started]);

  const setOption = useCallback(
    <K extends keyof PosterOptions>(key: K, value: PosterOptions[K]) => {
      dispatch({ type: 'setOption', key, value });
    },
    [],
  );

  const value = useMemo<PosterContextValue>(
    () => ({
      album: state.album,
      options: state.options,
      spec: { album: state.album, options: state.options },
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      hasAlbum:
        state.started || Boolean(state.album.title || state.album.artist || state.album.coverUrl),
      setAlbum: (album) => dispatch({ type: 'setAlbum', album }),
      startDraft: () => dispatch({ type: 'startDraft' }),
      setOption,
      setOptions: (options) => dispatch({ type: 'setOptions', options }),
      applyPreset: (preset) => dispatch({ type: 'applyPreset', preset }),
      applyCustomTemplate: (template) =>
        dispatch({
          type: 'setOptions',
          options: applyCustomTemplateOptions(state.options, template),
        }),
      setTracks: (tracks) => dispatch({ type: 'setTracks', tracks }),
      setCover: (coverUrl) => dispatch({ type: 'setCover', coverUrl }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      reset: () => dispatch({ type: 'reset' }),
      load: (spec) => dispatch({ type: 'hydrate', snapshot: spec }),
      setLayoutOverride: (id, override) =>
        dispatch({
          type: 'setOption',
          key: 'layoutOverrides',
          value: { ...state.options.layoutOverrides, [id]: override },
        }),
      resetLayoutOverride: (id) => {
        const next = { ...state.options.layoutOverrides };
        delete next[id];
        dispatch({ type: 'setOption', key: 'layoutOverrides', value: next });
      },
      resetAllLayoutOverrides: () =>
        dispatch({ type: 'setOption', key: 'layoutOverrides', value: {} }),
    }),
    [state, setOption],
  );

  return <PosterContext.Provider value={value}>{children}</PosterContext.Provider>;
}

export function usePoster(): PosterContextValue {
  const context = useContext(PosterContext);
  if (!context) throw new Error('usePoster must be used inside a PosterProvider');
  return context;
}
