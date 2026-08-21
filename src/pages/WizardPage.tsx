/**
 * The guided poster wizard.
 *
 * Five steps — record, look, size, contents, finish — each writing straight
 * into the poster store, so the preview beside them is the real renderer and
 * whatever the wizard produces is already loaded when the editor opens.
 *
 * Layout: one column on phones with the preview above the choices, two columns
 * from the tablet breakpoint up with the preview sticky.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Album, FormatId, PaletteStyle } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useI18n, usePosterLabels } from '@/i18n';
import { presetPreviewOptions, STYLE_PRESETS, type StylePreset } from '@/lib/poster/defaults';
import { FORMAT_IDS, designHeight, getFormat } from '@/lib/poster/formats';
import { defaultFilename, downloadPoster } from '@/lib/poster/export';
import { extractPalette } from '@/lib/color/color';
import { loadCover } from '@/lib/poster/cover';
import { releaseYear } from '@/lib/utils/format';
import { cn } from '@/lib/utils/misc';
import { Seo } from '@/components/ui/Seo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PosterCanvas } from '@/components/poster/PosterCanvas';
import { AlbumSearch } from '@/components/search/AlbumSearch';
import { SegmentedControl, Toggle } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import '@/components/wizard/wizard.css';

type StepId = 'album' | 'style' | 'format' | 'details' | 'finish';

const STEPS: Array<{ id: StepId; key: string; icon: IconName }> = [
  { id: 'album', key: 'wizard.stepAlbum', icon: 'music' },
  { id: 'style', key: 'wizard.stepStyle', icon: 'palette' },
  { id: 'format', key: 'wizard.stepFormat', icon: 'frame' },
  { id: 'details', key: 'wizard.stepDetails', icon: 'list' },
  { id: 'finish', key: 'wizard.stepFinish', icon: 'checkCircle' },
];

/** Poster contents worth deciding up front; everything else lives in the editor. */
const DETAIL_TOGGLES = [
  { key: 'showTracklist', label: 'editor.showTracklist', icon: 'list' },
  { key: 'showTrackNumbers', label: 'editor.showTrackNumbers', icon: 'code' },
  { key: 'showReleaseDate', label: 'editor.showReleaseDate', icon: 'calendar' },
  { key: 'showDuration', label: 'editor.showDuration', icon: 'clock' },
  { key: 'showGenres', label: 'editor.showGenres', icon: 'tag' },
  { key: 'showScanCode', label: 'editor.showScanCode', icon: 'spotify' },
  { key: 'uppercaseTitle', label: 'editor.uppercaseTitle', icon: 'type' },
] as const satisfies ReadonlyArray<{ key: BooleanOptionKey; label: string; icon: IconName }>;

type BooleanOptionKey =
  | 'showTracklist'
  | 'showTrackNumbers'
  | 'showReleaseDate'
  | 'showDuration'
  | 'showGenres'
  | 'showScanCode'
  | 'uppercaseTitle';

/**
 * The wizard's one-tap download. Big enough to be usable straight away, small
 * enough to encode quickly — the editor's export panel is where the 300 DPI
 * print sizes live.
 */
const WIZARD_EXPORT_WIDTH = 2000;

const PALETTE_STYLE_LABELS: Record<PaletteStyle, string> = {
  bar: 'editor.styleBar',
  strip: 'editor.styleStrip',
  dots: 'editor.styleDots',
  none: 'editor.styleNone',
};

