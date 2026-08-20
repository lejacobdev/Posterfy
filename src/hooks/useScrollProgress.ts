import { useEffect, useRef, useState } from 'react';
import { clamp, prefersReducedMotion, rafThrottle } from '@/lib/utils/misc';

/**
 * Reports how far an element has travelled through the viewport, from 0 (its
 * top edge just entering at the bottom) to 1 (its bottom edge leaving at the
 * top). Drives the scroll-linked 3D scenes.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return undefined;

    const update = rafThrottle(() => {
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const total = rect.height + viewport;
      const travelled = viewport - rect.top;
      setProgress(clamp(travelled / total, 0, 1));
    });

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      update.cancel();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return { ref, progress };
}

/** Window scroll offset in pixels, throttled to animation frames. */
export function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const update = rafThrottle(() => setScrollY(window.scrollY));
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      update.cancel();
      window.removeEventListener('scroll', update);
    };
  }, []);

  return scrollY;
}

export interface PointerTilt {
  /** -1 … 1 relative to the element centre. */
  x: number;
  y: number;
  active: boolean;
}

/**
 * Tracks pointer position over an element and returns a normalised tilt, used
 * for the parallax on the 3D scenes and the glass sheen.
 */
export function usePointerTilt<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [tilt, setTilt] = useState<PointerTilt>({ x: 0, y: 0, active: false });

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return undefined;

    const onMove = rafThrottle((event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      setTilt({ x: clamp(x, -1, 1), y: clamp(y, -1, 1), active: true });
      // Feed the CSS sheen, which reads these two custom properties.
      element.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
      element.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
    });

    const onLeave = () => setTilt({ x: 0, y: 0, active: false });

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      onMove.cancel();
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return { ref, tilt };
}
