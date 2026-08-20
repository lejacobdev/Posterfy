import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStaggeredReveal } from '@/hooks/useReveal';
import { Seo } from '@/components/ui/Seo';
import { Icon } from '@/components/ui/Icon';

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqPage() {
  const { t, list } = useI18n();
  const items = list<FaqItem>('faq.items');
  const listRef = useStaggeredReveal<HTMLDivElement>(50);

  return (
    <>
      <Seo title={t('faq.title')} description={t('faq.subtitle')} />

      {/* Structured data so the answers can surface directly in search. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />

      <div className="container container--narrow">
        <header className="page-header">
          <span className="badge page-header__eyebrow">
            <Icon name="info" size={14} />
            {t('nav.faq')}
          </span>
          <h1 className="page-header__title">{t('faq.title')}</h1>
          <p className="page-header__subtitle">{t('faq.subtitle')}</p>
        </header>

        <div className="accordion reveal" ref={listRef}>
          {items.map((item, index) => (
            <details className="accordion__item glass reveal" key={item.q} open={index === 0}>
              <summary className="accordion__summary">
                {item.q}
                <Icon name="plus" size={18} className="accordion__marker" />
              </summary>
              <div className="accordion__body">{item.a}</div>
            </details>
          ))}
        </div>

        <div className="cta-banner glass" style={{ marginBlock: 'var(--space-7)' }}>
          <h2 className="section-title">{t('home.ctaTitle')}</h2>
          <Link to="/create" className="btn btn--primary btn--lg">
            <Icon name="sparkles" size={18} />
            {t('home.ctaButton')}
          </Link>
        </div>
      </div>
    </>
  );
}
