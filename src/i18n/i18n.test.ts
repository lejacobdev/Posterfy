import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from './index';
import {
  detectLocale,
  detectMarket,
  isSupportedLocale,
  localeFromTimezone,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
} from './detect';
import { en } from './locales/en';

/** Flattens a dictionary into dot-paths so locales can be compared key by key. */
function paths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => paths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('dictionaries', () => {
  const expected = paths(en).sort();

  it('covers every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(DICTIONARIES[locale], `missing dictionary for ${locale}`).toBeDefined();
      expect(LOCALE_NAMES[locale]).toBeDefined();
    }
  });

  it.each(SUPPORTED_LOCALES)('%s has exactly the English key set', (locale) => {
    expect(paths(DICTIONARIES[locale]).sort()).toEqual(expected);
  });

  it.each(SUPPORTED_LOCALES)('%s has no empty strings', (locale) => {
    const empty: string[] = [];
    const walk = (value: unknown, prefix = '') => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${prefix}[${index}]`));
      } else if (value && typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
          walk(child, prefix ? `${prefix}.${key}` : key),
        );
      } else if (typeof value === 'string' && value.trim().length === 0) {
        empty.push(prefix);
      }
    };
    walk(DICTIONARIES[locale]);
    expect(empty).toEqual([]);
  });

  it('keeps interpolation placeholders in every translation', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(DICTIONARIES[locale].editor.tracksCount).toContain('{count}');
    }
  });
});

describe('detectLocale', () => {
  it('honours a stored preference', () => {
    expect(detectLocale('de')).toBe('de');
    expect(detectLocale('pt-BR')).toBe('pt-BR');
  });

  it('maps any Portuguese variant to pt-BR', () => {
    expect(detectLocale('pt')).toBe('pt-BR');
    expect(detectLocale('pt-PT')).toBe('pt-BR');
  });

  it('matches on the base language for regional tags', () => {
    expect(detectLocale('de-AT')).toBe('de');
    expect(detectLocale('es-MX')).toBe('es');
  });

  it('falls back to English for unsupported input', () => {
    expect(detectLocale('xx-YY')).toBe('en');
  });
});

describe('localeFromTimezone', () => {
  it('maps European zones to their language', () => {
    expect(localeFromTimezone('Europe/Berlin')).toBe('de');
    expect(localeFromTimezone('Europe/Vienna')).toBe('de');
    expect(localeFromTimezone('Europe/Paris')).toBe('fr');
    expect(localeFromTimezone('Europe/Madrid')).toBe('es');
    expect(localeFromTimezone('Europe/Rome')).toBe('it');
    expect(localeFromTimezone('Europe/Lisbon')).toBe('pt-BR');
  });

  it('maps the Americas', () => {
    expect(localeFromTimezone('America/Sao_Paulo')).toBe('pt-BR');
    expect(localeFromTimezone('America/Mexico_City')).toBe('es');
    expect(localeFromTimezone('America/Argentina/Buenos_Aires')).toBe('es');
  });

  it('returns null for zones with no mapping', () => {
    expect(localeFromTimezone('Asia/Tokyo')).toBeNull();
    expect(localeFromTimezone('America/New_York')).toBeNull();
  });
});

describe('locale helpers', () => {
  it('validates locale codes', () => {
    expect(isSupportedLocale('de')).toBe(true);
    expect(isSupportedLocale('kl')).toBe(false);
  });

  it('derives a two-letter market code', () => {
    const market = detectMarket();
    if (market !== undefined) expect(market).toMatch(/^[A-Z]{2}$/);
  });
});
