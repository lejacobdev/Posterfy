/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv & {
    readonly BASE_URL: string;
    readonly MODE: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
  };
}
