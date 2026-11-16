// apps/web-admin/api/_branding.js
// Fonctions PURES partagées par les deux « fonctions serveur » du portail (api/manifest.js et api/icon.js).
// Le préfixe « _ » empêche Vercel d'en faire une adresse publique.
//
// Pourquoi : l'icône et le nom d'un portail installé sur l'écran d'accueil sont lus par le navigateur AVANT que l'application se charge,
// dans un fichier (le « manifeste »). Un fichier statique est identique pour toutes les sociétés. Ces fonctions le fabriquent
// à la demande selon l'adresse du portail (ex. flash.dkmoney.store) : logo et nom de la société, ou « t’ » pour la plateforme.

const PLATFORM_CODE = (process.env.VITE_PLATFORM_CODE || 'DONIKO').trim().toUpperCase();
const COLOR = '#F2F5F3';

/** Hôte réellement demandé par le visiteur (Vercel place l'original dans x-forwarded-host). */
export function hostOf(req) {
  const raw = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  return raw.replace(/:\d+$/, '');
}

/** Adresse du serveur de l'application (sans /api), lue dans l'environnement du déploiement. */
export function apiBase() {
  const raw = String(process.env.VITE_API_URL || process.env.API_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
  return /^https?:\/\//i.test(raw) ? raw : '';
}

/** Marque publique de la société qui possède cet hôte, ou null (hôte inconnu, plateforme, serveur injoignable). */
export async function fetchBranding(host, fetchImpl = fetch) {
  const base = apiBase();
  if (!base || !host || !host.includes('.')) return null;
  try {
    const res = await fetchImpl(`${base}/api/branding/by-host?host=${encodeURIComponent(host)}`, {
      headers: { 'x-tenant-id': PLATFORM_CODE, accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json !== 'object') return null;
    if (String(json.code || '').toUpperCase() === PLATFORM_CODE) return null; // la plateforme garde son « t’ »
    return json;
  } catch {
    return null;
  }
}

const DATA_IMAGE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

/** Décode un logo importé (data URL raster) ; null si ce n'en est pas un ou s'il est trop gros (> 200 Ko). */
export function decodeDataLogo(value) {
  const m = DATA_IMAGE.exec(String(value || ''));
  if (!m) return null;
  const bytes = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  return bytes.length > 0 && bytes.length <= 200_000 ? { type: m[1].toLowerCase(), bytes } : null;
}

/** Logo utilisable comme icône : adresse https (utilisée telle quelle) ou image importée (servie par /api/icon). */
export function iconSourceOf(branding) {
  const logo = String(branding?.logoUrl || '').trim();
  if (/^https:\/\/\S+$/i.test(logo)) return { kind: 'url', src: logo };
  if (decodeDataLogo(logo)) return { kind: 'data', src: '/api/icon' };
  return null;
}

const typeOfUrl = (u) => {
  const ext = /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.exec(u)?.[1]?.toLowerCase();
  if (!ext) return undefined;
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
};

/** Manifeste de la plateforme : identique au fichier statique public/manifest.webmanifest (adresses relatives). */
export function platformManifest() {
  return {
    name: 'Espace de gestion',
    short_name: 'Gestion',
    description: 'Back-office : agences, agents, clients, vérifications et trésorerie.',
    lang: 'fr',
    dir: 'ltr',
    start_url: './',
    scope: './',
    id: './',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: COLOR,
    theme_color: COLOR,
    icons: [
      { src: 'brand/logo-mark.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'brand/logo-mark.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: 'favicon.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
    ],
  };
}

const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** Manifeste d'une société : son nom et son logo ; sans logo exploitable, l'icône de la plateforme. */
export function companyManifest(branding) {
  const name = String(branding?.name || '').trim() || 'Espace de gestion';
  const base = platformManifest();
  const icon = iconSourceOf(branding);
  if (!icon) return { ...base, name: clip(`Espace de gestion — ${name}`, 45), short_name: clip(name, 12) };
  const type = icon.kind === 'url' ? typeOfUrl(icon.src) : (decodeDataLogo(branding.logoUrl)?.type ?? undefined);
  const entry = (sizes) => ({ src: icon.src, sizes, ...(type ? { type } : {}), purpose: 'any' });
  return { ...base, name: clip(`Espace de gestion — ${name}`, 45), short_name: clip(name, 12), icons: [entry('192x192'), entry('512x512')] };
}
