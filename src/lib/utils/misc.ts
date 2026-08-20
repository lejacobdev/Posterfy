/** Small helpers used across the app. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Maps `value` from one range to another, clamped to the output range. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return wrapped;
}

/** Coalesces calls into a single animation frame. */
export function rafThrottle<Args extends unknown[]>(fn: (...args: Args) => void) {
  let frame: number | null = null;
  let lastArgs: Args | null = null;
  const wrapped = (...args: Args) => {
    lastArgs = args;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (lastArgs) fn(...lastArgs);
    });
  };
  wrapped.cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  return wrapped;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/** Deterministic 32-bit hash — used to derive stable pseudo-random layouts from an id. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Seeded PRNG so previews and exports always produce identical grain/scan codes. */
export function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give Safari a beat before revoking, otherwise the download can be cancelled.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Type-safe array access under `noUncheckedIndexedAccess`. */
export function at<T>(items: readonly T[], index: number, fallback: T): T {
  return items[index] ?? fallback;
}
