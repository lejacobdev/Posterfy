import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useReveal, useStaggeredReveal } from '@/hooks/useReveal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { revealSegments, useTypewriterTagline } from '@/hooks/useTypewriter';
import { DEMO_ALBUMS, demoAlbum } from '@/lib/demo/demoAlbums';
import { DEFAULT_OPTIONS, STYLE_PRESETS, TEMPLATE_META } from '@/lib/poster/defaults';
import type { PosterSpec, TemplateId } from '@/lib/types';
import { Seo } from '@/components/ui/Seo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PosterCanvas } from '@/components/poster/PosterCanvas';
import { PosterStack, VinylScene } from '@/components/three/VinylScene';
import './HomePage.css';

const FEATURE_ICONS: IconName[] = [
  'search',
  'layout',
  'palette',
  'printer',
  'smartphone',
  'shield',
];

interface FeatureCopy {
  title: string;
  body: string;
}

interface Tagline {
  lead: string;
  accent: string;
}

export default function HomePage() {
  const { t, list } = useI18n();
  const features = list<FeatureCopy>('home.features');
  const steps = list<FeatureCopy>('home.steps');
  const taglines = list<Tagline>('home.taglines');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Rotates the hero headline through a handful of pitches with an
  // old-school typewriter delete/retype effect instead of always showing
  // the same one. Paused for reduced-motion, same as any other
  // auto-advancing content on the page.
  const { tagline, count, showCaret } = useTypewriterTagline(taglines, {
    enabled: !prefersReducedMotion,
  });
  const { leadRevealed, leadHidden, accentRevealed, accentHidden, caretAt } = useMemo(
    () => revealSegments(tagline, count),
    [tagline, count],
  );

  const featuresRef = useStaggeredReveal<HTMLDivElement>(70);
  const stepsRef = useStaggeredReveal<HTMLOListElement>(90);
  const templatesRef = useStaggeredReveal<HTMLDivElement>(60);
  const ctaRef = useReveal<HTMLDivElement>();
  const featuresHeadRef = useReveal<HTMLDivElement>();
  const showcaseHeadRef = useReveal<HTMLDivElement>();
  const stepsHeadRef = useReveal<HTMLDivElement>();
  const templatesHeadRef = useReveal<HTMLDivElement>();

  // Three demo posters for the hero stack, each in a different style.
  // PosterStack positions purely by array order (left, middle, right), so
  // swapping which poster reads as left vs. middle is just a reorder here.
  const heroSpecs = useMemo<PosterSpec[]>(
    () =>
      [
        { album: 1, preset: 5 },
        { album: 0, preset: 0 },
        { album: 2, preset: 1 },
      ].map(({ album, preset }) => ({
        album: demoAlbum(album),
        options: {
          ...DEFAULT_OPTIONS,
          ...(STYLE_PRESETS[preset]?.options ?? {}),
          palette: [],
          grain: 0.1,
        },
      })),
    [],
  );

  const templateSpecs = useMemo<Array<{ id: TemplateId; name: string; spec: PosterSpec }>>(
    () =>
      TEMPLATE_META.map((template, index) => ({
        id: template.id,
        name: template.name,
        spec: {
          album: demoAlbum(index),
          options: { ...DEFAULT_OPTIONS, template: template.id, palette: [], autoColors: true },
        },
      })),
    [],
  );

  return (
    <>
      <Seo
        title="Posterfy — Turn any album into a print-ready poster"
        description={t('home.subtitle')}
        path="/"
      />

      {/* Hero ------------------------------------------------------------ */}
      <section className="hero">
        <div className="grid-backdrop" aria-hidden="true" />
        <div className="container container--wide hero__inner">
          <div className="hero__copy animate-fade-up">
            <span className="badge hero__badge">
              <Icon name="sparkles" size={14} />
              {t('home.badge')}
            </span>
            <div className="hero__title-frame">
              {/* Invisible: every tagline stacked in the same grid cell, so
                  this box is always exactly as tall as the longest one —
                  the live headline below never resizes it, so nothing below
                  the hero title shifts as shorter/longer lines type in. */}
              <div className="hero__title-sizer" aria-hidden="true">
                {taglines.map((item, itemIndex) => (
                  <span key={itemIndex} className="hero__title hero__title-sizer-line">
                    {item.lead} <span className="gradient-text">{item.accent}</span>
                  </span>
                ))}
              </div>
              <h1 className="hero__title hero__title-live">
                <span className="hero__title-line">
                  {leadRevealed}
                  {caretAt === 'lead' && showCaret && (
                    <span className="hero__caret" aria-hidden="true" />
                  )}
                  <span className="hero__hidden">{leadHidden}</span>{' '}
                  {caretAt === 'space' && showCaret && (
                    <span className="hero__caret" aria-hidden="true" />
                  )}
                  <span className="gradient-text">
                    {accentRevealed}
                    {caretAt === 'accent' && showCaret && (
                      <span className="hero__caret" aria-hidden="true" />
                    )}
                    <span className="hero__hidden">{accentHidden}</span>
                  </span>
                </span>
              </h1>
            </div>
            <p className="lead hero__subtitle">{t('home.subtitle')}</p>

            <div className="hero__actions">
              <Link to="/create" className="btn btn--primary btn--lg">
                <Icon name="wand" size={18} />
                {t('home.ctaCreate')}
              </Link>
              <Link to="/gallery" className="btn btn--outline btn--lg">
                <Icon name="grid" size={18} />
                {t('home.ctaGallery')}
              </Link>
            </div>

            <dl className="hero__stats">
              <div>
                <dt>6</dt>
                <dd>{t('home.statTemplates')}</dd>
              </div>
              <div>
                <dt>5</dt>
                <dd>{t('home.statFormats')}</dd>
              </div>
              <div>
                <dt>300</dt>
                <dd>{t('home.statResolution')}</dd>
              </div>
            </dl>
          </div>

          <div className="hero__visual">
            <PosterStack>
              {heroSpecs.map((spec, index) => (
                <PosterCanvas
                  key={index}
                  spec={spec}
                  maxRenderWidth={700}
                  className="poster-canvas--framed"
                />
              ))}
            </PosterStack>
          </div>
        </div>

        <p className="hero__scroll-hint" aria-hidden="true">
          <Icon name="chevronDown" size={16} />
          {t('home.scrollHint')}
        </p>
      </section>

      {/* Features -------------------------------------------------------- */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-head reveal" ref={featuresHeadRef}>
            <span className="eyebrow">{t('nav.home')}</span>
            <h2 className="section-title">{t('home.featuresTitle')}</h2>
            <p className="lead">{t('home.featuresSubtitle')}</p>
          </div>

          <div className="card-grid reveal" ref={featuresRef}>
            {features.map((feature, index) => (
              <article
                className="feature-card glass glass--interactive glass--sheen reveal"
                key={feature.title}
              >
                <span className="feature-card__icon">
                  <Icon name={FEATURE_ICONS[index] ?? 'sparkles'} size={22} />
                </span>
                <h3 className="feature-card__title">{feature.title}</h3>
                <p className="feature-card__body">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Vinyl scene ------------------------------------------------------ */}
      <section className="section showcase">
        <div className="container showcase__inner">
          <div className="showcase__copy reveal reveal--left" ref={showcaseHeadRef}>
            <span className="eyebrow">{t('home.showcaseTitle')}</span>
            <h2 className="section-title">{t('home.showcaseTitle')}</h2>
            <p className="lead">{t('home.showcaseSubtitle')}</p>
            <ul className="showcase__list">
              {DEMO_ALBUMS.slice(0, 3).map((album) => (
                <li key={album.id}>
                  <Icon name="check" size={16} />
                  {album.genres.join(' · ')}
                </li>
              ))}
            </ul>
          </div>
          <div className="showcase__scene">
            <VinylScene coverUrl={demoAlbum(1).coverUrl ?? undefined} />
          </div>
        </div>
      </section>

      {/* Steps ------------------------------------------------------------ */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-head reveal" ref={stepsHeadRef}>
            <span className="eyebrow">{t('home.stepsTitle')}</span>
            <h2 className="section-title">{t('home.stepsTitle')}</h2>
            <p className="lead">{t('home.stepsSubtitle')}</p>
          </div>

          <ol className="steps reveal" ref={stepsRef}>
            {steps.map((step, index) => (
              <li className="step reveal" key={step.title}>
                <span className="step__number">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Templates -------------------------------------------------------- */}
      <section className="section" id="templates">
        <div className="container container--wide">
          <div className="section-head reveal" ref={templatesHeadRef}>
            <span className="eyebrow">{t('home.templatesTitle')}</span>
            <h2 className="section-title">{t('home.templatesTitle')}</h2>
            <p className="lead">{t('home.templatesSubtitle')}</p>
          </div>

          <div className="template-showcase reveal" ref={templatesRef}>
            {templateSpecs.map((item) => (
              <figure className="template-showcase__item reveal" key={item.id}>
                <PosterCanvas spec={item.spec} maxRenderWidth={620} />
                <figcaption>{item.name}</figcaption>
              </figure>
            ))}
          </div>

          <div className="hstack-wrap" style={{ marginTop: 'var(--space-6)' }}>
            <Link to="/create" className="btn btn--primary btn--lg">
              <Icon name="arrowRight" size={18} />
              {t('home.templatesCta')}
            </Link>
          </div>
        </div>
      </section>

      {/* CTA -------------------------------------------------------------- */}
      <section className="section">
        <div className="container">
          <div className="cta-banner glass reveal" ref={ctaRef}>
            <h2 className="section-title">{t('home.ctaTitle')}</h2>
            <p className="lead" style={{ textAlign: 'center' }}>
              {t('home.ctaBody')}
            </p>
            <Link to="/create" className="btn btn--primary btn--lg">
              <Icon name="sparkles" size={18} />
              {t('home.ctaButton')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
