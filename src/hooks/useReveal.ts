import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/utils/misc';

export interface RevealOptions {
  /** Fraction of the element that must be visible before it animates in. */
  threshold?: number;
  rootMargin?: string;
  /** Re-animate every time the element scrolls back into view. */
  repeat?: boolean;
}

function showImmediately(element: HTMLElement, includeChildren: boolean): void {
  element.classList.add('is-visible');
  if (!includeChildren) return;
  for (const child of Array.from(element.children)) {
    child.classList.add('is-visible');
  }
}

/**
 * Adds `is-visible` to an element once it scrolls into view.
 * Returns a ref to attach to the element you want revealed.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: RevealOptions = {}) {
  const { threshold = 0.15, rootMargin = '0px 0px -8% 0px', repeat = false } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    // Reduced motion: show everything immediately, skip the observer entirely.
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      showImmediately(element, false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            if (!repeat) observer.unobserve(entry.target);
          } else if (repeat) {
            entry.target.classList.remove('is-visible');
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, repeat]);

  return ref;
}

/**
 * Reveals a container and its direct children with a stagger.
 *
 * The children are revealed by the same observer as the container — observing
 * each child separately made short items at the bottom of a grid stay hidden.
 */
export function useStaggeredReveal<T extends HTMLElement = HTMLDivElement>(
  step = 80,
  options: RevealOptions = {},
) {
  const { threshold = 0.08, rootMargin = '0px 0px -6% 0px', repeat = false } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const children = Array.from(element.children) as HTMLElement[];
    children.forEach((child, index) => {
      child.style.setProperty('--reveal-delay', `${index * step}ms`);
    });

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      showImmediately(element, true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            showImmediately(entry.target as HTMLElement, true);
            if (!repeat) observer.unobserve(entry.target);
          } else if (repeat) {
            entry.target.classList.remove('is-visible');
            for (const child of Array.from(entry.target.children)) {
              child.classList.remove('is-visible');
            }
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
    // Children are re-measured whenever the list length changes.
  }, [step, threshold, rootMargin, repeat]);

  return ref;
}
