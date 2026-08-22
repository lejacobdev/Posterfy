/**
 * Cover artwork controls: upload a custom image to override the album's own
 * cover, or remove the override to fall back to it. Shared by Content (Easy
 * mode) and Advanced mode's per-element panel — the same edit either way.
 */

import { useRef, useState } from 'react';
import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { isSupportedImage, MAX_UPLOAD_BYTES, readFileAsDataUrl } from '@/lib/poster/cover';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Controls';

export function ArtworkField() {
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
    <>
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
    </>
  );
}
