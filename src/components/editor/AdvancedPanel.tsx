/**
 * Advanced mode: pick an element (by clicking it on the preview or in this
 * list) and see every edit that applies to it in one place — the same
 * content controls Easy mode splits across Design/Content, plus the
 * position/size nudges that are Advanced's own.
 */

import { useCallback } from 'react';
import type { ElementId, LayoutBox, LayoutOverride, PaletteStyle } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { extractPalette } from '@/lib/color/color';
import { loadCover } from '@/lib/poster/cover';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import {
  PanelSection,
  SegmentedControl,
  Slider,
  TextField,
  Toggle,
} from '@/components/ui/Controls';
import { cn } from '@/lib/utils/misc';
import { ArtworkField } from './ArtworkField';
import { TracklistEditor } from './TracklistEditor';
import { elementLabel } from './elementLabels';

const DEFAULT_OVERRIDE: LayoutOverride = { dx: 0, dy: 0, scale: 1 };
const PALETTE_STYLES: PaletteStyle[] = ['bar', 'strip', 'dots', 'none'];

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
          <ElementContentControls id={activeId} />

          <hr className="divider" />

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

/** The content edit(s) specific to one element — everything besides where it sits. */
function ElementContentControls({ id }: { id: ElementId }) {
  const { t } = useI18n();
  const { album, options, setOption } = usePoster();
  const { notify } = useToast();

  const resample = useCallback(async () => {
    if (!album.coverUrl) return;
    try {
      const cover = await loadCover(album.coverUrl);
      setOption('palette', extractPalette(cover.image, { count: 6 }));
      notify(t('editor.resamplePalette'), 'success', 2000);
    } catch {
      notify(t('errors.albumFailed'), 'error');
    }
  }, [album.coverUrl, setOption, notify, t]);

  const setPaletteColor = (index: number, color: string) => {
    const next = [...options.palette];
    next[index] = color;
    setOption('palette', next);
  };

  switch (id) {
    case 'cover':
      return <ArtworkField />;

    case 'title':
      return (
        <TextField
          label={t('editor.titleOverride')}
          value={options.titleOverride}
          placeholder={album.title || '—'}
          maxLength={90}
          onChange={(value) => setOption('titleOverride', value)}
        />
      );

    case 'artist':
      return (
        <TextField
          label={t('editor.artistOverride')}
          value={options.artistOverride}
          placeholder={album.artist || '—'}
          maxLength={60}
          onChange={(value) => setOption('artistOverride', value)}
        />
      );

    case 'customNote':
      return (
        <TextField
          label={t('editor.customNote')}
          value={options.customNote}
          placeholder={t('editor.customNotePlaceholder')}
          maxLength={80}
          onChange={(value) => setOption('customNote', value)}
        />
      );

    case 'meta':
      return (
        <>
          <Toggle
            checked={options.showReleaseDate}
            onChange={(value) => setOption('showReleaseDate', value)}
            label={t('editor.showReleaseDate')}
            icon="calendar"
          />
          <Toggle
            checked={options.showDuration}
            onChange={(value) => setOption('showDuration', value)}
            label={t('editor.showDuration')}
            icon="clock"
          />
          <Toggle
            checked={options.showGenres}
            onChange={(value) => setOption('showGenres', value)}
            label={t('editor.showGenres')}
            icon="tag"
          />
          <Toggle
            checked={options.showLabel}
            onChange={(value) => setOption('showLabel', value)}
            label={t('editor.showLabel')}
            icon="disc"
          />
        </>
      );

    case 'tracklist':
      return (
        <>
          <Toggle
            checked={options.showTracklist}
            onChange={(value) => setOption('showTracklist', value)}
            label={t('editor.showTracklist')}
            icon="list"
          />
          <Toggle
            checked={options.showTrackNumbers}
            onChange={(value) => setOption('showTrackNumbers', value)}
            label={t('editor.showTrackNumbers')}
            disabled={!options.showTracklist}
          />
          <SegmentedControl<'auto' | '1' | '2' | '3'>
            label={t('editor.tracklistColumns')}
            value={
              options.tracklistColumns === 'auto'
                ? 'auto'
                : (String(options.tracklistColumns) as '1' | '2' | '3')
            }
            options={[
              { value: 'auto', label: t('editor.columnsAuto') },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
            onChange={(value) =>
              setOption(
                'tracklistColumns',
                value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3),
              )
            }
          />
          <PanelSection
            title={t('editor.sectionTracks')}
            icon="list"
            defaultOpen={false}
            badge={t('editor.tracksCount', { count: album.tracks.length })}
          >
            <TracklistEditor />
          </PanelSection>
        </>
      );

    case 'palette':
      return (
        <>
          <div className="field">
            <div className="palette-head">
              <span className="field__label">{t('editor.palette')}</span>
              {album.coverUrl && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void resample()}
                >
                  <Icon name="refresh" size={14} />
                  {t('editor.resamplePalette')}
                </button>
              )}
            </div>
            <div className="palette-swatches">
              {options.palette.map((color, index) => (
                <input
                  // Palette slots are positional, so the index is the identity.
                  key={index}
                  type="color"
                  className="palette-swatch"
                  value={color}
                  aria-label={`${t('editor.palette')} ${index + 1}`}
                  onChange={(event) => setPaletteColor(index, event.target.value)}
                />
              ))}
            </div>
          </div>
          <SegmentedControl<PaletteStyle>
            label={t('editor.paletteStyle')}
            value={options.paletteStyle}
            options={PALETTE_STYLES.map((style) => ({
              value: style,
              label: t(
                `editor.style${style.charAt(0).toUpperCase()}${style.slice(1)}` as
                  'editor.styleBar' | 'editor.styleDots' | 'editor.styleStrip' | 'editor.styleNone',
              ),
            }))}
            onChange={(value) => setOption('paletteStyle', value)}
          />
        </>
      );

    case 'scanCode':
      return (
        <Toggle
          checked={options.showScanCode}
          onChange={(value) => setOption('showScanCode', value)}
          label={t('editor.showScanCode')}
          icon="spotify"
        />
      );

    default:
      return null;
  }
}
