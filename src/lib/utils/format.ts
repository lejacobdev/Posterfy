/** Formatting helpers for durations, dates and lists. */

export function formatTrackDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '--:--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** `54 min` for short albums, `1 h 12 min` once it passes an hour. */
export function formatAlbumDuration(ms: number, minutesLabel = 'min', hoursLabel = 'h'): string {
  if (!Number.isFinite(ms) || ms <= 0) return `0 ${minutesLabel}`;
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} ${minutesLabel}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0
    ? `${hours} ${hoursLabel}`
    : `${hours} ${hoursLabel} ${minutes} ${minutesLabel}`;
}

export function releaseYear(releaseDate: string): string {
  const match = /^(\d{4})/.exec(releaseDate.trim());
  return match?.[1] ?? '';
}

/**
 * Formats a partial provider date (`1985`, `1985-05` or `1985-05-13`) using the
 * active locale, keeping the precision the provider actually gave us.
 */
export function formatReleaseDate(releaseDate: string, locale: string, full = false): string {
  const value = releaseDate.trim();
  if (!value) return '';
  const year = releaseYear(value);
  if (!full || value.length === 4) return year;

  const parts = value.split('-');
  const [y, m, d] = [parts[0], parts[1], parts[2]];
  if (!y) return '';
  const date = new Date(Number(y), m ? Number(m) - 1 : 0, d ? Number(d) : 1);
  if (Number.isNaN(date.getTime())) return year;

  try {
    if (parts.length >= 3) {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
    }
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(date);
  } catch {
    return year;
  }
}

export function formatList(items: string[], locale: string, limit = 3): string {
  const list = items.filter(Boolean).slice(0, limit);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0] ?? '';
  try {
    return new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(list);
  } catch {
    return list.join(', ');
  }
}

export function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

/**
 * Strips the noisy suffixes providers attach to titles
 * (`(Deluxe Edition)`, `- Remastered 2011`, …) when the user asks for clean text.
 */
export function cleanTitle(input: string): string {
  return input
    .replace(
      /\s*[([][^)\]]*(remaster|deluxe|expanded|anniversary|edition|version|bonus)[^)\]]*[)\]]/gi,
      '',
    )
    .replace(/\s*-\s*(remaster|deluxe|expanded|anniversary|edition|version|bonus)[^-]*$/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "3 days ago", "in 2 hours" — falls back to "just now" under a minute. */
export function formatRelativeTime(timestamp: number, locale: string, now = Date.now()): string {
  const diff = timestamp - now;
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= unitMs) {
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
          Math.round(diff / unitMs),
          unit,
        );
      } catch {
        break;
      }
    }
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'minute');
  } catch {
    return '';
  }
}
