import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Manifeste d'installation.
//  • racine du site (production) : la fonction /api/manifest le fabrique selon l'adresse visitée (nom + logo de la société) ;
//  • sous un chemin (ex. /transfert, derrière la console) : le manifeste est GÉNÉRÉ au build (pwa.webmanifest) avec des adresses absolues
//    qui incluent ce chemin — start_url, scope et id restent dans /transfert/, les icônes aussi. Un manifeste écrit pour la racine
//    (« ./ », « /brand/… ») rend l'installation impossible sous un préfixe : Chrome ne propose alors que la page web.
// Le lien est écrit dans le HTML lui-même (jamais remplacé en JavaScript après coup).
function manifestLink(base: string, env: Record<string, string>): Plugin {
  const prefixed = base !== '/';
  const name = (env.VITE_CONSOLE_URL ?? '').trim() ? (env.VITE_CONSOLE_PORTAL_NAME ?? '').trim() || 'Sociétés de transfert' : 'Espace de gestion';
  return {
    name: 'dt-manifest-link',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const dev = Boolean(ctx.server);
        const href = dev ? `${base}manifest.webmanifest` : prefixed ? `${base}pwa.webmanifest` : '/api/manifest';
        return html.replace(/(<link rel="manifest" href=")[^"]*(")/, `$1${href}$2`);
      },
    },
    generateBundle() {
      if (!prefixed) return;
      const icon = (file: string, sizes: string, purpose: string) => ({ src: `${base}brand/${file}`, sizes, type: 'image/png', purpose });
      const manifest = {
        name,
        short_name: name.length > 12 ? 'Gestion' : name,
        description: 'Back-office : agences, agents, clients, vérifications et trésorerie.',
        lang: 'fr',
        dir: 'ltr',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'any',
        background_color: '#F2F5F3',
        theme_color: '#D3E4D6',
        prefer_related_applications: false,
        icons: [icon('icon-192.png', '192x192', 'any'), icon('logo-mark.png', '512x512', 'any'), icon('icon-512-maskable.png', '512x512', 'maskable')],
      };
      this.emitFile({ type: 'asset', fileName: 'pwa.webmanifest', source: JSON.stringify(manifest, null, 2) });
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
    plugins: [react(), manifestLink(base, env)],
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    build: { sourcemap: false },
  };
});