export default function WizardPage() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const labels = usePosterLabels();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { spec, album, options, hasAlbum, setAlbum, startDraft, setOption, applyPreset } =
    usePoster();

  const [step, setStep] = useState<StepId>('album');
  const [presetId, setPresetId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const index = STEPS.findIndex((item) => item.id === step);
  const stepNumber = index + 1;
  const isLast = index === STEPS.length - 1;
  const posterRatio = useMemo(() => designHeight(options.format) / 1000, [options.format]);

  /**
   * What a style card renders: the preset's own definition, plus the two
   * things a preview should still reflect — the palette sampled from this
   * album, and the format if the user has already been to that step.
   */
  const previewOptions = useCallback(
    (preset: StylePreset) =>
      presetPreviewOptions(preset, { palette: options.palette, format: options.format }),
    [options.palette, options.format],
  );

  // Move focus to the step heading on every change so the flow is followable
  // with a screen reader and the keyboard, but leave the initial load alone.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const go = useCallback((next: number) => {
    const target = STEPS[Math.min(Math.max(next, 0), STEPS.length - 1)];
    if (target) setStep(target.id);
  }, []);

  /**
   * Samples the artwork once, up front. Every mini preview then reads the same
   * palette from the store instead of each one re-reading the same pixels.
   */
  const samplePalette = useCallback(
    async (next: Album) => {
      const url = next.coverUrl ?? next.coverUrlHiRes;
      if (!url) return;
      try {
        const cover = await loadCover(url);
        setOption('palette', extractPalette(cover.image, { count: 6 }));
      } catch {
        // Keeps whatever palette is already set — the poster still renders.
      }
    },
    [setOption],
  );

  const handleSelect = useCallback(
    (next: Album) => {
      setAlbum(next);
      void samplePalette(next);
      go(1);
    },
    [setAlbum, samplePalette, go],
  );

  const handleManual = useCallback(() => {
    startDraft();
    go(1);
  }, [startDraft, go]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadPoster({
        spec,
        locale,
        labels,
        options: {
          format: 'png',
          width: WIZARD_EXPORT_WIDTH,
          quality: 1,
          filename: defaultFilename(spec, 'png'),
        },
      });
      notify(t('editor.downloadReady'), 'success');
    } catch (error) {
      console.error('[posterfy] wizard export failed', error);
      notify(t('errors.exportFailed'), 'error');
    } finally {
      setDownloading(false);
    }
  }, [spec, locale, labels, notify, t]);

  const canAdvance = step !== 'album' || hasAlbum;

  return (
    <>
      <Seo title={t('wizard.title')} description={t('wizard.subtitle')} />

      <div className="container container--wide wizard">
        <header className="wizard__head">
          <span className="badge page-header__eyebrow">
            <Icon name="wand" size={14} />
            {t('wizard.badge')}
          </span>
          <h1 className="page-header__title">{t('wizard.title')}</h1>
          <p className="page-header__subtitle">{t('wizard.subtitle')}</p>
        </header>

        <ol className="wizard__rail" aria-label={t('wizard.title')}>
          {STEPS.map((item, itemIndex) => {
            const state = itemIndex === index ? 'current' : itemIndex < index ? 'done' : 'todo';
            return (
              <li key={item.id} className={cn('wizard__rail-item', `is-${state}`)}>
                <button
                  type="button"
                  className="wizard__rail-btn"
                  // Only completed steps are navigable; jumping ahead would skip
                  // the album, which everything after it depends on.
                  disabled={itemIndex > index}
                  aria-current={itemIndex === index ? 'step' : undefined}
                  onClick={() => go(itemIndex)}
                >
                  <span className="wizard__rail-dot" aria-hidden="true">
                    {state === 'done' ? <Icon name="check" size={14} /> : itemIndex + 1}
                  </span>
                  <span className="wizard__rail-label">{t(item.key)}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={cn('wizard__body', step === 'album' && 'wizard__body--single')}>
          {step !== 'album' && (
            <aside className="wizard__preview-col" aria-label={t('common.preview')}>
              <div
                className="wizard__preview"
                style={{ '--poster-ratio': `1 / ${posterRatio}` } as CSSProperties}
              >
                <PosterCanvas spec={spec} />
              </div>
              <p className="wizard__preview-caption">
                {album.title || t('wizard.untitled')}
                {album.artist && ` · ${album.artist}`}
              </p>
            </aside>
          )}

          <section className="wizard__step" key={step}>
            <div className="wizard__step-head">
              <span className="wizard__step-count">
                {t('wizard.stepOf', { current: stepNumber, total: STEPS.length })}
              </span>
              <h2 className="wizard__step-title" tabIndex={-1} ref={headingRef}>
                {t(`wizard.${step}Title`)}
              </h2>
              <p className="wizard__step-body">{t(`wizard.${step}Body`)}</p>
            </div>

            {step === 'album' && (
              <div className="wizard__album">
                {hasAlbum && (
                  <div className="wizard__resume glass">
                    <Icon name="info" size={18} />
                    <span>{t('wizard.resume')}</span>
                    <Link to="/editor" className="btn btn--ghost btn--sm">
                      {t('wizard.resumeCta')}
                    </Link>
                  </div>
                )}

                <AlbumSearch onSelect={handleSelect} onManual={handleManual} autoFocus />
                <p className="field__hint wizard__center">{t('editor.searchHint')}</p>

                <div className="hstack-wrap">
                  <button type="button" className="btn btn--outline" onClick={handleManual}>
                    <Icon name="edit" size={16} />
                    {t('editor.emptyCta')}
                  </button>
                </div>
              </div>
            )}

            {step === 'style' && (
              <div className="wizard__cards">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      'wizard-card glass glass--interactive',
                      presetId === preset.id && 'is-selected',
                    )}
                    aria-pressed={presetId === preset.id}
                    onClick={() => {
                      applyPreset(preset);
                      setPresetId(preset.id);
                    }}
                  >
                    <span className="wizard-card__art">
                      <PosterCanvas
                        // Each card shows its own preset, not the preset laid
                        // over the current poster — otherwise selecting one
                        // repaints all six with whatever that one set.
                        spec={{ album, options: previewOptions(preset) }}
                        maxRenderWidth={420}
                        ariaLabel={preset.name}
                      />
                    </span>
                    <span className="wizard-card__text">
                      <span className="wizard-card__title">{preset.name}</span>
                      <span className="wizard-card__meta">{preset.description}</span>
                    </span>
                    {presetId === preset.id && (
                      <span className="wizard-card__check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {step === 'format' && (
              <div className="wizard__formats">
                {FORMAT_IDS.map((id: FormatId) => {
                  const format = getFormat(id);
                  const selected = options.format === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={cn(
                        'wizard-format glass glass--interactive',
                        selected && 'is-selected',
                      )}
                      aria-pressed={selected}
                      onClick={() => setOption('format', id)}
                    >
                      <span
                        className="wizard-format__shape"
                        aria-hidden="true"
                        style={{ aspectRatio: `1 / ${format.ratio}` }}
                      />
                      <span className="wizard-card__text">
                        <span className="wizard-card__title">{format.name}</span>
                        <span className="wizard-card__meta">{format.description}</span>
                        <span className="wizard-format__sizes">
                          {format.printSizes.join(' · ')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 'details' && (
              <div className="wizard__details">
                <div className="wizard__toggles">
                  {DETAIL_TOGGLES.map((item) => (
                    <Toggle
                      key={item.key}
                      icon={item.icon}
                      label={t(item.label)}
                      checked={options[item.key]}
                      onChange={(value) => setOption(item.key, value)}
                    />
                  ))}
                </div>

                <SegmentedControl
                  label={t('editor.paletteStyle')}
                  value={options.paletteStyle}
                  onChange={(value) => setOption('paletteStyle', value)}
                  options={(Object.keys(PALETTE_STYLE_LABELS) as PaletteStyle[]).map((style) => ({
                    value: style,
                    label: t(PALETTE_STYLE_LABELS[style]),
                  }))}
                />

                <Toggle
                  icon="droplet"
                  label={t('editor.autoColors')}
                  hint={t('editor.autoColorsHelp')}
                  checked={options.autoColors}
                  onChange={(value) => setOption('autoColors', value)}
                />
              </div>
            )}

            {step === 'finish' && (
              <div className="wizard__finish">
                <div className="wizard__summary glass">
                  <SummaryRow icon="music" label={t('wizard.stepAlbum')}>
                    {album.title || t('wizard.untitled')}
                    {album.releaseDate && ` · ${releaseYear(album.releaseDate)}`}
                  </SummaryRow>
                  <SummaryRow icon="palette" label={t('wizard.stepStyle')}>
                    {STYLE_PRESETS.find((preset) => preset.id === presetId)?.name ??
                      t('wizard.custom')}
                  </SummaryRow>
                  <SummaryRow icon="frame" label={t('wizard.stepFormat')}>
                    {getFormat(options.format).name}
                  </SummaryRow>
                  <SummaryRow icon="list" label={t('editor.sectionTracks')}>
                    {album.tracks.length > 0
                      ? t('editor.tracksCount', { count: album.tracks.length })
                      : '—'}
                  </SummaryRow>
                </div>

                <div className="wizard__finish-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--lg"
                    onClick={() => navigate('/editor')}
                  >
                    <Icon name="sliders" size={18} />
                    {t('wizard.toEditor')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--lg"
                    disabled={downloading}
                    onClick={() => void handleDownload()}
                  >
                    {downloading ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <Icon name="download" size={18} />
                    )}
                    {downloading ? t('editor.rendering') : t('wizard.downloadNow')}
                  </button>
                </div>
                <p className="field__hint wizard__center">{t('wizard.finishHint')}</p>
              </div>
            )}

            <nav className="wizard__nav" aria-label={t('wizard.title')}>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                <Icon name="chevronLeft" size={16} />
                {t('common.back')}
              </button>

              {!isLast && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!canAdvance}
                  onClick={() => go(index + 1)}
                >
                  {t('wizard.next')}
                  <Icon name="chevronRight" size={16} />
                </button>
              )}
            </nav>
          </section>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="wizard__summary-row">
      <Icon name={icon} size={16} />
      <span className="wizard__summary-label">{label}</span>
      <span className="wizard__summary-value">{children}</span>
    </div>
  );
}
