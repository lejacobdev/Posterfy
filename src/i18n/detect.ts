/**
 * Locale detection.
 *
 * Preference order: an explicit choice the user saved → the browser's language
 * list → the region implied by the device time zone → English. The time-zone
 * step is what makes the app follow the user's location without asking for a
 * geolocation permission or sending anything to a lookup service.
 */

export const SUPPORTED_LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'it'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, { label: string; english: string; flag: string }> = {
  en: { label: 'English', english: 'English', flag: '🇬🇧' },
  de: { label: 'Deutsch', english: 'German', flag: '🇩🇪' },
  es: { label: 'Español', english: 'Spanish', flag: '🇪🇸' },
  fr: { label: 'Français', english: 'French', flag: '🇫🇷' },
  'pt-BR': { label: 'Português', english: 'Portuguese (Brazil)', flag: '🇧🇷' },
  it: { label: 'Italiano', english: 'Italian', flag: '🇮🇹' },
};

/** Time zones grouped by the locale most likely to be wanted there. */
const TIMEZONE_LOCALES: Array<[Locale, RegExp]> = [
  ['de', /^Europe\/(Berlin|Vienna|Zurich|Busingen)$/],
  ['fr', /^Europe\/(Paris|Brussels|Luxembourg|Monaco)$/],
  [
    'fr',
    /^(Africa\/(Abidjan|Dakar|Algiers|Casablanca|Tunis)|Indian\/Reunion|America\/(Martinique|Guadeloupe|Cayenne))$/,
  ],
  ['es', /^Europe\/(Madrid|Ceuta)$/],
  ['es', /^Atlantic\/Canary$/],
  [
    'es',
    /^America\/(Mexico_City|Tijuana|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Mazatlan|Bogota|Lima|Santiago|Argentina\/.*|Caracas|Montevideo|Asuncion|La_Paz|Guayaquil|Panama|Managua|Tegucigalpa|San_Salvador|Guatemala|Costa_Rica|Havana|Santo_Domingo|Puerto_Rico)$/,
  ],
  [
    'pt-BR',
    /^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Eirunepe|Noronha)$/,
  ],
  [
    'pt-BR',
    /^(Europe\/Lisbon|Atlantic\/(Azores|Madeira)|Africa\/(Luanda|Maputo|Bissau|Sao_Tome))$/,
  ],
  ['it', /^Europe\/(Rome|Vatican|San_Marino|Malta)$/],
];

function normalize(tag: string): Locale | null {
  const value = tag.trim();
  if (!value) return null;

  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === value.toLowerCase());
  if (exact) return exact;

  const base = value.split('-')[0]?.toLowerCase();
  if (!base) return null;

  // Any Portuguese variant maps to the pt-BR dictionary.
  if (base === 'pt') return 'pt-BR';

  return SUPPORTED_LOCALES.find((locale) => locale.split('-')[0] === base) ?? null;
}

export function localeFromTimezone(timezone: string): Locale | null {
  for (const [locale, pattern] of TIMEZONE_LOCALES) {
    if (pattern.test(timezone)) return locale;
  }
  return null;
}

export function detectLocale(stored?: string | null): Locale {
  const explicit = stored ? normalize(stored) : null;
  if (explicit) return explicit;

  if (typeof navigator !== 'undefined') {
    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const candidate of candidates) {
      const match = normalize(candidate ?? '');
      if (match) return match;
    }
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      const match = localeFromTimezone(timezone);
      if (match) return match;
    }
  } catch {
    /* Intl unavailable — fall through */
  }

  return DEFAULT_LOCALE;
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * The two-letter market code Spotify wants, derived from the same signals.
 * Regional catalogues differ, so this keeps search results relevant.
 */
export function detectMarket(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const tag = navigator.languages?.[0] ?? navigator.language;
  if (!tag) return undefined;
  try {
    const region = new Intl.Locale(tag).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : undefined;
  } catch {
    const parts = tag.split('-');
    const last = parts[parts.length - 1];
    return last && /^[A-Za-z]{2}$/.test(last) ? last.toUpperCase() : undefined;
  }
}
