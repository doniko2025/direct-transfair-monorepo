// apps/direct-transfair-mobile/components/auth/authErrors.ts
// =========================================================
// MESSAGES D'ERREUR D'AUTHENTIFICATION v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Transforme n'importe quelle erreur (réseau, timeout, serveur qui
// dort, mauvais identifiants, quota…) en un message clair en français,
// avec un type exploitable par l'écran. Plus jamais un « Network
// Error » ou un « Application not found » brut devant le client.
// =========================================================

export type AuthErrorKind =
  | 'network'      // serveur injoignable / pas de connexion
  | 'timeout'      // le serveur met trop de temps (démarrage à froid)
  | 'server'       // 5xx
  | 'config'       // mauvaise URL de serveur (réponse qui n'est pas notre API)
  | 'credentials'  // email / mot de passe incorrect
  | 'rate_limit'   // trop de tentatives
  | 'conflict'     // compte déjà existant
  | 'validation'   // données refusées par le serveur
  | 'forbidden'    // accès refusé (compte suspendu, portail web…)
  | 'unknown';

export type AuthErrorInfo = {
  kind: AuthErrorKind;
  title: string;
  message: string;
  /** Code métier renvoyé par le backend (USE_WEB_PORTAL, VERIFICATION_REQUIRED…). */
  code?: string;
  status?: number;
};

function asRecord(v: unknown): Record<string, any> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, any>) : null;
}

/** Message textuel renvoyé par le backend (string ou tableau de class-validator). */
export function serverMessage(err: unknown): string | null {
  const e = asRecord(err);
  const data = asRecord(e?.response?.data);
  if (!data) return null;
  const raw = data.message ?? data.error;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/** Vrai pour une panne passagère qu'on peut retenter (réseau coupé, timeout, 502/503/504). */
export function isTransientError(err: unknown): boolean {
  const e = asRecord(err);
  if (!e) return false;
  if (e.response === undefined || e.response === null) {
    // pas de réponse : réseau, DNS, timeout — mais pas une erreur de programmation
    return e.isAxiosError === true || e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK' || /network|timeout/i.test(String(e.message ?? ''));
  }
  const s = Number(e.response.status);
  return s === 502 || s === 503 || s === 504;
}

const FALLBACK_TITLE = 'Une erreur est survenue';

export function describeAuthError(err: unknown, ctx: 'login' | 'register' | 'otp' | 'reset' | 'generic' = 'generic'): AuthErrorInfo {
  const e = asRecord(err);
  const status: number | undefined = typeof e?.response?.status === 'number' ? e.response.status : undefined;
  const data = asRecord(e?.response?.data);
  const code: string | undefined = typeof data?.code === 'string' ? data.code : undefined;
  const srv = serverMessage(err);

  // Pas de réponse HTTP : réseau ou timeout.
  if (status === undefined) {
    const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message ?? ''));
    if (isTimeout) {
      return {
        kind: 'timeout',
        title: 'Le serveur met du temps à répondre',
        message: 'Il démarre peut-être après une période d’inactivité. Patientez quelques secondes puis réessayez.',
      };
    }
    return {
      kind: 'network',
      title: 'Connexion impossible',
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.',
    };
  }

  // Réponse qui n'est pas celle de notre API (page d'hébergeur, HTML…).
  const looksForeign =
    typeof e?.response?.data === 'string' ||
    (/application not found|not found|bad gateway|service unavailable/i.test(srv ?? '') && !code);
  if ((status === 404 || status === 502 || status === 503) && looksForeign) {
    return {
      kind: status === 404 ? 'config' : 'server',
      title: status === 404 ? 'Serveur introuvable' : 'Service momentanément indisponible',
      message:
        status === 404
          ? 'L’application n’arrive pas à joindre le bon serveur. Mettez-la à jour ou contactez l’assistance.'
          : 'Le service redémarre. Réessayez dans quelques instants.',
      status,
    };
  }

  if (code === 'USE_WEB_PORTAL' || code === 'USE_COMPANY_PORTAL' || code === 'USE_DEFAULT_PORTAL' || code === 'VERIFICATION_REQUIRED') {
    return {
      kind: 'forbidden',
      title: code === 'USE_WEB_PORTAL' ? 'Compte réservé au portail web' : 'Accès restreint',
      message: srv ?? 'Ce compte ne peut pas se connecter ici.',
      code,
      status,
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limit',
      title: 'Trop de tentatives',
      message: 'Pour votre sécurité, patientez une minute avant de réessayer.',
      status,
    };
  }
  if (status >= 500) {
    return { kind: 'server', title: 'Service momentanément indisponible', message: 'Un incident technique est survenu de notre côté. Réessayez dans quelques instants.', status };
  }
  if (status === 401) {
    return ctx === 'login'
      ? { kind: 'credentials', title: 'Identifiants incorrects', message: srv && !/unauthorized/i.test(srv) ? srv : 'Email ou mot de passe incorrect.', status }
      : { kind: 'forbidden', title: 'Session expirée', message: 'Veuillez vous reconnecter.', status };
  }
  if (status === 409) {
    return { kind: 'conflict', title: 'Compte déjà existant', message: srv ?? 'Un compte existe déjà avec ces informations.', status };
  }
  if (status === 403) {
    return { kind: 'forbidden', title: 'Accès refusé', message: srv ?? 'Votre compte ne peut pas effectuer cette action.', status };
  }
  if (status === 404 && ctx === 'reset') {
    return { kind: 'validation', title: 'Compte introuvable', message: 'Aucun compte ne correspond à cet email ou ce numéro.', status };
  }
  if (status === 400 || status === 404 || status === 422) {
    const title = ctx === 'otp' ? 'Code incorrect' : 'Information à corriger';
    return { kind: 'validation', title, message: srv ?? 'Les informations saisies sont incorrectes.', status };
  }
  return { kind: 'unknown', title: FALLBACK_TITLE, message: srv ?? 'Réessayez dans quelques instants.', status };
}
