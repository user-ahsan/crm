'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseInViewOptions {
  /** Fraction of the element that must be visible to trigger (default 0.1). */
  threshold?: number;
  /** Root element for the IntersectionObserver (defaults to viewport). */
  root?: Element | Document | null;
  /** Margin around the root, e.g. '100px' (defaults to none). */
  rootMargin?: string;
}

/**
 * Intersection Observer hook for lazy loading / infinite scroll.
 *
 * Accepts either the documented options object (`useInView({ threshold })`)
 * or the legacy numeric shorthand (`useInView(0.1)`). Always returns the
 * `[ref, inView]` tuple — callers destructure it either way.
 */
export function useInView(options: UseInViewOptions | number = 0.1) {
  const { threshold = 0.1, root = null, rootMargin = undefined } =
    typeof options === 'number' ? { threshold: options } : options;
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // If already in view or no node, bail
      if (!node || inView) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observerRef.current?.disconnect();
          }
        },
        { threshold, root, rootMargin },
      );

      observerRef.current.observe(node);
    },
    [threshold, root, rootMargin, inView],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  return [ref, inView] as const;
}
