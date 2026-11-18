import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Manifeste d'installation : à la racine du site en production, la fonction /api/manifest le fabrique selon l'adresse visitée
// (nom + logo de la société). On le branche dans le HTML lui-même — et non en JavaScript après coup — pour que Chrome lise le bon
// fichier dès le premier chargement : un manifeste remplacé en cours de route fait retomber l'installation en simple raccourci,
// qui s'ouvre avec la barre du lien. En développement, ou sous un chemin (/transfert), le fichier statique reste utilisé.
function manifestLink(base: string): Plugin {
  return {
    name: 'dt-manifest-link',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const dev = Boolean(ctx.server);
        const href = !dev && base === '/' ? '/api/manifest' : `${base}manifest.webmanifest`;
        return html.replace(/(<link rel="manifest" href=")[^"]*(")/, `$1${href}$2`);
      },
    },
  };
}

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
    plugins: [react(), manifestLink(base)],
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    build: { sourcemap: false },
  };
});
