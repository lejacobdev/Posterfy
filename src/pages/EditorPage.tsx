/**
 * The editor.
 *
 * Desktop: preview on the left, control panel on the right, both sticky.
 * Mobile: preview pinned above a tabbed control stack with a persistent
 * download bar, so every control is reachable with one thumb.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Album, ElementId, LayoutBox } from '@/lib/types';
import { usePoster } from '@/lib/store/poster';
import { useSettings, type EditorMode } from '@/lib/store/settings';
import { listRecent, type RecentPoster } from '@/lib/store/recent';
import { designHeight } from '@/lib/poster/formats';
import { useI18n } from '@/i18n';
import { releaseYear, formatRelativeTime } from '@/lib/utils/format';
import { thumbnailUrl } from '@/lib/poster/cover';
import { cn } from '@/lib/utils/misc';
import { Seo } from '@/components/ui/Seo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PanelSection, SegmentedControl } from '@/components/ui/Controls';
import { PosterCanvas } from '@/components/poster/PosterCanvas';
import { AlbumSearch } from '@/components/search/AlbumSearch';
import { DesignPanel } from '@/components/editor/DesignPanel';
import { ContentPanel } from '@/components/editor/ContentPanel';
import { ExportPanel } from '@/components/editor/ExportPanel';
import { AdvancedPanel } from '@/components/editor/AdvancedPanel';
import { elementLabel } from '@/components/editor/elementLabels';
import { LayoutOverlay, type EditableText } from '@/components/editor/LayoutOverlay';
import '@/components/editor/editor.css';

type TabId = 'album' | 'design' | 'content' | 'export';

const TABS: Array<{ id: TabId; key: string; icon: IconName }> = [
  { id: 'album', key: 'editor.tabAlbum', icon: 'music' },
  { id: 'design', key: 'editor.tabDesign', icon: 'palette' },
  { id: 'content', key: 'editor.tabContent', icon: 'list' },
  { id: 'export', key: 'editor.tabExport', icon: 'download' },
];

export default function EditorPage() {
  const { t } = useI18n();
  const {
    spec,
    album,
    hasAlbum,
    setAlbum,
    startDraft,
    setOption,
    setLayoutOverride,
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
  } = usePoster();
  const { editorMode, setEditorMode } = useSettings();
  const [tab, setTab] = useState<TabId>('design');
  const [layout, setLayout] = useState<Map<ElementId, LayoutBox>>(new Map());
  const [selectedElement, setSelectedElement] = useState<ElementId | null>(null);
  const posterRatio = useMemo(
    () => designHeight(spec.options.format) / 1000,
    [spec.options.format],
  );

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
      if (editorMode === 'easy') setTab('design');
    },
    [setAlbum, editorMode],
  );

  const handlePalette = useCallback(
    (palette: string[]) => {
      setOption('palette', palette);
    },
    [setOption],
  );

  const handleLayout = useCallback((next: Map<ElementId, LayoutBox>) => {
    setLayout(next);
  }, []);

  // Elements with a free-text option behind them can be typed into directly
  // on the canvas in Advanced mode, PowerPoint-style, instead of only
  // through Content's (now hidden) text fields.
  const editableText = useMemo<Partial<Record<ElementId, EditableText>>>(() => {
    const map: Partial<Record<ElementId, EditableText>> = {};
    if (layout.has('title')) {
      map.title = { value: spec.options.titleOverride, placeholder: album.title || '' };
    }
    if (layout.has('artist')) {
      map.artist = { value: spec.options.artistOverride, placeholder: album.artist || '' };
    }
    if (layout.has('customNote')) {
      map.customNote = {
        value: spec.options.customNote,
        placeholder: t('editor.customNotePlaceholder'),
      };
    }
    return map;
  }, [
    layout,
    spec.options.titleOverride,
    spec.options.artistOverride,
    spec.options.customNote,
    album.title,
    album.artist,
    t,
  ]);

  const handleTextChange = useCallback(
    (id: ElementId, value: string) => {
      if (id === 'title') setOption('titleOverride', value);
      else if (id === 'artist') setOption('artistOverride', value);
      else if (id === 'customNote') setOption('customNote', value);
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
                <div
                  className="editor__preview"
                  // Gives the box a definite width from its height, so the
                  // canvas never has to size itself from its own content.
                  style={{ '--poster-ratio': `1 / ${posterRatio}` } as CSSProperties}
                >
                  <PosterCanvas
                    spec={spec}
                    onPalette={handlePalette}
                    onLayout={handleLayout}
                    overlay={
                      editorMode === 'advanced' ? (
                        <LayoutOverlay
                          layout={layout}
                          overrides={spec.options.layoutOverrides}
                          format={spec.options.format}
                          selected={selectedElement}
                          onSelect={setSelectedElement}
                          onChange={setLayoutOverride}
                          labelFor={(id) => elementLabel(t, id)}
                          editableText={editableText}
                          onTextChange={handleTextChange}
                        />
                      ) : undefined
                    }
                  />
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
              <div className="editor__mode-toggle">
                <SegmentedControl<EditorMode>
                  label={t('editor.modeLabel')}
                  value={editorMode}
                  options={[
                    { value: 'easy', label: t('editor.modeEasy'), icon: 'wand' },
                    { value: 'advanced', label: t('editor.modeAdvanced'), icon: 'sliders' },
                  ]}
                  onChange={setEditorMode}
                />
              </div>

              {editorMode === 'easy' && (
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
              )}

              <div className="editor__panel-scroll">
                {editorMode === 'advanced' ? (
                  <>
                    <div className="editor-panel">
                      <PanelSection title={t('editor.tabAlbum')} icon="music" defaultOpen={false}>
                        <AlbumSummary album={album} onSelect={handleSelect} />
                      </PanelSection>
                    </div>

                    <AdvancedPanel
                      layout={layout}
                      selected={selectedElement}
                      onSelect={setSelectedElement}
                    />

                    <div className="editor-panel">
                      <PanelSection
                        title={t('editor.tabExport')}
                        icon="download"
                        defaultOpen={false}
                      >
                        <ExportPanel />
                      </PanelSection>
                    </div>
                  </>
                ) : (
                  <>
                    {tab === 'album' && (
                      <div
                        className="editor-panel"
                        style={{ gap: 'var(--space-4)', padding: 'var(--space-4) 0' }}
                      >
                        <AlbumSummary album={album} onSelect={handleSelect} />
                      </div>
                    )}
                    {tab === 'design' && <DesignPanel />}
                    {tab === 'content' && <ContentPanel />}
                    {tab === 'export' && <ExportPanel />}
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

/** The album search plus a summary of whatever's currently loaded — shared by Easy mode's Album tab and Advanced mode's collapsed Album section. */
function AlbumSummary({ album, onSelect }: { album: Album; onSelect: (album: Album) => void }) {
  const { t } = useI18n();
  return (
    <>
      <AlbumSearch onSelect={onSelect} />
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
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { load } = usePoster();
  // Read once on mount: this page only shows while there is no active poster,
  // so nothing here changes the list while it is visible.
  const [recent] = useState<RecentPoster[]>(() => listRecent().slice(0, 4));

  const openRecent = useCallback(
    (entry: RecentPoster) => {
      load(entry.spec);
      navigate('/editor');
    },
    [load, navigate],
  );

  return (
    <div className="section" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="section-head">
        <span className="eyebrow">{t('editor.title')}</span>
        <h1 className="page-header__title">{t('editor.emptyTitle')}</h1>
        <p className="lead" style={{ textAlign: 'center' }}>
          {t('editor.emptyBody')}
        </p>
      </div>

      {recent.length > 0 && (
        <div className="editor-empty__recent">
          <div className="editor-empty__recent-head">
            <span>{t('posters.recentTitle')}</span>
            <Link to="/posters">{t('posters.seeAll')}</Link>
          </div>
          <div className="editor-empty__recent-list">
            {recent.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="editor-empty__recent-card"
                onClick={() => openRecent(entry)}
              >
                <span className="editor-empty__recent-art">
                  {entry.coverUrl ? (
                    <img src={thumbnailUrl(entry.coverUrl)} alt="" width={40} height={40} />
                  ) : (
                    <Icon name={entry.kind === 'playlist' ? 'list' : 'disc'} size={16} />
                  )}
                </span>
                <span className="editor-empty__recent-text">
                  <span className="editor-empty__recent-title">{entry.title || '—'}</span>
                  <span className="editor-empty__recent-time">
                    {formatRelativeTime(entry.updatedAt, locale)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AlbumSearch onSelect={onSelect} onManual={onManual} autoFocus />

      <p className="field__hint" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
        {t('editor.searchHint')}
      </p>

      <div className="hstack-wrap" style={{ marginTop: 'var(--space-5)' }}>
        <Link to="/create" className="btn btn--primary">
          <Icon name="wand" size={16} />
          {t('wizard.openWizard')}
        </Link>
        <button type="button" className="btn btn--outline" onClick={onManual}>
          <Icon name="edit" size={16} />
          {t('editor.emptyCta')}
        </button>
      </div>
    </div>
  );
}
