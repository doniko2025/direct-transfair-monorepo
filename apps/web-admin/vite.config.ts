import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Port 5173 : c'est l'un des ports de développement autorisés par la CORS du backend
// (apps/backend/src/main.ts). strictPort : si 5173 est pris, Vite s'arrête au lieu de
// glisser vers un port que le backend refuserait.
//
// VITE_BASE_PATH (ex. /transfert) : chemin sous lequel ce portail est servi quand il est monté derrière
// la console dkmoney.store (réécriture Vercel). Absent = racine « / » : déploiement normal inchangé.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const raw = (env.VITE_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
  const base = /^[A-Za-z0-9_-]+$/.test(raw) ? `/${raw}/` : '/';

  return {
    base,
    plugins: [react()],
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    build: { sourcemap: false },
  };
});
