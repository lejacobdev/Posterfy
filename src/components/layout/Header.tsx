import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n/detect';
import { useSettings, type ThemePreference } from '@/lib/store/settings';
import { cn } from '@/lib/utils/misc';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Logo } from './Logo';
import './Header.css';

const NAV_ITEMS: Array<{ to: string; key: string; icon: IconName }> = [
  { to: '/create', key: 'nav.create', icon: 'wand' },
  { to: '/gallery', key: 'nav.gallery', icon: 'grid' },
  { to: '/faq', key: 'nav.faq', icon: 'info' },
  { to: '/about', key: 'nav.about', icon: 'heart' },
];

const THEME_OPTIONS: Array<{ value: ThemePreference; icon: IconName; key: string }> = [
  { value: 'light', icon: 'sun', key: 'nav.themeLight' },
  { value: 'dark', icon: 'moon', key: 'nav.themeDark' },
  { value: 'system', icon: 'monitor', key: 'nav.themeSystem' },
];

export function Header() {
  const { t } = useI18n();
  const { theme, setTheme, locale, setLocale } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close every popover on navigation.
  useEffect(() => {
    setMenuOpen(false);
    setLangOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && !langOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, langOpen]);

  return (
    <>
      <header className={cn('site-header', scrolled && 'site-header--scrolled')}>
        <div className="site-header__inner container container--wide">
          <Link to="/" className="site-header__brand" aria-label={t('common.appName')}>
            <Logo />
            <span className="site-header__wordmark">Posterfy</span>
          </Link>

          <nav className="site-header__nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn('site-header__link', isActive && 'is-active')}
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__actions">
            <div className="lang-picker">
              <button
                type="button"
                className="btn btn--ghost btn--sm lang-picker__trigger"
                aria-expanded={langOpen}
                aria-haspopup="listbox"
                onClick={() => setLangOpen((open) => !open)}
              >
                <Icon name="globe" size={17} />
                <span className="lang-picker__code">{locale.split('-')[0]?.toUpperCase()}</span>
              </button>
              {langOpen && (
                <>
                  <button
                    type="button"
                    className="popover-backdrop"
                    aria-label={t('common.close')}
                    onClick={() => setLangOpen(false)}
                  />
                  <ul
                    className="lang-picker__menu glass"
                    role="listbox"
                    aria-label={t('nav.language')}
                  >
                    {SUPPORTED_LOCALES.map((code) => (
                      <li key={code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={locale === code}
                          className={cn('lang-picker__item', locale === code && 'is-active')}
                          onClick={() => {
                            setLocale(code as Locale);
                            setLangOpen(false);
                          }}
                        >
                          <span aria-hidden="true">{LOCALE_NAMES[code].flag}</span>
                          <span>{LOCALE_NAMES[code].label}</span>
                          {locale === code && <Icon name="check" size={15} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="theme-picker" role="radiogroup" aria-label={t('nav.theme')}>
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.value}
                  aria-label={t(option.key)}
                  title={t(option.key)}
                  className={cn('theme-picker__btn', theme === option.value && 'is-active')}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon name={option.icon} size={16} />
                </button>
              ))}
            </div>

            <Link to="/create" className="btn btn--primary btn--sm site-header__cta">
              <Icon name="sparkles" size={16} />
              {t('nav.startCreating')}
            </Link>

            <button
              type="button"
              className="btn btn--ghost btn--icon site-header__burger"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label={t('nav.openMenu')}>
          <nav className="mobile-menu__nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn('mobile-menu__link', isActive && 'is-active')}
              >
                <Icon name={item.icon} size={20} />
                {t(item.key)}
              </NavLink>
            ))}
            <NavLink to="/settings" className="mobile-menu__link">
              <Icon name="settings" size={20} />
              {t('nav.settings')}
            </NavLink>
          </nav>

          <div className="mobile-menu__footer">
            <div className="mobile-menu__langs">
              {SUPPORTED_LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={cn('mobile-menu__lang', locale === code && 'is-active')}
                  onClick={() => setLocale(code as Locale)}
                >
                  <span aria-hidden="true">{LOCALE_NAMES[code].flag}</span>
                  {LOCALE_NAMES[code].label}
                </button>
              ))}
            </div>
            <Link to="/create" className="btn btn--primary btn--lg btn--block">
              <Icon name="sparkles" size={18} />
              {t('nav.startCreating')}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** Bottom tab bar shown on phones so the main routes stay one thumb away. */
export function MobileTabBar() {
  const { t } = useI18n();
  const items: Array<{ to: string; key: string; icon: IconName; end?: boolean }> = [
    { to: '/', key: 'nav.home', icon: 'layout', end: true },
    { to: '/create', key: 'nav.create', icon: 'wand' },
    { to: '/gallery', key: 'nav.gallery', icon: 'grid' },
    { to: '/settings', key: 'nav.settings', icon: 'settings' },
  ];

  return (
    <nav className="tab-bar glass" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn('tab-bar__item', isActive && 'is-active')}
        >
          <Icon name={item.icon} size={21} />
          <span>{t(item.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
