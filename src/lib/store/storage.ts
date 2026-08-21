/** Typed, failure-tolerant wrappers around localStorage. */

export const STORAGE_KEYS = {
  settings: 'posterfy.settings',
  poster: 'posterfy.poster',
  credentials: 'posterfy.spotify',
  /** Every album/playlist the user has posterised, so they can pick one back up. */
  recent: 'posterfy.recent',
  /** User-saved design starting points, built from an edited built-in template. */
  customTemplates: 'posterfy.customTemplates',
} as const;

function available(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const probe = '__posterfy__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return true;
  } catch {
    // Private browsing modes and disabled storage both land here.
    return false;
  }
}

const canUseStorage = available();

export function readStorage<T>(key: string, fallback: T): T {
  if (!canUseStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  if (!canUseStorage) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded — the app keeps working with in-memory state only.
    return false;
  }
}

export function removeStorage(key: string): void {
  if (!canUseStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

export function clearPosterfyStorage(): void {
  for (const key of Object.values(STORAGE_KEYS)) removeStorage(key);
}

export function isStorageAvailable(): boolean {
  return canUseStorage;
}
