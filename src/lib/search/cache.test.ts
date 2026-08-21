import { describe, expect, it } from 'vitest';
import type { AlbumSummary } from '@/lib/types';
import { SearchCache } from './cache';

function results(...titles: string[]): AlbumSummary[] {
  return titles.map((title, index) => ({
    id: `${index}-${title}`,
    source: 'spotify',
    title,
    artist: 'Someone',
    releaseDate: '2000-01-01',
    coverUrl: null,
    totalTracks: 10,
  }));
}

describe('SearchCache', () => {
  it('returns what was stored', () => {
    const cache = new SearchCache();
    cache.set('dire straits', { items: results('Brothers in Arms'), provider: 'spotify' });
    expect(cache.get('dire straits')?.items).toHaveLength(1);
    expect(cache.get('dire straits')?.provider).toBe('spotify');
  });

  it('ignores case, spacing and punctuation', () => {
    const cache = new SearchCache();
    cache.set('Dire Straits', { items: results('A'), provider: 'spotify' });
    expect(cache.get('  dire   straits  ')).toBeDefined();
    expect(cache.get('DIRE STRAITS!')).toBeDefined();
  });

  it('misses on a query never stored', () => {
    const cache = new SearchCache();
    cache.set('dire', { items: results('A'), provider: 'spotify' });
    expect(cache.get('radiohead')).toBeUndefined();
  });

  it('expires entries past the ttl', () => {
    let now = 1_000;
    const cache = new SearchCache(10, 5_000, () => now);
    cache.set('dire', { items: results('A'), provider: 'spotify' });
    now += 4_999;
    expect(cache.get('dire')).toBeDefined();
    now += 2;
    expect(cache.get('dire')).toBeUndefined();
  });

  it('evicts the least recently used once full', () => {
    const cache = new SearchCache(2);
    cache.set('one', { items: results('A'), provider: 'spotify' });
    cache.set('two', { items: results('B'), provider: 'spotify' });
    // Touching "one" makes "two" the coldest.
    cache.get('one');
    cache.set('three', { items: results('C'), provider: 'spotify' });

    expect(cache.size).toBe(2);
    expect(cache.get('one')).toBeDefined();
    expect(cache.get('two')).toBeUndefined();
    expect(cache.get('three')).toBeDefined();
  });

  describe('findPrefix', () => {
    it('finds a shorter query the current one starts with', () => {
      const cache = new SearchCache();
      cache.set('dire', { items: results('Brothers in Arms'), provider: 'spotify' });
      expect(cache.findPrefix('dire straits')?.items).toHaveLength(1);
    });

    it('prefers the longest prefix, as the closest match', () => {
      const cache = new SearchCache();
      cache.set('d', { items: results('Short'), provider: 'spotify' });
      cache.set('dire str', { items: results('Long'), provider: 'spotify' });
      expect(cache.findPrefix('dire straits')?.items[0]?.title).toBe('Long');
    });

    it('does not return an exact match', () => {
      // `get` owns that case; this one exists only for provisional results.
      const cache = new SearchCache();
      cache.set('dire', { items: results('A'), provider: 'spotify' });
      expect(cache.findPrefix('dire')).toBeUndefined();
    });

    it('does not return a longer query', () => {
      const cache = new SearchCache();
      cache.set('dire straits', { items: results('A'), provider: 'spotify' });
      expect(cache.findPrefix('dire')).toBeUndefined();
    });

    it('skips expired prefixes', () => {
      let now = 1_000;
      const cache = new SearchCache(10, 5_000, () => now);
      cache.set('dire', { items: results('A'), provider: 'spotify' });
      now += 6_000;
      expect(cache.findPrefix('dire straits')).toBeUndefined();
    });
  });

  it('stores nothing for an empty query', () => {
    const cache = new SearchCache();
    cache.set('   ', { items: results('A'), provider: 'spotify' });
    expect(cache.size).toBe(0);
  });

  it('clears', () => {
    const cache = new SearchCache();
    cache.set('dire', { items: results('A'), provider: 'spotify' });
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
