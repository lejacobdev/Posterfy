import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { Header, MobileTabBar } from './Header';
import { Footer } from './Footer';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

/** The drifting colour field behind every page. */
function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora__blob aurora__blob--1" />
      <div className="aurora__blob aurora__blob--2" />
      <div className="aurora__blob aurora__blob--3" />
      <div className="aurora__grain" />
    </div>
  );
}

function RouteFallback() {
  return (
    <div
      className="container section"
      style={{ display: 'grid', placeItems: 'center', minHeight: '50svh' }}
    >
      <span className="spinner" style={{ color: 'var(--brand-400)', width: 28, height: 28 }} />
      <span className="visually-hidden">Loading</span>
    </div>
  );
}

/** Sends focus and scroll back to the top on navigation. */
function RouteChangeEffects() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const main = document.getElementById('main');
    main?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}

export function AppShell() {
  const { t } = useI18n();

  return (
    <>
      <Aurora />
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <RouteChangeEffects />
      <Header />
      <main id="main" tabIndex={-1} className="site-main">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
