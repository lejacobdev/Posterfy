import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { Seo } from '@/components/ui/Seo';
import { Icon } from '@/components/ui/Icon';

export default function NotFoundPage() {
  const { t } = useI18n();

  return (
    <>
      <Seo title={t('errors.notFoundTitle')} description={t('errors.notFoundBody')} noindex />

      <div className="container container--narrow section">
        <div className="empty-state glass">
          <span className="empty-state__icon">
            <Icon name="search" size={28} />
          </span>
          <p className="eyebrow">404</p>
          <h1 className="page-header__title">{t('errors.notFoundTitle')}</h1>
          <p className="lead" style={{ textAlign: 'center' }}>
            {t('errors.notFoundBody')}
          </p>
          <div className="hstack-wrap">
            <Link to="/create" className="btn btn--primary btn--lg">
              <Icon name="wand" size={18} />
              {t('errors.notFoundCta')}
            </Link>
            <Link to="/" className="btn btn--outline btn--lg">
              <Icon name="arrowRight" size={18} />
              {t('nav.home')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
