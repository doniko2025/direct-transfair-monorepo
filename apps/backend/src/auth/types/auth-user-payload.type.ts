// apps/backend/src/auth/types/auth-user-payload.type.ts
import type { Role } from '@prisma/client';

/**
 * Payload qui est attaché à req.user par le JwtAuthGuard.
 * Utilisé partout dans le backend pour récupérer l'utilisateur courant.
 */
export interface AuthUserPayload {
  id: string;
  sub: string;
  email?: string;
  role?: Role | string;
  clientId?: number;
  agencyId?: string | null;
  primaryCurrency?: string | null;
}