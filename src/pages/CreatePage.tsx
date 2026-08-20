/**
 * The editor.
 *
 * Desktop: preview on the left, control panel on the right, both sticky.
 * Mobile: preview pinned above a tabbed control stack with a persistent
 * download bar, so every control is reachable with one thumb.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Album } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { releaseYear } from '@/lib/utils/format';
import { cn } from '@/lib/utils/misc';
import { Seo } from '@/components/ui/Seo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PosterCanvas } from '@/components/poster/PosterCanvas';
import { AlbumSearch } from '@/components/search/AlbumSearch';
import { DesignPanel } from '@/components/editor/DesignPanel';
import { ContentPanel } from '@/components/editor/ContentPanel';
import { ExportPanel } from '@/components/editor/ExportPanel';
import '@/components/editor/editor.css';

type TabId = 'album' | 'design' | 'content' | 'export';

const TABS: Array<{ id: TabId; key: string; icon: IconName }> = [
  { id: 'album', key: 'editor.tabAlbum', icon: 'music' },
  { id: 'design', key: 'editor.tabDesign', icon: 'palette' },
  { id: 'content', key: 'editor.tabContent', icon: 'list' },
  { id: 'export', key: 'editor.tabExport', icon: 'download' },
];

export default function CreatePage() {
  const { t } = useI18n();
  const {
    spec,
    album,
    hasAlbum,
    setAlbum,
    startDraft,
    setOption,
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
  } = usePoster();
  const [tab, setTab] = useState<TabId>('design');

  // Keyboard shortcuts for undo/redo, the way a design tool should behave.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const handleSelect = useCallback(
    (next: Album) => {
      setAlbum(next);
      setTab('design');
    },
    [setAlbum],
  );

  const handlePalette = useCallback(
    (palette: string[]) => {
      setOption('palette', palette);
    },
    [setOption],
  );

  return (
    <>
      <Seo title={t('editor.title')} description={t('home.subtitle')} />

      <div className="container container--wide">
        {!hasAlbum ? (
          <EmptyState onSelect={handleSelect} onManual={startDraft} />
        ) : (
          <div className="editor">
            <section className="editor__stage" aria-label={t('common.preview')}>
              <div className="editor__preview-wrap">
                <div className="editor__preview">
                  <PosterCanvas spec={spec} onPalette={handlePalette} />
                </div>
              </div>

              <div className="editor__stage-bar">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!canUndo}
                  onClick={undo}
                >
                  <Icon name="undo" size={15} />
                  {t('editor.undo')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!canRedo}
                  onClick={redo}
                >
                  <Icon name="redo" size={15} />
                  {t('editor.redo')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    if (window.confirm(t('editor.resetConfirm'))) reset();
                  }}
                >
                  <Icon name="refresh" size={15} />
                  {t('editor.resetAll')}
                </button>
              </div>
              <p className="editor__hint">{t('editor.previewNote')}</p>
            </section>

            <aside className="editor__sidebar glass" aria-label={t('editor.title')}>
              <div className="editor__tabs" role="tablist">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={cn('editor__tab', tab === item.id && 'is-active')}
                    onClick={() => setTab(item.id)}
                  >
                    <Icon name={item.icon} size={16} />
                    <span>{t(item.key)}</span>
                  </button>
                ))}
              </div>

              <div className="editor__panel-scroll">
                {tab === 'album' && (
                  <div
                    className="editor-panel"
                    style={{ gap: 'var(--space-4)', padding: 'var(--space-4) 0' }}
                  >
                    <AlbumSearch onSelect={handleSelect} />
                    <div className="album-card glass">
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt="" className="album-card__art" />
                      ) : (
                        <span className="album-card__art" />
                      )}
                      <span className="album-card__text">
                        <span className="album-card__title">{album.title || '—'}</span>
                        <span className="album-card__meta">
                          {album.artist}
                          {album.releaseDate && ` · ${releaseYear(album.releaseDate)}`}
                          {album.tracks.length > 0 &&
                            ` · ${t('editor.tracksCount', { count: album.tracks.length })}`}
                        </span>
                      </span>
                    </div>
                    {album.externalUrl && (
                      <a
                        className="btn btn--outline btn--sm"
                        href={album.externalUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <Icon name="externalLink" size={15} />
                        {album.source === 'spotify' ? 'Spotify' : 'MusicBrainz'}
                      </a>
                    )}
                  </div>
                )}
                {tab === 'design' && <DesignPanel />}
                {tab === 'content' && <ContentPanel />}
                {tab === 'export' && <ExportPanel />}
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState({
  onSelect,
  onManual,
}: {
  onSelect: (album: Album) => void;
  onManual: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="section" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="section-head">
        <span className="eyebrow">{t('editor.title')}</span>
        <h1 className="page-header__title">{t('editor.emptyTitle')}</h1>
        <p className="lead" style={{ textAlign: 'center' }}>
          {t('editor.emptyBody')}
        </p>
      </div>

      <AlbumSearch onSelect={onSelect} onManual={onManual} autoFocus />

      <p className="field__hint" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
        {t('editor.searchHint')}
      </p>

      <div className="hstack-wrap" style={{ marginTop: 'var(--space-5)' }}>
        <button type="button" className="btn btn--outline" onClick={onManual}>
          <Icon name="edit" size={16} />
          {t('editor.emptyCta')}
        </button>
      </div>
    </div>
  );
}
