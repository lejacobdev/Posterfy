/**
 * Translation layer. `t()` resolves dot-paths against the active dictionary and
 * falls back to English for any key a locale has not translated yet.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSettings } from '@/lib/store/settings';
import { DEFAULT_LOCALE, type Locale } from './detect';
import { en, type Dictionary } from './locales/en';
import { de } from './locales/de';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { ptBR } from './locales/pt-BR';
import { it } from './locales/it';

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  de,
  es,
  fr,
  'pt-BR': ptBR,
  it,
};

type Vars = Record<string, string | number>;

function resolve(dictionary: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, dictionary);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export interface I18nValue {
  locale: Locale;
  dict: Dictionary;
  /** Returns a translated string; unknown keys return the key itself. */
  t: (path: string, vars?: Vars) => string;
  /** Returns any node from the dictionary — used for arrays of items. */
  list: <T>(path: string) => T[];
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useSettings();
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

  const t = useCallback(
    (path: string, vars?: Vars): string => {
      const value = resolve(dict, path) ?? resolve(en, path);
      if (typeof value === 'string') return interpolate(value, vars);
      if (typeof value === 'number') return String(value);
      // Missing keys surface as the path itself, which is obvious in review.
      return path;
    },
    [dict],
  );

  const list = useCallback(
    <T,>(path: string): T[] => {
      const value = resolve(dict, path) ?? resolve(en, path);
      return Array.isArray(value) ? (value as T[]) : [];
    },
    [dict],
  );

  const value = useMemo<I18nValue>(() => ({ locale, dict, t, list }), [locale, dict, t, list]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside an I18nProvider');
  return context;
}

/** The labels printed on the poster itself, in the active language. */
export function usePosterLabels() {
  const { dict } = useI18n();
  return useMemo(
    () => ({
      releaseDate: dict.poster.releaseDate,
      duration: dict.poster.duration,
      genres: dict.poster.genres,
      label: dict.poster.label,
      tracks: dict.poster.tracks,
      minutes: dict.poster.minutes,
    }),
    [dict],
  );
}
