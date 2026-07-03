// apps/direct-transfair-mobile/services/v2-auth.ts
// =========================================================
// SERVICE AUTH v2 — Frontend
// Wrapping des endpoints /auth/v2/* sans modifier api.ts
// Utilise l'instance api existante pour hériter du tenant,
// des intercepteurs et du refresh token automatique.
//
// ✅ FIX — suppression des `(api as any)` : api.http est déjà
//   déclaré `public http: AxiosInstance` dans api.ts. Le cast en
//   `any` cassait le typage et déclenchait TS2347 ("Untyped
//   function calls may not accept type arguments") sur chaque
//   appel avec generic (<Type>). Sans effet en runtime (les
//   generics sont effacés à la transpilation), mais aucune raison
//   de le garder — confirmé avec tsc --strict.
// =========================================================

import { api } from './api';

// ─── Types de réponse ────────────────────────────────────

export type OtpRequestResult = {
  userId:          string;
  maskedRecipient: string;
  channel:         'EMAIL' | 'SMS';
};

export type LoginV2Result = {
  access_token:  string;
  refresh_token: string;
  user: {
    id:              string;
    email:           string;
    phone?:          string | null;
    role:            string;
    clientId?:       number | null;
    firstName?:      string | null;
    lastName?:       string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    primaryCurrency?: string | null;
    client?:         any;
    agency?:         any;
    wallets?:        any[];
    [key: string]:   unknown;
  };
};

export type VerificationNeededResult = {
  requiresVerification: true;
  userId:               string;
  emailVerified:        boolean;
  phoneVerified:        boolean;
  hasPhone:             boolean;
  message:              string;
};

export type LoginV2Response = LoginV2Result | VerificationNeededResult;

export type VerifyContactResult = {
  success:       true;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPhone:      boolean;
  allVerified:   boolean;
};

export type VerificationStatus = {
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPhone:      boolean;
  maskedEmail:   string;
  maskedPhone:   string | null;
  allVerified:   boolean;
};

// ─── Helper interne ───────────────────────────────────────
function extractMessage(err: unknown): string {
  if (typeof err !== 'object' || !err) return 'Erreur réseau';
  const e = err as any;
  const data = e?.response?.data;
  if (!data) return e?.message ?? 'Erreur réseau';
  const msg = data?.message ?? data?.error ?? 'Erreur';
  return Array.isArray(msg) ? msg[0] : String(msg);
}

// ─── API v2 ──────────────────────────────────────────────

export const v2Auth = {
  /**
   * Méthode 1 : Connexion email + mot de passe
   * Retourne un JWT ou { requiresVerification: true }
   */
  async loginPassword(
    email:    string,
    password: string,
  ): Promise<LoginV2Response> {
    const res = await api.http.post<LoginV2Response>(
      '/auth/v2/login-password',
      { email: email.trim().toLowerCase(), password },
    );
    return res.data;
  },

  /**
   * Méthode 2a : Demande OTP par email
   * Retourne { userId, maskedRecipient, channel:'EMAIL' }
   */
  async requestOtpEmail(email: string): Promise<OtpRequestResult> {
    const res = await api.http.post<OtpRequestResult>(
      '/auth/v2/request-otp-email',
      { email: email.trim().toLowerCase() },
    );
    return res.data;
  },

  /**
   * Méthode 2b : Demande OTP par SMS
   * Retourne { userId, maskedRecipient, channel:'SMS' }
   */
  async requestOtpPhone(phone: string): Promise<OtpRequestResult> {
    const res = await api.http.post<OtpRequestResult>(
      '/auth/v2/request-otp-phone',
      { phone: phone.trim() },
    );
    return res.data;
  },

  /**
   * Vérification OTP (email ou SMS) → JWT
   */
  async verifyOtpLogin(
    userId:    string,
    code:      string,
    channel:   'EMAIL' | 'SMS',
    deviceId?: string,
  ): Promise<LoginV2Result> {
    const res = await api.http.post<LoginV2Result>(
      '/auth/v2/verify-otp-login',
      { userId, code, channel, deviceId },
    );
    return res.data;
  },

  /**
   * Envoi OTP de vérification (post-inscription)
   * channel: 'EMAIL' | 'PHONE'
   */
  async sendVerification(
    userId:  string,
    channel: 'EMAIL' | 'PHONE',
  ): Promise<{ success: true; maskedRecipient: string }> {
    const res = await api.http.post(
      '/auth/v2/send-verification',
      { userId, channel },
    );
    return res.data as { success: true; maskedRecipient: string };
  },

  /**
   * Vérification contact (email ou téléphone)
   */
  async verifyContact(
    userId:  string,
    code:    string,
    channel: 'EMAIL' | 'PHONE',
  ): Promise<VerifyContactResult> {
    const res = await api.http.post<VerifyContactResult>(
      '/auth/v2/verify-contact',
      { userId, code, channel },
    );
    return res.data;
  },

  /**
   * Statut de vérification d'un utilisateur
   */
  async getVerificationStatus(userId: string): Promise<VerificationStatus> {
    const res = await api.http.get<VerificationStatus>(
      `/auth/v2/verification-status/${userId}`,
    );
    return res.data;
  },

  /** Extrait un message lisible d'une erreur axios */
  extractMessage,
};