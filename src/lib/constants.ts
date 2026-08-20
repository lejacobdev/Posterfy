/** Build-time constants shared across the app. */

export const APP_VERSION = '1.0.0';

export const REPO_URL = 'https://github.com/lejacobdev/Posterfy';

export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://posterfy.app';

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? 'hello@posterfy.app';

/** Date the legal pages were last reviewed. */
export const LEGAL_UPDATED = '2026-08-20';
