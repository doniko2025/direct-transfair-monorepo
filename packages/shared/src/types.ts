// packages/shared/src/types.ts
// =========================================================
// TYPES PARTAGÉS v1.0 — Direct Transf'air
//
// Reflète le contrat réel du backend NestJS :
//   - rôles : enum Role de prisma/schema.prisma
//   - login : POST /auth/v2/login-password (v2-auth.controller.ts)
//   - branding public : GET /branding/by-host et /branding/:code
//
// Les types sont volontairement limités à ce que le web-admin
// consomme aujourd'hui. Chaque phase de portage d'écrans ajoute
// ici les types dont elle a besoin (au lieu de tout recopier du
// mobile d'un coup).
// =========================================================

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'AGENT' | 'USER';

/**
 * Rôles autorisés sur le web. Le rôle USER (client wallet) reste
 * exclusivement sur l'application mobile.
 */
export const WEB_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'AGENT'] as const;
export type WebRole = (typeof WEB_ROLES)[number];

export function isWebRole(role: unknown): role is WebRole {
  return typeof role === 'string' && (WEB_ROLES as readonly string[]).includes(role);
}

// ─── Utilisateur ─────────────────────────────────────────

export interface CompanyRef {
  id?: number;
  code: string;
  name?: string | null;
  logoUrl?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  [key: string]: unknown;
}

export interface AgencyRef {
  id: string | number;
  name?: string | null;
  country?: string | null;
  currency?: string | null;
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  clientId?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  client?: CompanyRef | null;
  agency?: AgencyRef | null;
  [key: string]: unknown;
}

// ─── Connexion ───────────────────────────────────────────

export interface LoginResult {
  access_token: string;
  refresh_token?: string | null;
  user: AuthUser;
}

/** Renvoyé (HTTP 200) quand l'email et/ou le téléphone ne sont pas encore vérifiés. */
export interface VerificationNeeded {
  requiresVerification: true;
  userId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPhone: boolean;
  message: string;
}

export type LoginPasswordResult = LoginResult | VerificationNeeded;

export function isVerificationNeeded(
  result: LoginPasswordResult,
): result is VerificationNeeded {
  return 'requiresVerification' in result && result.requiresVerification === true;
}

export type VerificationChannel = 'EMAIL' | 'PHONE';

export interface VerifyContactResult {
  success: true;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPhone: boolean;
  allVerified: boolean;
}

export interface RefreshResult {
  access_token: string;
  refresh_token?: string | null;
}

// ─── Branding public (une société = un tenant) ───────────

export interface TenantBranding {
  code: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  tagline: string | null;
  fontFamily: string | null;
  welcomeMessage: string | null;
  subdomain: string | null;
  customDomain: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  supportEmail?: string | null;
  [key: string]: unknown;
}
