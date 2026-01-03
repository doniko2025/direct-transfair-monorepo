// apps/backend/src/auth/types/auth-user-payload.type.ts

/**
 * Shape unique de req.user partout dans l'app.
 * - id: identifiant utilisateur (source JWT)
 * - role/clientId: indispensables pour guards + multi-tenant
 */
export type AuthUserPayload = {
  id: string;
  sub: string; // compat JWT standard
  email?: string;
  role?: string;
  clientId?: number;
};
