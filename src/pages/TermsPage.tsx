import { useI18n } from '@/i18n';
import { LEGAL_UPDATED } from '@/lib/constants';
import { Seo } from '@/components/ui/Seo';
import { Icon } from '@/components/ui/Icon';

interface LegalSection {
  heading: string;
  body: string;
}

export default function TermsPage() {
  const { t, list, locale } = useI18n();
  const sections = list<LegalSection>('legal.terms');
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    new Date(LEGAL_UPDATED),
  );

  return (
    <>
      <Seo title={t('legal.termsTitle')} description={t('footer.rights')} />

      <div className="container container--narrow">
        <header className="page-header">
          <span className="badge page-header__eyebrow">
            <Icon name="lock" size={14} />
            {t('nav.terms')}
          </span>
          <h1 className="page-header__title">{t('legal.termsTitle')}</h1>
          <p className="page-header__subtitle">
            {t('legal.updated')}: {updated}
          </p>
        </header>

        <div className="prose" style={{ paddingBottom: 'var(--space-8)' }}>
          {sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
