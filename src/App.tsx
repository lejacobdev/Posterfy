import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { SettingsProvider } from '@/lib/store/settings';
import { PosterProvider } from '@/lib/store/poster';
import { I18nProvider } from '@/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import HomePage from '@/pages/HomePage';

// The wizard, the editor and the content pages are split out of the initial
// bundle; the landing page ships eagerly so the first paint needs no extra
// round trip.
const WizardPage = lazy(() => import('@/pages/WizardPage'));
const EditorPage = lazy(() => import('@/pages/EditorPage'));
const GalleryPage = lazy(() => import('@/pages/GalleryPage'));
const FaqPage = lazy(() => import('@/pages/FaqPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'create', element: <WizardPage /> },
        { path: 'editor', element: <EditorPage /> },
        { path: 'gallery', element: <GalleryPage /> },
        { path: 'faq', element: <FaqPage /> },
        { path: 'about', element: <AboutPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'privacy', element: <PrivacyPage /> },
        { path: 'terms', element: <TermsPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  // Honours the Vite base path, so the app also works from a sub-directory
  // deployment such as GitHub Pages.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);

export function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <I18nProvider>
          <ToastProvider>
            <PosterProvider>
              <RouterProvider router={router} />
            </PosterProvider>
          </ToastProvider>
        </I18nProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
