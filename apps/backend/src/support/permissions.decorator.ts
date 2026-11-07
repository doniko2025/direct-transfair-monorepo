// apps/backend/src/support/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { SupportPermission } from './support-permissions';

export const PERMISSIONS_KEY = 'support_permissions';

/** Délégation(s) requise(s) — au moins une suffit. Les rôles SUPER_ADMIN / COMPANY_ADMIN passent toujours ; les autres rôles sont refusés. */
export const RequirePermissions = (...perms: SupportPermission[]) => SetMetadata(PERMISSIONS_KEY, perms);
