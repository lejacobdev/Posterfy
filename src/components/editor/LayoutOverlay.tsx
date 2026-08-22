/**
 * Advanced mode's drag/select/resize overlay: one invisible hit target per
 * element the current template registered this render, positioned with plain
 * percentages so it never needs to know the canvas's actual pixel size —
 * only a drag gesture does, and only for that gesture's duration.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ElementId, FormatId, LayoutBox, LayoutOverride } from '@/lib/types';
import { designHeight } from '@/lib/poster/formats';
import { cn } from '@/lib/utils/misc';
import './LayoutOverlay.css';

export interface EditableText {
  value: string;
  placeholder: string;
}

export interface LayoutOverlayProps {
  layout: Map<ElementId, LayoutBox>;
  overrides: Partial<Record<ElementId, LayoutOverride>>;
  format: FormatId;
  selected: ElementId | null;
  onSelect: (id: ElementId | null) => void;
  onChange: (id: ElementId, override: LayoutOverride) => void;
  labelFor: (id: ElementId) => string;
  /** Elements with a free-text option behind them — these can be typed into directly. */
  editableText?: Partial<Record<ElementId, EditableText>>;
  onTextChange?: (id: ElementId, value: string) => void;
}

const DEFAULT_OVERRIDE: LayoutOverride = { dx: 0, dy: 0, scale: 1 };

export function LayoutOverlay({
  layout,
  overrides,
  format,
  selected,
  onSelect,
  onChange,
  labelFor,
  editableText,
  onTextChange,
}: LayoutOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designH = designHeight(format);
  const [editingId, setEditingId] = useState<ElementId | null>(null);

  // Selecting a different element (from the canvas or the panel list) always
  // closes any open text-editing box — there's only ever one at a time.
  useEffect(() => {
    setEditingId((current) => (current === selected ? current : null));
  }, [selected]);

  return (
    <div
      ref={containerRef}
      className="layout-overlay"
      onPointerDown={(event) => {
        // A click on the bare overlay background (not one of the hit boxes,
        // which stop propagation) deselects.
        if (event.target === event.currentTarget) onSelect(null);
      }}
    >
      {[...layout.entries()].map(([id, box]) => (
        <ElementHitBox
          key={id}
          id={id}
          box={box}
          designHeight={designH}
          override={overrides[id] ?? DEFAULT_OVERRIDE}
          selected={selected === id}
          editing={editingId === id}
          editableText={editableText?.[id]}
          onSelect={onSelect}
          onChange={onChange}
          onStartEdit={() => setEditingId(id)}
          onStopEdit={() => setEditingId(null)}
          onTextChange={(value) => onTextChange?.(id, value)}
          containerRef={containerRef}
          label={labelFor(id)}
        />
      ))}
    </div>
  );
}

interface ElementHitBoxProps {
  id: ElementId;
  box: LayoutBox;
  designHeight: number;
  override: LayoutOverride;
  selected: boolean;
  editing: boolean;
  editableText?: EditableText;
  onSelect: (id: ElementId) => void;
  onChange: (id: ElementId, override: LayoutOverride) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onTextChange: (value: string) => void;
  containerRef: RefObject<HTMLDivElement>;
  label: string;
}

/** Drag gesture state, kept in a ref so pointermove never triggers a re-render on its own. */
interface DragState {
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
  rectWidth: number;
  rectHeight: number;
  startOverride: LayoutOverride;
  /** Resize needs the box's own on-screen size to convert a drag distance into a scale factor. */
  boxPixelWidth: number;
}

function ElementHitBox({
  id,
  box,
  designHeight: designH,
  override,
  selected,
  editing,
  editableText,
  onSelect,
  onChange,
  onStartEdit,
  onStopEdit,
  onTextChange,
  containerRef,
  label,
}: ElementHitBoxProps) {
  const drag = useRef<DragState | null>(null);

  const beginDrag = (event: React.PointerEvent, mode: DragState['mode']) => {
    event.stopPropagation();
    event.preventDefault();
    onSelect(id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    drag.current = {
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      startOverride: override,
      boxPixelWidth: (box.width / 1000) * rect.width,
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const deltaXpx = event.clientX - state.startClientX;
    const deltaYpx = event.clientY - state.startClientY;

    if (state.mode === 'move') {
      const dx = state.startOverride.dx + (deltaXpx / state.rectWidth) * 1000;
      const dy = state.startOverride.dy + (deltaYpx / state.rectHeight) * designH;
      onChange(id, { ...state.startOverride, dx, dy });
      return;
    }

    // Resize: grow/shrink proportionally to how far the corner moved
    // relative to the box's own current on-screen size.
    const factor = 1 + deltaXpx / Math.max(1, state.boxPixelWidth);
    const scale = Math.max(0.2, Math.min(4, state.startOverride.scale * factor));
    onChange(id, { ...state.startOverride, scale });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const style = {
    left: `${(box.x / 1000) * 100}%`,
    top: `${(box.y / designH) * 100}%`,
    width: `${(box.width / 1000) * 100}%`,
    height: `${(box.height / designH) * 100}%`,
  };

  return (
    <div
      className={cn('layout-hitbox', selected && 'is-selected', editing && 'is-editing')}
      style={style}
      onPointerDown={(event) => {
        // While editing, the click is placing a text cursor — let the
        // browser handle it instead of hijacking it into a drag.
        if (editing) return;
        beginDrag(event, 'move');
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(event) => {
        if (!editableText) return;
        event.stopPropagation();
        onSelect(id);
        onStartEdit();
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(event) => {
        if (editing) return;
        if (event.key === 'Enter' && editableText) {
          event.preventDefault();
          onStartEdit();
          return;
        }
        const nudge = event.shiftKey ? 10 : 2;
        if (event.key === 'ArrowLeft') onChange(id, { ...override, dx: override.dx - nudge });
        else if (event.key === 'ArrowRight') onChange(id, { ...override, dx: override.dx + nudge });
        else if (event.key === 'ArrowUp') onChange(id, { ...override, dy: override.dy - nudge });
        else if (event.key === 'ArrowDown') onChange(id, { ...override, dy: override.dy + nudge });
        else return;
        event.preventDefault();
        onSelect(id);
      }}
    >
      {editing && editableText ? (
        <input
          type="text"
          className="layout-hitbox__input"
          autoFocus
          value={editableText.value}
          placeholder={editableText.placeholder}
          onChange={(event) => onTextChange(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            // Otherwise the outer hitbox's own handler would nudge the
            // element around, or the / character etc. would trigger a
            // keyboard shortcut, on every keystroke typed here.
            event.stopPropagation();
            if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
          }}
          onBlur={onStopEdit}
        />
      ) : (
        selected && (
          <span
            className="layout-hitbox__handle"
            onPointerDown={(event) => beginDrag(event, 'resize')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-hidden="true"
          />
        )
      )}
    </div>
  );
}
