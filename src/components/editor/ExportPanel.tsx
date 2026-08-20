/** Export controls: file format, output size and the download/share actions. */

import { useMemo, useState } from 'react';
import type { ExportFormat } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useI18n, usePosterLabels } from '@/i18n';
import {
  canSharePoster,
  copyPosterToClipboard,
  defaultFilename,
  downloadPoster,
  EXPORT_PRESETS,
  exportWidthFor,
  renderPosterToBlob,
  sharePoster,
} from '@/lib/poster/export';
import { designHeight } from '@/lib/poster/formats';
import { formatBytes } from '@/lib/utils/misc';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { PanelSection, SegmentedControl, Slider } from '@/components/ui/Controls';

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

type Stage = 'idle' | 'loading' | 'rendering' | 'encoding';

export function ExportPanel() {
  const { t } = useI18n();
  const labels = usePosterLabels();
  const { locale } = useI18n();
  const { spec, hasAlbum } = usePoster();
  const { notify } = useToast();

  const [format, setFormat] = useState<ExportFormat>('png');
  const [presetId, setPresetId] = useState('print');
  const [quality, setQuality] = useState(0.92);
  const [stage, setStage] = useState<Stage>('idle');
  const [lastSize, setLastSize] = useState<number | null>(null);

  const width = useMemo(() => exportWidthFor(spec, presetId), [spec, presetId]);
  const height = Math.round(width * (designHeight(spec.options.format) / 1000));
  const busy = stage !== 'idle';
  const shareSupported = canSharePoster();

  const stageLabel: Record<Stage, string> = {
    idle: t('editor.downloadPoster'),
    loading: t('editor.preparingAssets'),
    rendering: t('editor.rendering'),
    encoding: t('editor.encoding'),
  };

  const buildArgs = () => ({
    spec,
    locale,
    labels,
    options: {
      format,
      width,
      quality,
      filename: defaultFilename(spec, format),
    },
    onProgress: (next: 'loading' | 'rendering' | 'encoding') => setStage(next),
  });

  const handleDownload = async () => {
    setStage('loading');
    try {
      const blob = await downloadPoster(buildArgs());
      setLastSize(blob.size);
      notify(t('editor.downloadReady'), 'success');
    } catch (error) {
      console.error('[posterfy] export failed', error);
      notify(t('errors.exportFailed'), 'error');
    } finally {
      setStage('idle');
    }
  };

  const handleShare = async () => {
    setStage('loading');
    try {
      const blob = await renderPosterToBlob(buildArgs());
      const filename = defaultFilename(spec, format);
      const shared = await sharePoster(blob, filename, spec.album.title || 'Poster');
      if (!shared) notify(t('errors.exportFailed'), 'error');
    } catch {
      notify(t('errors.exportFailed'), 'error');
    } finally {
      setStage('idle');
    }
  };

  const handleCopy = async () => {
    setStage('loading');
    try {
      // Clipboard images must be PNG in every current browser.
      const blob = await renderPosterToBlob({
        ...buildArgs(),
        options: { format: 'png', width, quality: 1, filename: 'poster.png' },
      });
      const copied = await copyPosterToClipboard(blob);
      notify(
        copied ? t('editor.copiedToClipboard') : t('errors.exportFailed'),
        copied ? 'success' : 'error',
      );
    } catch {
      notify(t('errors.exportFailed'), 'error');
    } finally {
      setStage('idle');
    }
  };

  return (
    <div className="editor-panel">
      <PanelSection title={t('editor.exportSize')} icon="printer">
        <div className="export-sizes">
          {EXPORT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`export-size ${presetId === preset.id ? 'is-active' : ''}`}
              aria-pressed={presetId === preset.id}
              onClick={() => setPresetId(preset.id)}
            >
              <span className="export-size__name">{preset.name}</span>
              <span className="export-size__desc">{preset.description}</span>
            </button>
          ))}
        </div>
        <p className="field__hint">
          {t('editor.exportPixels')}:{' '}
          <strong>
            {width.toLocaleString()} × {height.toLocaleString()} px
          </strong>
          {lastSize !== null && ` · ${formatBytes(lastSize)}`}
        </p>
      </PanelSection>

      <PanelSection title={t('editor.exportFormat')} icon="image">
        <SegmentedControl<ExportFormat>
          label={t('editor.exportFormat')}
          value={format}
          options={FORMATS}
          onChange={setFormat}
        />
        {format !== 'png' && (
          <Slider
            label={t('editor.exportQuality')}
            value={quality}
            min={0.6}
            max={1}
            step={0.01}
            onChange={setQuality}
            format={(value) => `${Math.round(value * 100)}%`}
          />
        )}
      </PanelSection>

      <div className="export-actions">
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={busy || !hasAlbum}
          onClick={() => void handleDownload()}
        >
          {busy ? <span className="spinner" /> : <Icon name="download" size={18} />}
          {stageLabel[stage]}
        </button>

        <div className="export-actions__row">
          {shareSupported && (
            <button
              type="button"
              className="btn btn--outline"
              disabled={busy || !hasAlbum}
              onClick={() => void handleShare()}
            >
              <Icon name="share" size={16} />
              {t('editor.sharePoster')}
            </button>
          )}
          <button
            type="button"
            className="btn btn--outline"
            disabled={busy || !hasAlbum}
            onClick={() => void handleCopy()}
          >
            <Icon name="copy" size={16} />
            {t('editor.copyImage')}
          </button>
        </div>
      </div>
    </div>
  );
}
