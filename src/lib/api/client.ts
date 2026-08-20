/** Fetch wrapper with timeouts, typed errors and JSON parsing. */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'api_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 15_000;

/** Merges an external abort signal with our own timeout. */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
    timeoutMs,
  );

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

export async function getJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { signal, cleanup } = withTimeout(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json', ...options.headers },
      credentials: 'omit',
    });

    if (!response.ok) {
      let code = 'http_error';
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) code = body.error;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(`Request failed with ${response.status}`, response.status, code);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('The request timed out', 408, 'timeout');
    }
    throw new ApiError('Network request failed', 0, 'network_error');
  } finally {
    cleanup();
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Serialises calls with a minimum gap between them.
 * MusicBrainz asks for at most one request per second from a client.
 */
export function createRateLimiter(minIntervalMs: number) {
  let chain: Promise<unknown> = Promise.resolve();
  let lastRun = 0;

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = Math.max(0, lastRun + minIntervalMs - Date.now());
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRun = Date.now();
      return task();
    });
    // Keep the chain alive even when a task rejects.
    chain = run.catch(() => undefined);
    return run;
  };
}
