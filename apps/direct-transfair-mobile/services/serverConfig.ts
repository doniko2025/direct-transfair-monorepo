// apps/direct-transfair-mobile/services/serverConfig.ts
// =========================================================
// CONFIGURATION SERVEUR v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
//
// v1.0 — 🔥 CAUSE RACINE de « Application not found » à la connexion.
//   Jusqu'ici, api.ts retombait sur une URL de secours codée en dur
//   (l'ancien serveur Railway, aujourd'hui supprimé) dès que la variable
//   EXPO_PUBLIC_API_URL n'était pas intégrée au build. L'app appelait donc
//   un serveur qui n'existe plus, et la connexion échouait pour tous.
//   Cette source unique de vérité :
//     1. lit EXPO_PUBLIC_API_URL (variable d'environnement du build) ;
//     2. sinon extra.apiUrl d'app.json (lu à l'exécution) ;
//     3. sinon l'URL de production ci-dessous ;
//     4. REFUSE toute URL d'un hébergeur abandonné (liste ci-dessous) :
//        même un ancien .env ou un ancien profil de build ne peut plus
//        renvoyer l'app vers un serveur mort.
//   Tout est paramétrable (variables EXPO_PUBLIC_*), rien n'est figé.
// =========================================================

import Constants from 'expo-constants';

/** Serveur de production (Render). Modifiable sans toucher au code via EXPO_PUBLIC_API_URL. */
export const DEFAULT_API_URL = 'https://direct-transfair-backend.onrender.com';

export const DEFAULT_API_PREFIX = '/api';

/** Hébergeurs abandonnés : une URL qui les contient est ignorée au profit de la suivante. */
const ABANDONED_HOSTS = ['.railway.app', '.up.railway.app'];

function clean(input: string | null | undefined): string {
  return (input ?? '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

function isUsable(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const lower = url.toLowerCase();
  return !ABANDONED_HOSTS.some((h) => lower.includes(h));
}

function fromAppConfig(): string {
  try {
    const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
    return typeof extra.apiUrl === 'string' ? extra.apiUrl : '';
  } catch {
    return '';
  }
}

/** URL du serveur, sans /api final (ex. https://direct-transfair-backend.onrender.com). */
export function getServerOrigin(): string {
  const candidates = [process.env.EXPO_PUBLIC_API_URL, fromAppConfig(), DEFAULT_API_URL];
  for (const c of candidates) {
    const url = clean(c);
    if (url && isUsable(url)) return url;
  }
  return DEFAULT_API_URL;
}

/** Préfixe des routes (par défaut /api), toujours avec un « / » initial. */
export function getApiPrefix(): string {
  const raw = (process.env.EXPO_PUBLIC_API_PREFIX ?? '').trim();
  const p = raw.length > 0 ? raw : DEFAULT_API_PREFIX;
  return p.startsWith('/') ? p : `/${p}`;
}

/** URL complète de l'API (origine + préfixe). */
export function getApiBaseUrl(): string {
  return `${getServerOrigin()}${getApiPrefix()}`;
}

/** Âge minimal pour ouvrir un compte (réglementation des services de paiement), paramétrable. */
export function getMinimumAge(): number {
  const n = Number(process.env.EXPO_PUBLIC_MIN_AGE);
  return Number.isFinite(n) && n >= 13 && n <= 99 ? Math.floor(n) : 18;
}
