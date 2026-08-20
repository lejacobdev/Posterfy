import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useReveal } from '@/hooks/useReveal';
import { APP_VERSION, REPO_URL } from '@/lib/constants';
import { Seo } from '@/components/ui/Seo';
import { Icon, type IconName } from '@/components/ui/Icon';

const SECTIONS: Array<{ titleKey: string; bodyKey: string; icon: IconName }> = [
  { titleKey: 'about.storyTitle', bodyKey: 'about.storyBody', icon: 'heart' },
  { titleKey: 'about.techTitle', bodyKey: 'about.techBody', icon: 'code' },
  { titleKey: 'about.privacyTitle', bodyKey: 'about.privacyBody', icon: 'shield' },
  { titleKey: 'about.openSourceTitle', bodyKey: 'about.openSourceBody', icon: 'github' },
];

export default function AboutPage() {
  const { t } = useI18n();
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <>
      <Seo title={t('about.title')} description={t('about.subtitle')} />

      <div className="container container--narrow">
        <header className="page-header">
          <span className="badge page-header__eyebrow">
            <Icon name="info" size={14} />
            {t('nav.about')}
          </span>
          <h1 className="page-header__title">{t('about.title')}</h1>
          <p className="page-header__subtitle">{t('about.subtitle')}</p>
        </header>

        <div className="stack reveal" ref={revealRef} style={{ gap: 'var(--space-5)' }}>
          {SECTIONS.map((section) => (
            <section className="glass" key={section.titleKey} style={{ padding: 'var(--space-5)' }}>
              <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="feature-card__icon">
                  <Icon name={section.icon} size={20} />
                </span>
                <h2 style={{ fontSize: 'var(--text-xl)' }}>{t(section.titleKey)}</h2>
              </div>
              <p className="muted">{t(section.bodyKey)}</p>
            </section>
          ))}

          <section className="glass" style={{ padding: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>
              {t('about.contactTitle')}
            </h2>
            <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
              {t('about.contactBody')}
            </p>
            <div className="hstack-wrap" style={{ justifyContent: 'flex-start' }}>
              <a
                className="btn btn--outline"
                href={`${REPO_URL}/issues`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Icon name="github" size={16} />
                {t('footer.sourceCode')}
              </a>
              <Link to="/create" className="btn btn--primary">
                <Icon name="wand" size={16} />
                {t('home.ctaButton')}
              </Link>
            </div>
            <p className="subtle" style={{ marginTop: 'var(--space-4)' }}>
              {t('settings.version')} {APP_VERSION}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
