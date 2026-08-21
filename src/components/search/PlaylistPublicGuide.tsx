/**
 * A small, self-contained explainer for playlist import's one real
 * prerequisite: Spotify only serves playlist tracks to this app for
 * playlists set to public. Rather than a screen-recorded GIF (a real asset
 * to host and keep in sync with Spotify's own UI, which changes), this is a
 * simplified CSS mock of the two taps involved — good enough to show the
 * shape of the flow without pretending to be a pixel-accurate screenshot.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Icon } from '@/components/ui/Icon';
import './PlaylistPublicGuide.css';

export function PlaylistPublicGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="playlist-guide">
      <button
        type="button"
        className="playlist-guide__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="info" size={15} />
        <span>{t('editor.playlistPublicHint')}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={15} />
      </button>

      {open && (
        <div className="playlist-guide__panel">
          <div className="playlist-guide__mock" aria-hidden="true">
            <div className="pg-frame">
              <div className="pg-frame__header">
                <span className="pg-frame__cover" />
                <span className="pg-frame__lines">
                  <span className="pg-frame__line pg-frame__line--title" />
                  <span className="pg-frame__line pg-frame__line--sub" />
                </span>
                <span className="pg-frame__more">
                  <span />
                  <span />
                  <span />
                </span>
              </div>

              <div className="pg-frame__menu">
                <div className="pg-frame__menu-row">
                  <Icon name="globe" size={13} />
                  <span>{t('editor.playlistPublicMakePublic')}</span>
                  <span className="pg-toggle">
                    <span className="pg-toggle__knob" />
                  </span>
                </div>
                <div className="pg-frame__menu-row">
                  <Icon name="copy" size={13} />
                  <span>{t('editor.playlistPublicCopyLink')}</span>
                </div>
              </div>

              <span className="pg-frame__cursor">
                {/* A plain pointer-arrow silhouette — the shared icon set has
                    no mouse cursor, and this shape is only ever used here. */}
                <svg viewBox="0 0 16 16" width="15" height="15" className="pg-frame__cursor-icon">
                  <path
                    d="M2 1.2 13 8.4 8.1 9.3 10.4 14 8.2 15 5.9 10.3 2 13Z"
                    fill="currentColor"
                    stroke="var(--bg)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              <span className="pg-frame__toast">
                <Icon name="check" size={12} />
                {t('common.copied')}
              </span>
            </div>
          </div>

          <ol className="playlist-guide__steps">
            <li>{t('editor.playlistPublicStep1')}</li>
            <li>{t('editor.playlistPublicStep2')}</li>
            <li>{t('editor.playlistPublicStep3')}</li>
          </ol>
        </div>
      )}
    </div>
  );
}
