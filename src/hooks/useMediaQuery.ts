import { useEffect, useState } from 'react';

/** Subscribes to a media query and re-renders when it changes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/** Breakpoints used across the app, kept in sync with the CSS. */
export const BREAKPOINTS = {
  mobile: '(max-width: 719px)',
  tablet: '(min-width: 720px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
  wide: '(min-width: 1440px)',
  touch: '(hover: none) and (pointer: coarse)',
} as const;

export function useIsMobile(): boolean {
  return useMediaQuery(BREAKPOINTS.mobile);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(BREAKPOINTS.desktop);
}

export function useIsTouch(): boolean {
  return useMediaQuery(BREAKPOINTS.touch);
}

/** Tracks the browser's online/offline state. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
