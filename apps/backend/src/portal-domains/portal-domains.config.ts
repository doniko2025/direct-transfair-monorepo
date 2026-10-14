// apps/backend/src/portal-domains/portal-domains.config.ts
// =========================================================
// CONFIGURATION DES DOMAINES DE PORTAIL v1.1
// v1.1 — 🔥 CORRIGÉ : protectedHosts() ne contient plus 'direct-transfair.eu' / 'www.direct-transfair.eu' en dur
//        (ancien site vitrine, libéré). Les hôtes protégés viennent uniquement de PLATFORM_CONSOLE_HOSTS et de
//        PORTAL_BASE_DOMAIN : plateforme multi-tenant, aucun domaine codé dans le source.
//
// Tout se règle par variables d'environnement, lues à chaque appel (jamais figées au démarrage) :
//
//   PORTAL_BASE_DOMAIN          domaine qui porte les sous-domaines des sociétés (ex. dkmoney.store).
//                               Absent ⇒ les sous-domaines de plateforme sont désactivés.
//   PORTAL_VERCEL_PROJECT_ID    projet Vercel qui sert les portails des sociétés (web-admin à la racine).
//   VERCEL_API_TOKEN            jeton Vercel.   VERCEL_TEAM_ID (optionnel).
//   CLOUDFLARE_API_TOKEN        jeton Cloudflare à droits limités (recommandé : Zone:Edit, DNS:Edit),
//     ou CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_KEY (clé globale, à éviter).
//   CLOUDFLARE_ACCOUNT_ID       compte où créer les zones des domaines propres.
//   PORTAL_DNS_A_TARGET         adresse IPv4 de Vercel pour un domaine nu      (défaut 76.76.21.21)
//   PORTAL_DNS_CNAME_TARGET     cible CNAME de Vercel                          (défaut cname.vercel-dns.com)
//   PORTAL_RESERVED_SUBDOMAINS  libellés interdits, séparés par des virgules   (liste par défaut ci-dessous)
//   PORTAL_MULTIPART_SUFFIXES   suffixes à deux niveaux (co.uk, com.gn…) pour retrouver le domaine enregistrable
//   PORTAL_DOMAINS_CRON         "false" coupe la vérification planifiée
//   PORTAL_DOMAINS_MAX_ATTEMPTS tentatives automatiques avant d'attendre une action manuelle (défaut 8)
// =========================================================

const DEFAULT_RESERVED = [
  'www', 'api', 'app', 'admin', 'console', 'transfert', 'portal', 'portail', 'mail', 'smtp', 'imap', 'pop',
  'ftp', 'static', 'assets', 'cdn', 'status', 'docs', 'support', 'help', 'dev', 'test', 'staging', 'preview',
  'login', 'auth', 'sso', 'ns1', 'ns2', 'dkim', 'autodiscover',
];

const DEFAULT_MULTIPART = [
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za', 'co.ke', 'co.tz', 'co.ug',
  'co.zw', 'co.mz', 'co.in', 'co.jp', 'com.br', 'com.ar', 'com.mx', 'com.co', 'com.pe', 'com.tr', 'com.sa',
  'com.eg', 'com.ng', 'com.gh', 'com.sn', 'com.gn', 'org.gn', 'com.ml', 'com.ci', 'com.cm', 'com.cn', 'com.hk',
  'com.sg', 'com.my', 'com.ph', 'com.pk', 'com.bd', 'com.lb', 'com.tn', 'com.dz', 'com.ma',
];

function list(raw: string | undefined, fallback: string[]): string[] {
  const items = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export function portalBaseDomain(): string | null {
  const v = (process.env.PORTAL_BASE_DOMAIN ?? '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  return v || null;
}

export function reservedSubdomains(): Set<string> {
  return new Set(list(process.env.PORTAL_RESERVED_SUBDOMAINS, DEFAULT_RESERVED));
}

export function multipartSuffixes(): Set<string> {
  return new Set(list(process.env.PORTAL_MULTIPART_SUFFIXES, DEFAULT_MULTIPART));
}

export function dnsATarget(): string {
  return (process.env.PORTAL_DNS_A_TARGET ?? '').trim() || '76.76.21.21';
}

export function dnsCnameTarget(): string {
  return (process.env.PORTAL_DNS_CNAME_TARGET ?? '').trim() || 'cname.vercel-dns.com';
}

export function maxAutoAttempts(): number {
  const n = Number(process.env.PORTAL_DOMAINS_MAX_ATTEMPTS);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 8;
}

export function cronEnabled(): boolean {
  return (process.env.PORTAL_DOMAINS_CRON ?? '').trim().toLowerCase() !== 'false';
}

/** Hôtes de la plateforme qu'une société ne peut jamais revendiquer (console et domaine de plateforme, définis par variables d'environnement). */
export function protectedHosts(): string[] {
  const hosts: string[] = [];
  for (const h of (process.env.PLATFORM_CONSOLE_HOSTS ?? '').split(',')) {
    const host = h.trim().toLowerCase();
    if (host) hosts.push(host);
  }
  const base = portalBaseDomain();
  if (base) hosts.push(base, `www.${base}`);
  return hosts;
}

/** Suffixes d'hébergeurs qu'on ne peut pas rattacher comme domaine propre. */
export const FORBIDDEN_SUFFIXES = ['.vercel.app', '.railway.app', '.onrender.com', '.localhost', '.local', '.internal'];

export interface IntegrationState {
  vercel: boolean;
  cloudflare: boolean;
  subdomains: boolean;
  baseDomain: string | null;
  dnsATarget: string;
  dnsCnameTarget: string;
}

export function integrationState(): IntegrationState {
  const vercel = Boolean(process.env.VERCEL_API_TOKEN?.trim() && process.env.PORTAL_VERCEL_PROJECT_ID?.trim());
  const cloudflare = Boolean(
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
      (process.env.CLOUDFLARE_EMAIL?.trim() && process.env.CLOUDFLARE_GLOBAL_KEY?.trim()),
  );
  const baseDomain = portalBaseDomain();
  return {
    vercel,
    cloudflare,
    subdomains: Boolean(baseDomain) && vercel && cloudflare,
    baseDomain,
    dnsATarget: dnsATarget(),
    dnsCnameTarget: dnsCnameTarget(),
  };
}