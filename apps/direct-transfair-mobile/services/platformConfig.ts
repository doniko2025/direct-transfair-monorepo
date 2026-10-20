// apps/direct-transfair-mobile/services/platformConfig.ts
// =========================================================
// CONFIGURATION PLATEFORME v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
//
// ✅ v1.0 (phase 7) : source unique de l'identité « plateforme » côté application, pilotée par variables d'environnement
//   du build (EXPO_PUBLIC_*) ou, à défaut, par `extra` d'app.json. Avant, le code de la société système (« DONIKO »),
//   le nom de marque, le domaine des portails (« direct-transfer.com »), les e-mails/téléphones de secours et les mentions
//   légales fictives (agrément « N° 12345 », capital, téléphone) étaient écrits en dur dans une dizaine de fichiers.
//
//   Les vraies valeurs de chaque société (mentions légales, support, couleurs…) viennent de l'API (/branding) ; ce
//   fichier ne fournit que la plateforme elle-même et les valeurs de SECOURS quand l'API est injoignable.
//
//   Variables (toutes facultatives) :
//     EXPO_PUBLIC_PLATFORM_CODE          code de la société système (défaut « DONIKO »)
//     EXPO_PUBLIC_PLATFORM_NAME          nom de marque (défaut « Direct Transf'air »)
//     EXPO_PUBLIC_PLATFORM_TAGLINE       accroche affichée par défaut
//     EXPO_PUBLIC_BRAND_PRIMARY / EXPO_PUBLIC_BRAND_SECONDARY / EXPO_PUBLIC_BRAND_SPLASH   couleurs de la plateforme
//     EXPO_PUBLIC_PORTAL_BASE_DOMAIN     domaine de base des portails (« sous-domaine.<domaine> ») — sans lui, seuls les
//                                        domaines propres des sociétés produisent un lien de portail
//     EXPO_PUBLIC_PLATFORM_HOSTS         hôtes (séparés par des virgules) qui désignent la plateforme elle-même
//     EXPO_PUBLIC_SUPPORT_EMAIL / EXPO_PUBLIC_SUPPORT_PHONE / EXPO_PUBLIC_DPO_EMAIL   contacts de secours
//     EXPO_PUBLIC_DATA_AUTHORITY_NAME / EXPO_PUBLIC_DATA_AUTHORITY_URL   autorité de protection des données (défaut CNIL)
//     EXPO_PUBLIC_LEGAL_JURISDICTION     juridiction citée dans les CGU (défaut : « les tribunaux compétents »)
//     EXPO_PUBLIC_LEGAL_*                COMPANY_NAME, REGULATOR_NAME, REGULATOR_ACRONYM, FRAMEWORK, LICENSE_NUMBER,
//                                        LICENSE_TYPE, CAPITAL, ADDRESS, MEDIATOR_NAME, MEDIATOR_URL, TERMS_VERSION,
//                                        TERMS_DATE — valeurs de secours des mentions légales de la plateforme
//
//   NB : Expo n'injecte que les accès statiques `process.env.EXPO_PUBLIC_XXX` — d'où l'écriture explicite ci-dessous.
// =========================================================

import Constants from 'expo-constants';

