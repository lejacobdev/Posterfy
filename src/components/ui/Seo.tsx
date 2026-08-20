import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_URL } from '@/lib/constants';

export interface SeoProps {
  title: string;
  description: string;
  /** Overrides the canonical path; defaults to the current route. */
  path?: string;
  noindex?: boolean;
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Keeps the document head in sync with the active route. Small enough not to
 * warrant a helmet dependency, and it runs after hydration like one would.
 */
export function Seo({ title, description, path, noindex }: SeoProps) {
  const location = useLocation();
  const fullTitle = title.includes('Posterfy') ? title : `${title} · Posterfy`;
  const canonicalPath = path ?? location.pathname;
  const canonical = `${SITE_URL.replace(/\/$/, '')}${canonicalPath}`;

  useEffect(() => {
    document.title = fullTitle;

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      noindex ? 'noindex, nofollow' : 'index, follow',
    );

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [fullTitle, description, canonical, noindex]);

  return null;
}
