/**
 * Scroll-driven 3D scenes, built from CSS 3D transforms.
 *
 * Using the compositor rather than WebGL keeps the bundle small, works without
 * a GPU context, and degrades to a static image under `prefers-reduced-motion`.
 */

import { useMemo, type CSSProperties } from 'react';
import { useScrollProgress, usePointerTilt } from '@/hooks/useScrollProgress';
import { useSettings } from '@/lib/store/settings';
import { demoCoverStyle } from './sceneUtils';
import './VinylScene.css';

export interface VinylSceneProps {
  /** Album artwork shown on the sleeve and the record label. */
  coverUrl?: string;
  className?: string;
}

/** A record sliding out of its sleeve, rotating as the section scrolls past. */
export function VinylScene({ coverUrl, className }: VinylSceneProps) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const { ref: tiltRef, tilt } = usePointerTilt<HTMLDivElement>();
  const { reduceMotion } = useSettings();

  const stageStyle = useMemo<CSSProperties>(() => {
    if (reduceMotion) return {};
    const rotateY = -18 + progress * 30 + tilt.x * 8;
    const rotateX = 10 - progress * 16 - tilt.y * 6;
    return {
      transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
    };
  }, [progress, tilt.x, tilt.y, reduceMotion]);

  const discStyle = useMemo<CSSProperties>(() => {
    if (reduceMotion) return { transform: 'translate3d(38%, 0, -40px)' };
    // The record slides out and keeps spinning as the section passes.
    const slide = 18 + progress * 44;
    const spin = progress * 720;
    return {
      transform: `translate3d(${slide}%, 0, -40px) rotate(${spin}deg)`,
    };
  }, [progress, reduceMotion]);

  return (
    <div ref={ref} className={`vinyl-scene scene-3d ${className ?? ''}`}>
      <div ref={tiltRef} className="vinyl-scene__stage scene-3d__stage" style={stageStyle}>
        <div className="vinyl-scene__disc" style={discStyle} aria-hidden="true">
          <div className="vinyl-scene__grooves" />
          <div className="vinyl-scene__label" style={demoCoverStyle(coverUrl)} />
          <div className="vinyl-scene__spindle" />
        </div>

        <div className="vinyl-scene__sleeve" aria-hidden="true">
          <div className="vinyl-scene__art" style={demoCoverStyle(coverUrl)} />
          <div className="vinyl-scene__sheen" />
        </div>
      </div>
    </div>
  );
}

export interface PosterStackProps {
  /** Rendered poster nodes, stacked back to front. */
  children: React.ReactNode[];
  className?: string;
}

/**
 * Three posters floating in depth. They fan apart as the section scrolls into
 * view and respond to the pointer, which reads as a physical stack of prints.
 */
export function PosterStack({ children, className }: PosterStackProps) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const { ref: tiltRef, tilt } = usePointerTilt<HTMLDivElement>();
  const { reduceMotion } = useSettings();

  const stageStyle = useMemo<CSSProperties>(() => {
    if (reduceMotion) return {};
    const rotateY = -14 + tilt.x * 10 + progress * 8;
    const rotateX = 8 - tilt.y * 8 - progress * 10;
    return { transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` };
  }, [progress, tilt.x, tilt.y, reduceMotion]);

  return (
    <div ref={ref} className={`poster-stack scene-3d ${className ?? ''}`}>
      <div ref={tiltRef} className="poster-stack__stage scene-3d__stage" style={stageStyle}>
        {children.map((child, index) => {
          const depth = index - (children.length - 1) / 2;
          const spread = reduceMotion ? 1 : 0.35 + progress * 0.9;
          const style: CSSProperties = {
            transform: `translate3d(${depth * 26 * spread}%, ${Math.abs(depth) * -3 * spread}%, ${
              -Math.abs(depth) * 90
            }px) rotateY(${depth * -6}deg)`,
            zIndex: children.length - Math.abs(Math.round(depth)),
          };
          return (
            <div className="poster-stack__item" style={style} key={index}>
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
