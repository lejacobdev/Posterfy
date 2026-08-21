/** Design controls: presets, template, format, colours, typography, finishing. */

import { useCallback, useState } from 'react';
import type { FontPairId, FormatId, PaletteStyle, TemplateId } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { STYLE_PRESETS, TEMPLATE_META } from '@/lib/poster/defaults';
import { FONT_PAIRS, FONT_PAIR_IDS } from '@/lib/poster/fonts';
import { FORMAT_IDS, POSTER_FORMATS } from '@/lib/poster/formats';
import { extractPalette } from '@/lib/color/color';
import { loadCover } from '@/lib/poster/cover';
import {
  listCustomTemplates,
  removeCustomTemplate,
  saveCustomTemplate,
  type CustomTemplate,
} from '@/lib/store/customTemplates';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import {
  ColorField,
  PanelSection,
  SegmentedControl,
  Slider,
  TextField,
  Toggle,
} from '@/components/ui/Controls';

const PALETTE_STYLES: PaletteStyle[] = ['bar', 'strip', 'dots', 'none'];

export function DesignPanel() {
  const { t } = useI18n();
  const { options, album, setOption, setOptions, applyPreset, applyCustomTemplate } = usePoster();
  const { notify } = useToast();
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() =>
    listCustomTemplates(),
  );
  const [templateName, setTemplateName] = useState('');

  const saveTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name) return;
    saveCustomTemplate(name, options);
    setCustomTemplates(listCustomTemplates());
    setTemplateName('');
    notify(t('editor.customTemplateSaved'), 'success', 2000);
  }, [templateName, options, notify, t]);

  const deleteTemplate = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.stopPropagation();
      if (!window.confirm(t('editor.deleteCustomTemplateConfirm'))) return;
      removeCustomTemplate(id);
      setCustomTemplates(listCustomTemplates());
    },
    [t],
  );

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

  return (
    <div className="editor-panel">
      <PanelSection title={t('editor.sectionPresets')} icon="sparkles">
        <div className="preset-grid">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-chip glass glass--interactive"
              onClick={() => applyPreset(preset)}
            >
              <span className="preset-chip__swatches" aria-hidden="true">
                {preset.swatches.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="preset-chip__text">
                <span className="preset-chip__name">{preset.name}</span>
                <span className="preset-chip__desc">{preset.description}</span>
              </span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title={t('editor.sectionCustomTemplates')} icon="layers">
        <div className="custom-template-save">
          <TextField
            label={t('editor.customTemplateName')}
            value={templateName}
            onChange={setTemplateName}
            placeholder={t('editor.customTemplateNamePlaceholder')}
            maxLength={40}
          />
          <button
            type="button"
            className="btn btn--outline btn--block"
            disabled={!templateName.trim()}
            onClick={saveTemplate}
          >
            <Icon name="layers" size={15} />
            {t('editor.saveAsTemplate')}
          </button>
        </div>

        {customTemplates.length > 0 ? (
          <div className="custom-template-list">
            {customTemplates.map((template) => (
              <article
                key={template.id}
                className="custom-template-chip"
                role="button"
                tabIndex={0}
                onClick={() => applyCustomTemplate(template)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') applyCustomTemplate(template);
                }}
              >
                <span className="custom-template-chip__text">
                  <span className="custom-template-chip__name">{template.name}</span>
                  <span className="custom-template-chip__meta">
                    {TEMPLATE_META.find((meta) => meta.id === template.baseTemplate)?.name}
                  </span>
                </span>
                <button
                  type="button"
                  className="custom-template-chip__remove"
                  aria-label={t('editor.deleteCustomTemplate')}
                  onClick={(event) => deleteTemplate(event, template.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="field__hint">{t('editor.customTemplateEmpty')}</p>
        )}
      </PanelSection>

      <PanelSection title={t('editor.sectionTemplate')} icon="layout">
        <div className="template-grid">
          {TEMPLATE_META.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`template-card ${options.template === template.id ? 'is-active' : ''}`}
              aria-pressed={options.template === template.id}
              onClick={() => setOption('template', template.id as TemplateId)}
            >
              <TemplateThumb id={template.id} />
              <span className="template-card__name">{template.name}</span>
            </button>
          ))}
        </div>
        <p className="field__hint">
          {TEMPLATE_META.find((template) => template.id === options.template)?.description}
        </p>
      </PanelSection>

      <PanelSection title={t('editor.sectionFormat')} icon="crop">
        <SegmentedControl<FormatId>
          label={t('editor.sectionFormat')}
          value={options.format}
          wrap
          options={FORMAT_IDS.map((id) => ({ value: id, label: POSTER_FORMATS[id].name }))}
          onChange={(value) => setOption('format', value)}
        />
        <p className="field__hint">
          {POSTER_FORMATS[options.format].description} ·{' '}
          {POSTER_FORMATS[options.format].printSizes.join(' · ')}
        </p>
      </PanelSection>

      <PanelSection title={t('editor.sectionColors')} icon="palette">
        <Toggle
          checked={options.autoColors}
          onChange={(value) => setOption('autoColors', value)}
          label={t('editor.autoColors')}
          hint={t('editor.autoColorsHelp')}
          icon="wand"
        />

        <div className="color-row">
          <ColorField
            label={t('editor.background')}
            value={options.background}
            disabled={options.autoColors}
            onChange={(value) => setOption('background', value)}
          />
          <ColorField
            label={t('editor.foreground')}
            value={options.foreground}
            disabled={options.autoColors}
            onChange={(value) => setOption('foreground', value)}
          />
          <ColorField
            label={t('editor.accent')}
            value={options.accent}
            disabled={options.autoColors}
            onChange={(value) => setOption('accent', value)}
          />
        </div>

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
      </PanelSection>

      <PanelSection title={t('editor.sectionTypography')} icon="type">
        <div className="font-grid">
          {FONT_PAIR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`font-card ${options.fontPair === id ? 'is-active' : ''}`}
              aria-pressed={options.fontPair === id}
              onClick={() => setOption('fontPair', id as FontPairId)}
            >
              <span
                className="font-card__sample"
                style={{ fontFamily: FONT_PAIRS[id].fonts.display }}
              >
                Aa
              </span>
              <span className="font-card__name">{FONT_PAIRS[id].name}</span>
            </button>
          ))}
        </div>
        <p className="field__hint">{FONT_PAIRS[options.fontPair].description}</p>

        <Toggle
          checked={options.uppercaseTitle}
          onChange={(value) => setOption('uppercaseTitle', value)}
          label={t('editor.uppercaseTitle')}
          icon="type"
        />
        <Slider
          label={t('editor.textScale')}
          value={options.textScale}
          min={0.75}
          max={1.35}
          step={0.01}
          onChange={(value) => setOption('textScale', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </PanelSection>

      <PanelSection title={t('editor.sectionEffects')} icon="droplet" defaultOpen={false}>
        <Slider
          label={t('editor.margin')}
          value={options.margin}
          min={0}
          max={0.13}
          step={0.005}
          onChange={(value) => setOption('margin', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Slider
          label={t('editor.coverRadius')}
          value={options.coverRadius}
          min={0}
          max={1}
          step={0.02}
          onChange={(value) => setOption('coverRadius', value)}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Slider
          label={t('editor.grain')}
          value={options.grain}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(value) => setOption('grain', value)}
          format={(value) => `${Math.round(value * 200)}%`}
        />
        <Slider
          label={t('editor.vignette')}
          value={options.vignette}
          min={0}
          max={0.6}
          step={0.02}
          onChange={(value) => setOption('vignette', value)}
          format={(value) => `${Math.round(value * 167)}%`}
        />
        <button
          type="button"
          className="btn btn--outline btn--block"
          onClick={() => setOptions({ grain: 0.12, vignette: 0, coverRadius: 0, margin: 0.075 })}
        >
          <Icon name="refresh" size={15} />
          {t('common.reset')}
        </button>
      </PanelSection>
    </div>
  );
}

/** Tiny abstract preview of each template's layout. */
function TemplateThumb({ id }: { id: TemplateId }) {
  return (
    <span className={`template-thumb template-thumb--${id}`} aria-hidden="true">
      <span className="template-thumb__art" />
      <span className="template-thumb__line" />
      <span className="template-thumb__line template-thumb__line--short" />
    </span>
  );
}
