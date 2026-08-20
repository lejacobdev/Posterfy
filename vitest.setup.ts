import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom ships neither of these and several components rely on them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
    configurable: true,
  });
}

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
}

if (!window.scrollTo) {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
}
