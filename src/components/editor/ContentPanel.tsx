/** Content controls: artwork, text overrides, visible elements and tracklist. */

import { useRef, useState } from 'react';
import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { isSupportedImage, MAX_UPLOAD_BYTES, readFileAsDataUrl } from '@/lib/poster/cover';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { PanelSection, SegmentedControl, TextField, Toggle } from '@/components/ui/Controls';
import { TracklistEditor } from './TracklistEditor';

export function ContentPanel() {
  const { t } = useI18n();
  const { album, options, setOption, setCover } = usePoster();
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedImage(file)) {
      notify(t('errors.uploadUnsupported'), 'error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify(t('errors.uploadTooLarge'), 'error');
      return;
    }
    try {
      // Data URLs keep the canvas untainted, so exports keep working.
      setCover(await readFileAsDataUrl(file));
    } catch {
      notify(t('common.error'), 'error');
    }
  };

  return (
    <div className="editor-panel">
      <PanelSection title={t('editor.sectionArtwork')} icon="image">
        <div
          className={`dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files[0]);
          }}
        >
          {album.coverUrl ? (
            <img src={album.coverUrl} alt="" className="dropzone__preview" />
          ) : (
            <Icon name="image" size={28} className="dropzone__icon" />
          )}
          <div className="dropzone__actions">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="upload" size={15} />
              {t('editor.uploadCover')}
            </button>
            {album.coverUrl && (
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--danger"
                onClick={() => setCover(null)}
              >
                <Icon name="trash" size={15} />
                {t('editor.removeCover')}
              </button>
            )}
          </div>
          <p className="field__hint">{t('editor.uploadHint')}</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="visually-hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>

        <Toggle
          checked={options.showCoverBorder}
          onChange={(value) => setOption('showCoverBorder', value)}
          label={t('editor.showCoverBorder')}
          icon="frame"
        />
      </PanelSection>

      <PanelSection title={t('editor.sectionDetails')} icon="type">
        <TextField
          label={t('editor.titleOverride')}
          value={options.titleOverride}
          placeholder={album.title || '—'}
          maxLength={90}
          onChange={(value) => setOption('titleOverride', value)}
        />
        <TextField
          label={t('editor.artistOverride')}
          value={options.artistOverride}
          placeholder={album.artist || '—'}
          maxLength={60}
          onChange={(value) => setOption('artistOverride', value)}
        />
        <TextField
          label={t('editor.customNote')}
          value={options.customNote}
          placeholder={t('editor.customNotePlaceholder')}
          maxLength={80}
          onChange={(value) => setOption('customNote', value)}
        />
      </PanelSection>

      <PanelSection title={t('editor.sectionElements')} icon="eye">
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
            setOption('tracklistColumns', value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3))
          }
        />
        <hr className="divider" />
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
        <Toggle
          checked={options.showScanCode}
          onChange={(value) => setOption('showScanCode', value)}
          label={t('editor.showScanCode')}
          icon="spotify"
        />
      </PanelSection>

      <PanelSection
        title={t('editor.sectionTracks')}
        icon="list"
        defaultOpen={false}
        badge={t('editor.tracksCount', { count: album.tracks.length })}
      >
        <TracklistEditor />
      </PanelSection>
    </div>
  );
}
