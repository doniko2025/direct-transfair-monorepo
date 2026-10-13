/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PLATFORM_HOSTS?: string;
  readonly VITE_TENANT_CODE?: string;
  readonly VITE_ALLOW_TENANT_QUERY?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_CONSOLE_URL?: string;
  readonly VITE_CONSOLE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
