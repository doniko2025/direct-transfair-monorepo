//apps/backend/src/tenants/tenant-context.ts
export type TenantMode = 'single-db' | 'multi-db';

export interface TenantContext {
  code: string; // ex: DONIKO
  clientId: number; // ex: 1
  databaseUrl: string; // ex: postgres://...
  mode: TenantMode;
}
