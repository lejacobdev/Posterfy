import { describe, expect, it, vi } from 'vitest';
import {
  at,
  clamp,
  cn,
  debounce,
  formatBytes,
  hashString,
  lerp,
  mapRange,
  seededRandom,
  slugify,
  uid,
} from './misc';

describe('numeric helpers', () => {
  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('maps between ranges and clamps the result', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
    expect(mapRange(50, 0, 10, 0, 100)).toBe(100);
    expect(mapRange(1, 5, 5, 0, 100)).toBe(0);
  });
});

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', false, undefined, 'b', null)).toBe('a b');
  });
});

describe('hashString / seededRandom', () => {
  it('is stable for the same input', () => {
    expect(hashString('posterfy')).toBe(hashString('posterfy'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('produces a repeatable sequence in [0, 1)', () => {
    const first = Array.from({ length: 5 }, seededRandom(42));
    const random = seededRandom(42);
    const values = Array.from({ length: 5 }, () => random());
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(first).toHaveLength(5);

    const again = seededRandom(42);
    expect(Array.from({ length: 5 }, () => again())).toEqual(values);
  });
});

describe('slugify', () => {
  it('produces url-safe names', () => {
    expect(slugify('Northern Signal')).toBe('northern-signal');
    expect(slugify('  Hello!!  World  ')).toBe('hello-world');
  });

  it('caps the length', () => {
    expect(slugify('x'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('at', () => {
  it('returns the fallback for out-of-range access', () => {
    expect(at([1, 2, 3], 1, 0)).toBe(2);
    expect(at([1, 2, 3], 9, 0)).toBe(0);
  });
});

describe('uid', () => {
  it('prefixes and stays unique', () => {
    const a = uid('poster');
    const b = uid('poster');
    expect(a.startsWith('poster-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('debounce', () => {
  it('runs once after the delay', async () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 100);
    debounced();
    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('can be cancelled', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
