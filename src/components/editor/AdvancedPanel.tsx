/**
 * Advanced mode: pick an element (by clicking it on the preview or in this
 * list) and nudge its position/size numerically — the precise counterpart
 * to dragging it directly on the canvas.
 */

import type { ElementId, LayoutBox, LayoutOverride } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { Icon } from '@/components/ui/Icon';
import { PanelSection, Slider } from '@/components/ui/Controls';
import { cn } from '@/lib/utils/misc';
import { elementLabel } from './elementLabels';

const DEFAULT_OVERRIDE: LayoutOverride = { dx: 0, dy: 0, scale: 1 };

/** Stable, sensible order regardless of the Map's insertion order. */
const ELEMENT_ORDER: ElementId[] = [
  'cover',
  'title',
  'artist',
  'meta',
  'tracklist',
  'palette',
  'scanCode',
  'customNote',
];

export interface AdvancedPanelProps {
  layout: Map<ElementId, LayoutBox>;
  selected: ElementId | null;
  onSelect: (id: ElementId | null) => void;
}

export function AdvancedPanel({ layout, selected, onSelect }: AdvancedPanelProps) {
  const { t } = useI18n();
  const { options, setLayoutOverride, resetLayoutOverride, resetAllLayoutOverrides } = usePoster();

  const ids = ELEMENT_ORDER.filter((id) => layout.has(id));
  const activeId = selected && layout.has(selected) ? selected : null;
  const override = activeId ? (options.layoutOverrides[activeId] ?? DEFAULT_OVERRIDE) : null;
  const hasAnyOverride = Object.keys(options.layoutOverrides).length > 0;

  const update = (patch: Partial<LayoutOverride>) => {
    if (!activeId || !override) return;
    setLayoutOverride(activeId, { ...override, ...patch });
  };

  return (
    <div className="editor-panel">
      <p className="field__hint advanced-panel__hint">{t('editor.advancedHint')}</p>

      <PanelSection title={t('editor.advancedElementsTitle')} icon="layout">
        <div className="advanced-panel__list">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              className={cn('advanced-panel__item', activeId === id && 'is-active')}
              onClick={() => onSelect(id)}
            >
              <span>{elementLabel(t, id)}</span>
              {options.layoutOverrides[id] && (
                <span className="advanced-panel__item-dot" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </PanelSection>

      {activeId && override ? (
        <PanelSection title={elementLabel(t, activeId)} icon="sliders">
          <Slider
            label={t('editor.positionX')}
            value={Math.round(override.dx)}
            min={-400}
            max={400}
            step={1}
            onChange={(value) => update({ dx: value })}
          />
          <Slider
            label={t('editor.positionY')}
            value={Math.round(override.dy)}
            min={-500}
            max={500}
            step={1}
            onChange={(value) => update({ dy: value })}
          />
          <Slider
            label={t('editor.scale')}
            value={Math.round(override.scale * 100)}
            min={20}
            max={400}
            step={5}
            format={(value) => `${value}%`}
            onChange={(value) => update({ scale: value / 100 })}
          />
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => resetLayoutOverride(activeId)}
          >
            <Icon name="refresh" size={14} />
            {t('editor.resetPosition')}
          </button>
        </PanelSection>
      ) : (
        <p className="field__hint advanced-panel__hint">{t('editor.advancedSelectPrompt')}</p>
      )}

      {hasAnyOverride && (
        <button
          type="button"
          className="btn btn--ghost btn--sm advanced-panel__reset-all"
          onClick={() => {
            resetAllLayoutOverrides();
            onSelect(null);
          }}
        >
          <Icon name="refresh" size={14} />
          {t('editor.resetAllPositions')}
        </button>
      )}
    </div>
  );
}
