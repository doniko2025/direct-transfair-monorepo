// src/vite-env.d.ts
// ✅ phase 8 (logo « t’ ») : VITE_PLATFORM_LOGO_URL.
// ✅ phase 7 : variables d'identité de la plateforme (VITE_PLATFORM_*, VITE_BRAND_*, VITE_CONSOLE_PORTAL_*).
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PLATFORM_HOSTS?: string;
  readonly VITE_TENANT_CODE?: string;
  readonly VITE_ALLOW_TENANT_QUERY?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_CONSOLE_URL?: string;
  readonly VITE_CONSOLE_NAME?: string;
  readonly VITE_PLATFORM_CODE?: string;
  readonly VITE_PLATFORM_NAME?: string;
  readonly VITE_PLATFORM_TAGLINE?: string;
  readonly VITE_BRAND_PRIMARY?: string;
  readonly VITE_BRAND_SECONDARY?: string;
  readonly VITE_PLATFORM_LOGO_URL?: string;
  readonly VITE_CONSOLE_PORTAL_NAME?: string;
  readonly VITE_CONSOLE_PORTAL_TAGLINE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
