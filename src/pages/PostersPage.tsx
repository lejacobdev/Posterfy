/**
 * My Posters — every album/playlist the user has posterised, picked up
 * exactly where they left it: same template, same colours, same overrides.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { usePoster } from '@/lib/store/poster';
import { listRecent, removeRecent, type RecentPoster } from '@/lib/store/recent';
import { thumbnailUrl } from '@/lib/poster/cover';
import { formatRelativeTime } from '@/lib/utils/format';
import { Seo } from '@/components/ui/Seo';
import { Icon } from '@/components/ui/Icon';
import './PostersPage.css';

export default function PostersPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { load } = usePoster();
  const [posters, setPosters] = useState<RecentPoster[]>(() => listRecent());

  const open = useCallback(
    (entry: RecentPoster) => {
      load(entry.spec);
      navigate('/editor');
    },
    [load, navigate],
  );

  const remove = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.stopPropagation();
      if (!window.confirm(t('posters.removeConfirm'))) return;
      removeRecent(id);
      setPosters(listRecent());
    },
    [t],
  );

  return (
    <>
      <Seo title={t('posters.title')} description={t('posters.subtitle')} />

      <div className="container container--wide">
        <header className="page-header">
          <span className="badge page-header__eyebrow">
            <Icon name="layers" size={14} />
            {t('nav.myPosters')}
          </span>
          <h1 className="page-header__title">{t('posters.title')}</h1>
          <p className="page-header__subtitle">{t('posters.subtitle')}</p>
        </header>

        {posters.length === 0 ? (
          <div className="posters-empty">
            <Icon name="layers" size={32} />
            <p className="posters-empty__title">{t('posters.empty')}</p>
            <p className="posters-empty__hint">{t('posters.emptyHint')}</p>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/editor')}>
              <Icon name="sparkles" size={16} />
              {t('posters.emptyCta')}
            </button>
          </div>
        ) : (
          <div className="posters-grid">
            {posters.map((entry) => (
              <article
                key={entry.id}
                className="poster-card"
                role="button"
                tabIndex={0}
                onClick={() => open(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') open(entry);
                }}
              >
                <span className="poster-card__art">
                  {entry.coverUrl ? (
                    <img src={thumbnailUrl(entry.coverUrl)} alt="" width={64} height={64} />
                  ) : (
                    <Icon name={entry.kind === 'playlist' ? 'list' : 'disc'} size={22} />
                  )}
                </span>
                <span className="poster-card__body">
                  <span className="poster-card__title">{entry.title || '—'}</span>
                  <span className="poster-card__meta">
                    {entry.artist}
                    {' · '}
                    {entry.kind === 'playlist' ? t('posters.kindPlaylist') : t('posters.kindAlbum')}
                  </span>
                  <span className="poster-card__time">
                    {formatRelativeTime(entry.updatedAt, locale)}
                  </span>
                </span>
                <button
                  type="button"
                  className="poster-card__remove"
                  aria-label={t('posters.remove')}
                  onClick={(event) => remove(event, entry.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
