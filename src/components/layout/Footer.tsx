import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { Icon } from '@/components/ui/Icon';
import { Logo } from './Logo';
import { APP_VERSION, REPO_URL } from '@/lib/constants';
import './Footer.css';

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container container--wide site-footer__inner">
        <div className="site-footer__brand">
          <Link to="/" className="site-footer__logo">
            <Logo size={26} />
            <span>Posterfy</span>
          </Link>
          <p className="site-footer__tagline">{t('footer.tagline')}</p>
          <p className="subtle">{t('footer.builtWith')}</p>
        </div>

        <nav className="site-footer__col" aria-label={t('footer.product')}>
          <h2 className="site-footer__heading">{t('footer.product')}</h2>
          <Link to="/create">{t('nav.create')}</Link>
          <Link to="/gallery">{t('nav.gallery')}</Link>
          <Link to="/settings">{t('nav.settings')}</Link>
        </nav>

        <nav className="site-footer__col" aria-label={t('footer.resources')}>
          <h2 className="site-footer__heading">{t('footer.resources')}</h2>
          <Link to="/faq">{t('nav.faq')}</Link>
          <Link to="/about">{t('nav.about')}</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="row">
            {t('footer.sourceCode')}
            <Icon name="externalLink" size={13} />
          </a>
        </nav>

        <nav className="site-footer__col" aria-label={t('footer.legal')}>
          <h2 className="site-footer__heading">{t('footer.legal')}</h2>
          <Link to="/privacy">{t('nav.privacy')}</Link>
          <Link to="/terms">{t('nav.terms')}</Link>
        </nav>
      </div>

      <div className="container container--wide site-footer__bottom">
        <p className="subtle">
          © {year} Posterfy · v{APP_VERSION}
        </p>
        <p className="subtle site-footer__disclaimer">
          {t('footer.rights')} {t('footer.notAffiliated')}
        </p>
      </div>
    </footer>
  );
}
