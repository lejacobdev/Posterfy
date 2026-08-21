/**
 * App-wide settings: theme, language, motion preference and the optional
 * browser-stored Spotify credentials. Persisted to localStorage and applied to
 * the document root so CSS can react to them.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { detectLocale, type Locale } from '@/i18n/detect';
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from './storage';

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Easy hides the Advanced tab (per-element drag/resize) so a first-time user
 * isn't confronted with it; Advanced adds it back. Everything else in the
 * editor — album, design, content, export — is available in both.
 */
export type EditorMode = 'easy' | 'advanced';

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface Settings {
  theme: ThemePreference;
  locale: Locale;
  /** Set once the user picks a language by hand; stops auto-detection. */
  localePinned: boolean;
  reduceMotion: boolean;
  editorMode: EditorMode;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  locale: 'en',
  localePinned: false,
  reduceMotion: false,
  editorMode: 'easy',
};

interface SettingsContextValue extends Settings {
  /** The theme actually in effect once `system` is resolved. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  setReduceMotion: (value: boolean) => void;
  setEditorMode: (mode: EditorMode) => void;
  credentials: SpotifyCredentials | null;
  saveCredentials: (credentials: SpotifyCredentials) => void;
  clearCredentials: () => void;
  resetAll: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): Settings {
  const stored = readStorage<Partial<Settings>>(STORAGE_KEYS.settings, {});
  return {
    theme: stored.theme ?? DEFAULT_SETTINGS.theme,
    // Without a pinned choice the language follows the device on every visit.
    locale: detectLocale(stored.localePinned ? stored.locale : null),
    localePinned: stored.localePinned ?? false,
    reduceMotion: stored.reduceMotion ?? DEFAULT_SETTINGS.reduceMotion,
    editorMode: stored.editorMode ?? DEFAULT_SETTINGS.editorMode,
  };
}

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(systemTheme);
  const [credentials, setCredentials] = useState<SpotifyCredentials | null>(() =>
    readStorage<SpotifyCredentials | null>(STORAGE_KEYS.credentials, null),
  );

  useEffect(() => {
    writeStorage(STORAGE_KEYS.settings, settings);
  }, [settings]);

  // Track the OS theme so the `system` option stays live.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const listener = (event: MediaQueryListEvent) =>
      setSystemPreference(event.matches ? 'light' : 'dark');
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const resolvedTheme = settings.theme === 'system' ? systemPreference : settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.setAttribute('lang', settings.locale);
    root.toggleAttribute('data-reduce-motion', settings.reduceMotion);
  }, [resolvedTheme, settings.locale, settings.reduceMotion]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  const setLocale = useCallback((locale: Locale) => {
    setSettings((current) => ({ ...current, locale, localePinned: true }));
  }, []);

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    setSettings((current) => ({ ...current, reduceMotion }));
  }, []);

  const setEditorMode = useCallback((editorMode: EditorMode) => {
    setSettings((current) => ({ ...current, editorMode }));
  }, []);

  const saveCredentials = useCallback((next: SpotifyCredentials) => {
    setCredentials(next);
    writeStorage(STORAGE_KEYS.credentials, next);
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials(null);
    removeStorage(STORAGE_KEYS.credentials);
  }, []);

  const resetAll = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, locale: detectLocale(null) });
    setCredentials(null);
    removeStorage(STORAGE_KEYS.credentials);
    removeStorage(STORAGE_KEYS.poster);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      resolvedTheme,
      setTheme,
      setLocale,
      setReduceMotion,
      setEditorMode,
      credentials,
      saveCredentials,
      clearCredentials,
      resetAll,
    }),
    [
      settings,
      resolvedTheme,
      setTheme,
      setLocale,
      setReduceMotion,
      setEditorMode,
      credentials,
      saveCredentials,
      clearCredentials,
      resetAll,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside a SettingsProvider');
  return context;
}
