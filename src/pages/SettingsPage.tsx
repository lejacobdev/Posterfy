import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n/detect';
import { useSettings, type ThemePreference } from '@/lib/store/settings';
import { getProviderConfig, resetProviderConfig } from '@/lib/api/spotify';
import { clearTokenCache, verifyCredentials } from '@/lib/api/spotifyDirect';
import { clearPosterfyStorage } from '@/lib/store/storage';
import { APP_VERSION } from '@/lib/constants';
import { Seo } from '@/components/ui/Seo';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { PanelSection, SegmentedControl, TextField, Toggle } from '@/components/ui/Controls';
import './SettingsPage.css';

export default function SettingsPage() {
  const { t } = useI18n();
  const {
    theme,
    setTheme,
    locale,
    setLocale,
    reduceMotion,
    setReduceMotion,
    credentials,
    saveCredentials,
    clearCredentials,
  } = useSettings();
  const { notify } = useToast();

  const [serverSpotify, setServerSpotify] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState(credentials?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState(credentials?.clientSecret ?? '');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    void getProviderConfig().then((config) => {
      if (active) setServerSpotify(config.spotify);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveCredentials = async () => {
    const next = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
    if (!next.clientId || !next.clientSecret) return;

    setChecking(true);
    const valid = await verifyCredentials(next);
    setChecking(false);

    if (!valid) {
      notify(t('errors.spotifyUnavailable'), 'error');
      return;
    }
    saveCredentials(next);
    resetProviderConfig();
    notify(t('settings.credsSaved'), 'success');
  };

  const handleClearCredentials = () => {
    clearCredentials();
    clearTokenCache();
    setClientId('');
    setClientSecret('');
    notify(t('settings.credsCleared'), 'info');
  };

  const handleClearData = () => {
    if (!window.confirm(t('settings.clearDataConfirm'))) return;
    clearPosterfyStorage();
    notify(t('settings.dataCleared'), 'success');
    // A reload is the cleanest way to re-seed every provider from defaults.
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <>
      <Seo title={t('settings.title')} description={t('settings.subtitle')} noindex />

      <div className="container container--narrow">
        <header className="page-header">
          <span className="badge page-header__eyebrow">
            <Icon name="settings" size={14} />
            {t('nav.settings')}
          </span>
          <h1 className="page-header__title">{t('settings.title')}</h1>
          <p className="page-header__subtitle">{t('settings.subtitle')}</p>
        </header>

        <div className="settings-card glass">
          <PanelSection title={t('settings.appearance')} icon="sun">
            <SegmentedControl<ThemePreference>
              label={t('nav.theme')}
              value={theme}
              options={[
                { value: 'light', label: t('nav.themeLight'), icon: 'sun' },
                { value: 'dark', label: t('nav.themeDark'), icon: 'moon' },
                { value: 'system', label: t('nav.themeSystem'), icon: 'monitor' },
              ]}
              onChange={setTheme}
            />
            <Toggle
              checked={reduceMotion}
              onChange={setReduceMotion}
              label={t('settings.reduceMotion')}
              hint={t('settings.reduceMotionHelp')}
              icon="sliders"
            />
          </PanelSection>

          <PanelSection title={t('settings.languageSection')} icon="globe">
            <div className="settings-langs">
              {SUPPORTED_LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`settings-lang ${locale === code ? 'is-active' : ''}`}
                  aria-pressed={locale === code}
                  onClick={() => setLocale(code as Locale)}
                >
                  <span aria-hidden="true">{LOCALE_NAMES[code].flag}</span>
                  <span className="settings-lang__text">
                    <strong>{LOCALE_NAMES[code].label}</strong>
                    <small>{LOCALE_NAMES[code].english}</small>
                  </span>
                  {locale === code && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
            <p className="field__hint">{t('settings.languageAuto')}</p>
          </PanelSection>

          <PanelSection title={t('settings.providerSection')} icon="music">
            <p className="settings-status">
              <Icon
                name={serverSpotify ? 'checkCircle' : 'info'}
                size={16}
                style={{ color: serverSpotify ? 'var(--success)' : 'var(--text-subtle)' }}
              />
              {serverSpotify === null
                ? t('common.loading')
                : serverSpotify
                  ? t('settings.providerSpotifyOn')
                  : t('settings.providerSpotifyOff')}
            </p>

            {serverSpotify === false && (
              <div className="settings-creds">
                <h3 className="field__label">{t('settings.spotifyCreds')}</h3>
                <p className="field__hint">{t('settings.spotifyCredsHelp')}</p>

                <TextField
                  label={t('settings.clientId')}
                  value={clientId}
                  onChange={setClientId}
                  placeholder="0123456789abcdef0123456789abcdef"
                />
                <TextField
                  label={t('settings.clientSecret')}
                  value={clientSecret}
                  onChange={setClientSecret}
                  type="password"
                />

                <p className="settings-warning">
                  <Icon name="alert" size={15} />
                  {t('settings.credsWarning')}
                </p>

                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={checking || !clientId.trim() || !clientSecret.trim()}
                    onClick={() => void handleSaveCredentials()}
                  >
                    {checking ? <span className="spinner" /> : <Icon name="lock" size={16} />}
                    {t('settings.saveCreds')}
                  </button>
                  {credentials && (
                    <button
                      type="button"
                      className="btn btn--outline btn--danger"
                      onClick={handleClearCredentials}
                    >
                      <Icon name="trash" size={16} />
                      {t('settings.clearCreds')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </PanelSection>

          <PanelSection title={t('settings.dataSection')} icon="shield">
            <p className="field__hint">{t('settings.dataHelp')}</p>
            <button
              type="button"
              className="btn btn--outline btn--danger"
              onClick={handleClearData}
            >
              <Icon name="trash" size={16} />
              {t('settings.clearData')}
            </button>
            <p className="subtle">
              {t('settings.version')} {APP_VERSION}
            </p>
          </PanelSection>
        </div>
      </div>
    </>
  );
}
