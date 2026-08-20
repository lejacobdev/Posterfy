import { describe, expect, it } from 'vitest';
import {
  cleanTitle,
  formatAlbumDuration,
  formatList,
  formatReleaseDate,
  formatTrackDuration,
  pluralize,
  releaseYear,
  titleCase,
} from './format';

describe('formatTrackDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatTrackDuration(222_000)).toBe('3:42');
    expect(formatTrackDuration(60_000)).toBe('1:00');
    expect(formatTrackDuration(5_000)).toBe('0:05');
  });

  it('handles missing durations', () => {
    expect(formatTrackDuration(0)).toBe('--:--');
    expect(formatTrackDuration(Number.NaN)).toBe('--:--');
  });
});

describe('formatAlbumDuration', () => {
  it('stays in minutes below an hour', () => {
    expect(formatAlbumDuration(54 * 60_000)).toBe('54 min');
  });

  it('switches to hours', () => {
    expect(formatAlbumDuration(72 * 60_000)).toBe('1 h 12 min');
    expect(formatAlbumDuration(120 * 60_000)).toBe('2 h');
  });

  it('accepts translated units', () => {
    expect(formatAlbumDuration(90 * 60_000, 'Min.', 'Std.')).toBe('1 Std. 30 Min.');
  });
});

describe('releaseYear', () => {
  it('extracts the year from any precision', () => {
    expect(releaseYear('1985')).toBe('1985');
    expect(releaseYear('1985-05')).toBe('1985');
    expect(releaseYear('1985-05-13')).toBe('1985');
    expect(releaseYear('')).toBe('');
  });
});

describe('formatReleaseDate', () => {
  it('returns just the year by default', () => {
    expect(formatReleaseDate('1985-05-13', 'en')).toBe('1985');
  });

  it('formats a full date when asked', () => {
    const result = formatReleaseDate('1985-05-13', 'en-GB', true);
    expect(result).toContain('1985');
    expect(result).toMatch(/May/);
  });

  it('keeps year-only precision even in full mode', () => {
    expect(formatReleaseDate('1985', 'en', true)).toBe('1985');
  });
});

describe('formatList', () => {
  it('joins values', () => {
    expect(formatList(['Rock', 'Pop'], 'en')).toMatch(/Rock/);
    expect(formatList(['Rock'], 'en')).toBe('Rock');
    expect(formatList([], 'en')).toBe('');
  });

  it('respects the limit', () => {
    const result = formatList(['a', 'b', 'c', 'd'], 'en', 2);
    expect(result).not.toContain('c');
  });
});

describe('cleanTitle', () => {
  it('strips remaster and edition suffixes', () => {
    expect(cleanTitle('Album Name (Deluxe Edition)')).toBe('Album Name');
    expect(cleanTitle('Album Name - Remastered 1996')).toBe('Album Name');
  });

  it('leaves ordinary titles alone', () => {
    expect(cleanTitle('Northern Signal')).toBe('Northern Signal');
  });
});

describe('misc formatting', () => {
  it('title-cases words', () => {
    expect(titleCase('northern signal')).toBe('Northern Signal');
  });

  it('pluralises', () => {
    expect(pluralize(1, 'track', 'tracks')).toBe('track');
    expect(pluralize(2, 'track', 'tracks')).toBe('tracks');
  });
});
