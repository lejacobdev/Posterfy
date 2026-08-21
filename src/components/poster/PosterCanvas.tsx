/**
 * Renders a poster spec into a canvas that fills its container.
 *
 * Rendering is asynchronous (fonts and artwork must load first) and every run
 * is guarded by a token so a fast sequence of edits can't paint an older frame
 * over a newer one.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ElementId, LayoutBox, LoadedCover, PosterSpec } from '@/lib/types';
import { designHeight } from '@/lib/poster/formats';
import { preparePosterAssets, renderPoster } from '@/lib/poster/render';
import { usePosterLabels, useI18n } from '@/i18n';
import { cn } from '@/lib/utils/misc';
import './PosterCanvas.css';

/** Used only when the element reports no width at all, so something still draws. */
const FALLBACK_WIDTH = 600;

export interface PosterCanvasProps {
  spec: PosterSpec;
  className?: string;
  /** Cap on the bitmap width in device pixels — preview quality vs. cost. */
  maxRenderWidth?: number;
  /** Called with the palette sampled from the artwork. */
  onPalette?: (palette: string[]) => void;
  onRenderStateChange?: (state: 'loading' | 'ready' | 'error') => void;
  ariaLabel?: string;
  /**
   * Called once per render with where every element actually ended up (in
   * design-grid units) — advanced mode's drag/select overlay reads this to
   * position its hit targets. Ignored by every other caller.
   */
  onLayout?: (layout: Map<ElementId, LayoutBox>) => void;
  /**
   * Extra content absolutely positioned over the canvas, filling the same
   * box — the advanced-mode drag/select overlay, when the caller wants one.
   */
  overlay?: ReactNode;
}

export function PosterCanvas({
  spec,
  className,
  maxRenderWidth = 1400,
  onPalette,
  onRenderStateChange,
  ariaLabel,
  onLayout,
  overlay,
}: PosterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const labels = usePosterLabels();
  const { locale } = useI18n();

  // Assets are cached across renders so slider drags don't refetch artwork.
  const assetsRef = useRef<{ key: string; cover: LoadedCover | null; scan: LoadedCover | null }>({
    key: '',
    cover: null,
    scan: null,
  });
  const renderToken = useRef(0);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setContainerWidth(element.getBoundingClientRect().width);

    // A zero first measurement must not leave the poster permanently unpainted.
    // ResizeObserver only fires again if the box actually changes, so re-measure
    // on the next frame and fall back to a sensible width if it is still zero.
    const retry = requestAnimationFrame(() => {
      const width = element.getBoundingClientRect().width;
      setContainerWidth((current) => (current > 0 ? current : width > 0 ? width : FALLBACK_WIDTH));
    });

    return () => {
      cancelAnimationFrame(retry);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth <= 0) return undefined;

    const token = ++renderToken.current;
    let cancelled = false;

    const run = async () => {
      const assetKey = `${spec.album.coverUrl ?? ''}|${spec.album.uri ?? ''}|${spec.options.showScanCode}`;
      const cached = assetsRef.current;

      if (cached.key !== assetKey) {
        setStatus('loading');
        onRenderStateChange?.('loading');
        try {
          const assets = await preparePosterAssets(spec, {
            samplePalette: Boolean(onPalette),
            quality: 'preview',
          });
          if (cancelled || token !== renderToken.current) return;
          assetsRef.current = { key: assetKey, cover: assets.cover, scan: assets.scanImage };
          if (assets.palette && onPalette) onPalette(assets.palette);
        } catch {
          if (cancelled) return;
          assetsRef.current = { key: assetKey, cover: null, scan: null };
        }
      }

      if (cancelled || token !== renderToken.current) return;

      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.min(Math.round(containerWidth * dpr), maxRenderWidth);
        renderPoster({
          canvas,
          spec,
          width,
          locale,
          labels,
          cover: assetsRef.current.cover,
          scanImage: assetsRef.current.scan,
          onLayout,
        });
        setStatus('ready');
        onRenderStateChange?.('ready');
      } catch (error) {
        console.error('[posterfy] poster render failed', error);
        setStatus('error');
        onRenderStateChange?.('error');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // `labels`/`onPalette`/`onLayout` are stable enough; spec identity drives re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, containerWidth, maxRenderWidth, locale, labels]);

  const ratio = designHeight(spec.options.format) / 1000;

  return (
    <div
      ref={wrapperRef}
      className={cn('poster-canvas', status === 'loading' && 'is-loading', className)}
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      <canvas
        ref={canvasRef}
        className="poster-canvas__surface"
        role="img"
        aria-label={
          ariaLabel ?? `${spec.album.title || 'Album'} — ${spec.album.artist || 'poster preview'}`
        }
      />
      {status === 'loading' && <div className="poster-canvas__shimmer" aria-hidden="true" />}
      {overlay}
    </div>
  );
}
