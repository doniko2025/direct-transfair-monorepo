import {
  expandPermissions,
  hasPermission,
  sanitizePermissions,
  SUPPORT_PERMISSIONS,
  SUPPORT_PERMISSION_META,
} from './support-permissions';

describe('support-permissions', () => {
  it('le catalogue décrit chaque clé exactement une fois', () => {
    expect(SUPPORT_PERMISSION_META.map((m) => m.key).sort()).toEqual([...SUPPORT_PERMISSIONS].sort());
  });

  it('sanitize : ignore les clés inconnues, les doublons et les types invalides', () => {
    expect(sanitizePermissions(['KYC_REVIEW', 'KYC_REVIEW', 'HACK', 3, null])).toEqual(['KYC_REVIEW']);
    expect(sanitizePermissions('KYC_REVIEW')).toEqual([]);
    expect(sanitizePermissions(undefined)).toEqual([]);
  });

  it('expand : ajoute les délégations impliquées (transitif)', () => {
    expect(expandPermissions(['DISPUTES_RESOLVE'])).toEqual(['TICKETS_HANDLE', 'DISPUTES_RESOLVE', 'TRANSACTIONS_VIEW'].sort(
      (a, b) => SUPPORT_PERMISSIONS.indexOf(a as never) - SUPPORT_PERMISSIONS.indexOf(b as never),
    ));
    expect(expandPermissions(['KYC_REVIEW'])).toEqual(['CLIENTS_VIEW', 'KYC_REVIEW']);
    expect(expandPermissions([])).toEqual([]);
  });

  it('hasPermission : un admin a tout, un support seulement ce qui est activé, les autres rôles rien', () => {
    expect(hasPermission({ role: 'COMPANY_ADMIN' }, 'REFUNDS_DECIDE')).toBe(true);
    expect(hasPermission({ role: 'SUPER_ADMIN' }, 'KYC_REVIEW')).toBe(true);
    expect(hasPermission({ role: 'SUPPORT', permissions: ['KYC_REVIEW'] }, 'KYC_REVIEW')).toBe(true);
    expect(hasPermission({ role: 'SUPPORT', permissions: ['KYC_REVIEW'] }, 'ACCOUNT_SUSPEND')).toBe(false);
    expect(hasPermission({ role: 'SUPPORT' }, 'KYC_REVIEW')).toBe(false);
    expect(hasPermission({ role: 'AGENT', permissions: ['KYC_REVIEW'] }, 'KYC_REVIEW')).toBe(false);
    expect(hasPermission({ role: 'USER' }, 'CLIENTS_VIEW')).toBe(false);
    expect(hasPermission(null, 'CLIENTS_VIEW')).toBe(false);
  });
});
