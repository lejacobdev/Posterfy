/**
 * In-memory cache for album search responses.
 *
 * Two jobs:
 *
 *   1. An exact repeat costs nothing. Backspacing a character and typing it
 *      again, or retyping a query from a minute ago, answers from memory
 *      instead of going back to the network.
 *   2. A near miss still gives the list something to show *now*. Results for
 *      "dire" are usually a superset of results for "dire s", so they can be
 *      re-ranked for the longer query and displayed while the authoritative
 *      response is still in flight.
 *
 * Small and process-local by design: search results go stale, and there is no
 * value in persisting them across reloads.
 */

import type { AlbumSummary, ProviderId } from '@/lib/types';
import { normalize } from './fuzzy';

export interface CachedSearch {
  items: AlbumSummary[];
  provider: ProviderId;
}

interface Entry extends CachedSearch {
  storedAt: number;
}

/** Matches the `max-age` the search endpoint sends, so both agree on staleness. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 40;

export class SearchCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly limit: number = DEFAULT_LIMIT,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Queries differing only in case, spacing or punctuation share an entry. */
  private key(query: string): string {
    return normalize(query);
  }

  private live(entry: Entry | undefined): entry is Entry {
    return Boolean(entry) && this.now() - (entry as Entry).storedAt < this.ttlMs;
  }

  get(query: string): CachedSearch | undefined {
    const key = this.key(query);
    const entry = this.entries.get(key);
    if (!this.live(entry)) {
      if (entry) this.entries.delete(key);
      return undefined;
    }
    // Re-inserting makes this the most recently used, so eviction takes the
    // genuinely cold entries.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { items: entry.items, provider: entry.provider };
  }

  /**
   * The longest cached query that `query` starts with, whose results can stand
   * in until the real ones arrive. Never returns an exact match — `get` covers
   * that, and this is only for the provisional case.
   */
  findPrefix(query: string): CachedSearch | undefined {
    const key = this.key(query);
    let best: Entry | undefined;
    let bestLength = 0;

    for (const [candidate, entry] of this.entries) {
      if (candidate.length >= key.length) continue;
      if (!key.startsWith(candidate)) continue;
      if (!this.live(entry)) continue;
      if (candidate.length > bestLength) {
        best = entry;
        bestLength = candidate.length;
      }
    }

    return best ? { items: best.items, provider: best.provider } : undefined;
  }

  set(query: string, value: CachedSearch): void {
    const key = this.key(query);
    if (key.length === 0) return;

    this.entries.delete(key);
    this.entries.set(key, { ...value, storedAt: this.now() });

    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Shared by every search box, so opening the wizard after using the editor
 * still has whatever was already looked up.
 */
export const searchCache = new SearchCache();
