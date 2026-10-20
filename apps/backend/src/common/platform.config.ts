// apps/backend/src/common/platform.config.ts
// =========================================================
// PLATFORM CONFIG v1.0 — Direct Transf'air
// ✅ v1.0 (phase 7) : identité de la plateforme CENTRALISÉE et pilotable par variables d'environnement.
//   Avant, le nom de marque (« Direct Transf'air »), le code de la société système (« DONIKO »), l'alias historique « 10 »,
//   les liens et l'e-mail de support des courriels, le préfixe des SMS et l'émetteur/destinataire SSO étaient écrits
//   en dur dans une vingtaine de fichiers. Tout passe maintenant par ce fichier ; les valeurs par défaut reproduisent
//   exactement le comportement précédent, donc rien ne change tant qu'aucune variable n'est définie.
//
//   Variables (toutes facultatives) :
//     PLATFORM_TENANT_CODE    code de la société système (défaut « DONIKO »)
//     PLATFORM_LEGACY_CODES   alias historiques du code plateforme, séparés par des virgules (défaut « 10 »)
//     PLATFORM_NAME           nom de marque affiché dans les courriels / SMS / Swagger (défaut « Direct Transf'air »)
//     PLATFORM_LEGAL_NAME     raison sociale en pied de courriel (défaut : PLATFORM_NAME)
//     PLATFORM_APP_URL        adresse du portail web (défaut : FRONTEND_URL) — lien « Accéder à mon espace » des courriels
//     PLATFORM_WEBSITE_URL    site vitrine — lien du pied de courriel (omis si absent)
//     PLATFORM_SUPPORT_EMAIL  adresse du support (défaut : SUPPORT_EMAIL) — omise des courriels si absente
//     PLATFORM_IOS_URL / PLATFORM_ANDROID_URL  liens de téléchargement des applications (omis si absents)
//     PLATFORM_SSO_ISSUER / PLATFORM_SSO_AUDIENCE  émetteur et destinataire attendus de l'assertion SSO
//
//   Les valeurs sont lues À CHAQUE APPEL (getters) : le fichier .env est chargé par ConfigModule après l'import
//   des modules, donc une lecture au chargement du module verrait des variables encore absentes.
//   Auteur : Thierno Doniko (Grand Chef, Doniko Digital)
// =========================================================

const env = (key: string): string | undefined => {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
};

/** Retire les « / » finaux d'une URL pour pouvoir concaténer proprement. */
const stripSlash = (u: string): string => u.replace(/\/+$/, '');

/** Première valeur d'une liste séparée par des virgules (FRONTEND_URL peut en contenir plusieurs). */
const firstOf = (v: string | undefined): string | undefined =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean)[0] : undefined;

export const platform = {
  /** Code (majuscules) de la société système. */
  get code(): string {
    return (env('PLATFORM_TENANT_CODE') ?? 'DONIKO').toUpperCase();
  },

  /** Nom de marque de la plateforme. */
  get name(): string {
    return env('PLATFORM_NAME') ?? "Direct Transf'air";
  },

  /** Raison sociale (pied de courriel). */
  get legalName(): string {
    return env('PLATFORM_LEGAL_NAME') ?? this.name;
  },

  /** Préfixe des SMS, ex. « [Direct Transf'air] ». */
  get smsTag(): string {
    return `[${this.name}]`;
  },

  /** Adresse du portail web, sans « / » final, ou null. */
  get appUrl(): string | null {
    const u = env('PLATFORM_APP_URL') ?? firstOf(env('FRONTEND_URL'));
    return u ? stripSlash(u) : null;
  },

  /** Site vitrine, sans « / » final, ou null. */
  get websiteUrl(): string | null {
    const u = env('PLATFORM_WEBSITE_URL');
    return u ? stripSlash(u) : null;
  },

  /** E-mail du support, ou null. */
  get supportEmail(): string | null {
    return env('PLATFORM_SUPPORT_EMAIL') ?? env('SUPPORT_EMAIL') ?? null;
  },

  /** Liens de téléchargement des applications mobiles (null = bouton masqué). */
  get iosUrl(): string | null {
    return env('PLATFORM_IOS_URL') ?? null;
  },
  get androidUrl(): string | null {
    return env('PLATFORM_ANDROID_URL') ?? null;
  },

  /** Émetteur / destinataire attendus de l'assertion SSO de la console. */
  get ssoIssuer(): string {
    return env('PLATFORM_SSO_ISSUER') ?? 'dkmoney-console';
  },
  get ssoAudience(): string {
    return env('PLATFORM_SSO_AUDIENCE') ?? 'direct-transfair';
  },

  /** Alias historiques du code plateforme (anciens clients mobiles envoyaient « 10 »). */
  get legacyCodes(): string[] {
    const raw = env('PLATFORM_LEGACY_CODES');
    return (raw ? raw.split(',') : ['10']).map((s) => s.trim().toUpperCase()).filter(Boolean);
  },

  /** Vrai si ce code désigne la société système (code officiel ou alias historique). */
  isPlatformCode(raw: unknown): boolean {
    if (typeof raw !== 'string') return false;
    const t = raw.trim().toUpperCase();
    return t === this.code || this.legacyCodes.includes(t);
  },

  /** Ramène un code reçu au code officiel : alias historique → code plateforme, sinon le code en majuscules. */
  canonicalCode(raw: unknown): string {
    if (typeof raw !== 'string') return this.code;
    const t = raw.trim().toUpperCase();
    if (!t || this.legacyCodes.includes(t)) return this.code;
    return t;
  },
};

/** Échappe le texte injecté dans du HTML de courriel (le nom de marque vient de la configuration). */
export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