function extra(key: string): string {
  try {
    const e = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
    const v = e[key];
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

/** Première valeur non vide parmi (variable d'environnement, extra d'app.json) ; sinon `fallback`. */
function pick<T extends string | null>(envValue: string | undefined, extraKey: string, fallback: T): string | T {
  const e = (envValue ?? '').trim();
  if (e) return e;
  const x = extra(extraKey);
  return x || fallback;
}

// ─── Identité ────────────────────────────────────────────

/** Code (majuscules) de la société système / du portail par défaut. */
export function getPlatformCode(): string {
  return pick(process.env.EXPO_PUBLIC_PLATFORM_CODE, 'platformCode', 'DONIKO').toUpperCase();
}

/** Vrai si ce code désigne la société système. */
export function isPlatformCode(code: string | null | undefined): boolean {
  return !!code && code.trim().toUpperCase() === getPlatformCode();
}

export function getPlatformName(): string {
  return pick(process.env.EXPO_PUBLIC_PLATFORM_NAME, 'platformName', "Direct Transf'air");
}

export function getPlatformTagline(): string | null {
  return pick(process.env.EXPO_PUBLIC_PLATFORM_TAGLINE, 'platformTagline', 'Transferts internationaux sécurisés');
}

export function getPlatformColors(): { primary: string; secondary: string; splash: string } {
  return {
    primary: pick(process.env.EXPO_PUBLIC_BRAND_PRIMARY, 'brandPrimary', '#059669'),
    secondary: pick(process.env.EXPO_PUBLIC_BRAND_SECONDARY, 'brandSecondary', '#10B981'),
    splash: pick(process.env.EXPO_PUBLIC_BRAND_SPLASH, 'brandSplash', '#064E3B'),
  };
}

// ─── Domaines ────────────────────────────────────────────

/** Domaine de base des portails (« flash » → flash.<domaine>), ou null s'il n'est pas configuré. */
export function getPortalBaseDomain(): string | null {
  const v = pick(process.env.EXPO_PUBLIC_PORTAL_BASE_DOMAIN, 'portalBaseDomain', null);
  return v ? v.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase() : null;
}

/** Hôtes qui désignent la plateforme elle-même (domaine de base + « www. » + liste explicite). */
export function getPlatformHosts(): string[] {
  const hosts = new Set<string>();
  const base = getPortalBaseDomain();
  if (base) {
    hosts.add(base);
    hosts.add(`www.${base}`);
  }
  const list = pick(process.env.EXPO_PUBLIC_PLATFORM_HOSTS, 'platformHosts', '');
  for (const h of list.split(',')) {
    const t = h.trim().toLowerCase();
    if (t) hosts.add(t);
  }
  return [...hosts];
}

// ─── Contacts de secours ─────────────────────────────────

export function getFallbackSupportEmail(): string | null {
  return pick(process.env.EXPO_PUBLIC_SUPPORT_EMAIL, 'supportEmail', null);
}

export function getFallbackSupportPhone(): string | null {
  return pick(process.env.EXPO_PUBLIC_SUPPORT_PHONE, 'supportPhone', null);
}

/** Délégué à la protection des données ; à défaut, le contact support. */
export function getDpoEmail(): string | null {
  return pick(process.env.EXPO_PUBLIC_DPO_EMAIL, 'dpoEmail', null) ?? getFallbackSupportEmail();
}

// ─── Mentions légales ────────────────────────────────────

/** Autorité de protection des données citée dans la politique de confidentialité (défaut : CNIL). */
export function getDataAuthority(): { name: string; url: string } {
  return {
    name: pick(process.env.EXPO_PUBLIC_DATA_AUTHORITY_NAME, 'dataAuthorityName', 'CNIL'),
    url: pick(process.env.EXPO_PUBLIC_DATA_AUTHORITY_URL, 'dataAuthorityUrl', 'https://www.cnil.fr'),
  };
}

/** Juridiction citée dans les CGU ; null → formulation générique. */
export function getLegalJurisdiction(): string | null {
  return pick(process.env.EXPO_PUBLIC_LEGAL_JURISDICTION, 'legalJurisdiction', null);
}

/** Valeurs de secours des mentions légales de la plateforme (null tant qu'elles ne sont pas configurées). */
export function getLegalFallbacks() {
  return {
    legalCompanyName: pick(process.env.EXPO_PUBLIC_LEGAL_COMPANY_NAME, 'legalCompanyName', null),
    regulatorName: pick(process.env.EXPO_PUBLIC_LEGAL_REGULATOR_NAME, 'legalRegulatorName', null),
    regulatorAcronym: pick(process.env.EXPO_PUBLIC_LEGAL_REGULATOR_ACRONYM, 'legalRegulatorAcronym', null),
    regulatoryFrameworkLabel: pick(process.env.EXPO_PUBLIC_LEGAL_FRAMEWORK, 'legalFramework', null),
    regulatorLicenseNumber: pick(process.env.EXPO_PUBLIC_LEGAL_LICENSE_NUMBER, 'legalLicenseNumber', null),
    regulatorLicenseType: pick(process.env.EXPO_PUBLIC_LEGAL_LICENSE_TYPE, 'legalLicenseType', null),
    capitalSocial: pick(process.env.EXPO_PUBLIC_LEGAL_CAPITAL, 'legalCapital', null),
    address: pick(process.env.EXPO_PUBLIC_LEGAL_ADDRESS, 'legalAddress', null),
    mediatorName: pick(process.env.EXPO_PUBLIC_LEGAL_MEDIATOR_NAME, 'legalMediatorName', null),
    mediatorUrl: pick(process.env.EXPO_PUBLIC_LEGAL_MEDIATOR_URL, 'legalMediatorUrl', null),
    termsVersion: pick(process.env.EXPO_PUBLIC_LEGAL_TERMS_VERSION, 'legalTermsVersion', null),
    termsEffectiveDate: pick(process.env.EXPO_PUBLIC_LEGAL_TERMS_DATE, 'legalTermsDate', null),
  };
}

// ─── Taux de secours ─────────────────────────────────────

/**
 * Taux affichés quand l'API des taux est injoignable. JSON dans EXPO_PUBLIC_FALLBACK_RATES, ex.
 * '{"EUR_XOF":655.957,"EUR_GNF":9500}'. Vide par défaut : mieux vaut « — » qu'un taux inventé sur une app d'argent.
 */
export function getFallbackRates(): { pair: string; rate: number }[] {
  const raw = pick(process.env.EXPO_PUBLIC_FALLBACK_RATES, 'fallbackRates', '');
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj)
      .map(([pair, rate]) => ({ pair: pair.toUpperCase().replace('/', '_'), rate: Number(rate) }))
      .filter((r) => /^[A-Z]{3}_[A-Z]{3}$/.test(r.pair) && Number.isFinite(r.rate) && r.rate > 0);
  } catch {
    return [];
  }
}

// ─── Prestataires externes ───────────────────────────────

/** Page du prestataire de paiement externe « Sendwave » (modifiable). */
export function getSendwaveUrl(): string {
  return pick(process.env.EXPO_PUBLIC_SENDWAVE_URL, 'sendwaveUrl', 'https://www.sendwave.com');
}
