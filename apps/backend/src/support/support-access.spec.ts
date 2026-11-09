// apps/backend/src/support/support-access.spec.ts
// Accès du service client : droits lus en base à chaque requête (toggle immédiat), garde de délégations, KYC, bureau d'assistance.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CounterAdminService } from '../kyc/counter-admin.service';
import { KycService } from '../kyc/kyc.service';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './permissions.decorator';
import { SupportDeskService } from './support-desk.service';

type J = Record<string, any>;

const sup = (permissions: string[], clientId = 7) => ({ id: 'sp1', role: 'SUPPORT', clientId, permissions }) as any;

// ── JwtAuthGuard ─────────────────────────────────────────
function jwtGuard(dbUser: J) {
  const jwt = { verify: jest.fn().mockReturnValue({ sub: 'sp1', role: 'SUPPORT', clientId: 7 }) } as any;
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(dbUser) }, userSession: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
  return new JwtAuthGuard(jwt, new Reflector(), prisma);
}
const httpCtx = (req: any, handler: any = function h() {}, cls: any = class C {}): ExecutionContext =>
  ({ getHandler: () => handler, getClass: () => cls, switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

describe('JwtAuthGuard — délégations du service client', () => {
  const base = { deletedAt: null, isSuspended: false, role: 'SUPPORT', clientId: 7, client: { isActive: true } };

  it('req.user.permissions = interrupteurs de la base + délégations impliquées', async () => {
    const req: any = { headers: { authorization: 'Bearer x' } };
    await jwtGuard({ ...base, supportPermissions: ['DISPUTES_RESOLVE', 'BIDON'] }).canActivate(httpCtx(req));
    expect(req.user.permissions).toEqual(['TICKETS_HANDLE', 'DISPUTES_RESOLVE', 'TRANSACTIONS_VIEW']);
  });

  it('un interrupteur coupé agit à la requête suivante (jeton inchangé)', async () => {
    const dbUser = { ...base, supportPermissions: ['KYC_REVIEW'] };
    const guard = jwtGuard(dbUser);
    const r1: any = { headers: { authorization: 'Bearer x' } };
    await guard.canActivate(httpCtx(r1));
    expect(r1.user.permissions).toContain('KYC_REVIEW');
    dbUser.supportPermissions = [];
    const r2: any = { headers: { authorization: 'Bearer x' } };
    await guard.canActivate(httpCtx(r2));
    expect(r2.user.permissions).toEqual([]);
  });

  it('les autres rôles n\'ont aucune délégation, même si la colonne est remplie', async () => {
    const req: any = { headers: { authorization: 'Bearer x' } };
    await jwtGuard({ ...base, role: 'AGENT', supportPermissions: ['KYC_REVIEW'] }).canActivate(httpCtx(req));
    expect(req.user.permissions).toEqual([]);
  });
});

// ── PermissionsGuard ─────────────────────────────────────
describe('PermissionsGuard', () => {
  class Ctl {
    @RequirePermissions('KYC_REVIEW')
    guarded() {}
    free() {}
    @RequirePermissions('REFUNDS_DECIDE', 'DISPUTES_RESOLVE')
    either() {}
  }
  const guard = new PermissionsGuard(new Reflector());
  const run = (method: keyof Ctl, user: any) => guard.canActivate(httpCtx({ user }, Ctl.prototype[method], Ctl));

  it('route non décorée : libre', () => expect(run('free', sup([]))).toBe(true));
  it('support : passe seulement si le toggle est actif', () => {
    expect(run('guarded', sup(['KYC_REVIEW']))).toBe(true);
    expect(() => run('guarded', sup(['CLIENTS_VIEW']))).toThrow(ForbiddenException);
  });
  it('admin : toujours ; agent / client : jamais', () => {
    expect(run('guarded', { role: 'COMPANY_ADMIN' })).toBe(true);
    expect(run('guarded', { role: 'SUPER_ADMIN' })).toBe(true);
    expect(() => run('guarded', { role: 'AGENT', permissions: ['KYC_REVIEW'] })).toThrow(ForbiddenException);
    expect(() => run('guarded', { role: 'USER' })).toThrow(ForbiddenException);
  });
  it('plusieurs délégations : une seule suffit', () => {
    expect(run('either', sup(['DISPUTES_RESOLVE']))).toBe(true);
    expect(() => run('either', sup(['TICKETS_HANDLE']))).toThrow(ForbiddenException);
  });
  it('le code d\'erreur est exploitable par le web', () => {
    try {
      run('guarded', sup([]));
      fail('devait refuser');
    } catch (e: any) {
      expect(e.getResponse()).toMatchObject({ code: 'PERMISSION_REQUIRED', statusCode: 403 });
    }
  });
});

// ── KYC ──────────────────────────────────────────────────
describe('KYC — service client', () => {
  const prisma: J = { user: { count: jest.fn(async () => 3), findMany: jest.fn(async () => []) }, kycDocument: { count: jest.fn(async () => 1), findFirst: jest.fn(async () => null) } };
  const kyc = new KycService(prisma as any, {} as any);

  it('sans KYC_REVIEW : refusé ; avec : limité à sa société', async () => {
    await expect(kyc.adminStats(sup(['CLIENTS_VIEW']))).rejects.toBeInstanceOf(ForbiddenException);
    await kyc.adminStats(sup(['KYC_REVIEW']));
    expect(prisma.user.count.mock.calls[0][0].where).toMatchObject({ role: 'USER', clientId: 7 });
  });

  it('clients de passage : délégation KYC_COUNTER distincte', async () => {
    const counter = new CounterAdminService({ counterCustomer: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) } } as any);
    await expect(counter.list(sup(['KYC_REVIEW']), {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(counter.list(sup(['KYC_COUNTER']), {})).resolves.toMatchObject({ total: 0 });
  });
});

// ── Bureau d'assistance ──────────────────────────────────
function desk(over: { target?: J | null } = {}) {
  const audits: J[] = [];
  const target = over.target === undefined ? { id: 'c1', role: 'USER', clientId: 7, email: 'c@x.fr', firstName: 'Awa', lastName: 'Diop', isSuspended: false, createdAt: new Date(), kycLevel: 'LEVEL_1' } : over.target;
  const prisma: J = {
    user: { findFirst: jest.fn(async () => target), update: jest.fn(async () => target), count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    userSession: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    transaction: { findMany: jest.fn(async () => []) },
    supportTicket: { count: jest.fn(async () => 0) },
    refundRequest: { count: jest.fn(async () => 0) },
    kycDocument: { count: jest.fn(async () => 0) },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return data; }) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  const notifier = { notifyUser: jest.fn(async () => undefined) };
  return { service: new SupportDeskService(prisma as any, notifier as any, { assessRecallFor: jest.fn(async () => ({ ok: false, reason: 'x' })) } as any), prisma, notifier, audits };
}

describe('SupportDeskService', () => {
  it('suspension : motif obligatoire, sessions fermées, tracée USER_SUSPEND, client prévenu', async () => {
    const { service, prisma, audits, notifier } = desk();
    await expect(service.suspend(sup(['ACCOUNT_SUSPEND']), 'c1', ' ')).rejects.toBeInstanceOf(BadRequestException);
    await service.suspend(sup(['ACCOUNT_SUSPEND']), 'c1', 'Activité suspecte signalée');
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'c1' } });
    expect(audits[0]).toMatchObject({ action: 'USER_SUSPEND', entityId: 'c1', userId: 'sp1' });
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'ACCOUNT_SUSPENDED' }));
  });

  it('seuls les clients (USER) de SA société : un autre compte ou une autre société → 404', async () => {
    await expect(desk({ target: null }).service.suspend(sup(['ACCOUNT_SUSPEND']), 'x', 'motif valable')).rejects.toBeInstanceOf(NotFoundException);
    await expect(desk({ target: { id: 'c9', role: 'USER', clientId: 9, isSuspended: false, email: 'z@z.fr', createdAt: new Date() } }).service.suspend(sup(['ACCOUNT_SUSPEND']), 'c9', 'motif valable')).rejects.toBeInstanceOf(NotFoundException);
    const { prisma, service } = desk();
    await service.clientDetail(sup(['CLIENTS_VIEW']), 'c1');
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({ role: 'USER' });
  });

  it('déjà suspendu / pas suspendu : 409', async () => {
    const suspended = { id: 'c1', role: 'USER', clientId: 7, isSuspended: true, email: 'c@x.fr', createdAt: new Date() };
    await expect(desk({ target: suspended }).service.suspend(sup(['ACCOUNT_SUSPEND']), 'c1', 'motif valable')).rejects.toBeInstanceOf(ConflictException);
    await expect(desk().service.reactivate(sup(['ACCOUNT_REACTIVATE']), 'c1')).rejects.toBeInstanceOf(ConflictException);
    const r = await desk({ target: suspended }).service.reactivate(sup(['ACCOUNT_REACTIVATE']), 'c1');
    expect(r).toBeDefined();
  });

  it('fiche client : opérations et demandes visibles seulement avec les délégations correspondantes', async () => {
    const a = desk();
    const r1 = await a.service.clientDetail(sup(['CLIENTS_VIEW']), 'c1');
    expect(r1.recentTransactions).toBeNull();
    expect(r1.openTickets).toBeNull();
    expect(a.prisma.transaction.findMany).not.toHaveBeenCalled();
    const b = desk();
    const r2 = await b.service.clientDetail(sup(['CLIENTS_VIEW', 'TRANSACTIONS_VIEW', 'TICKETS_HANDLE']), 'c1');
    expect(r2.recentTransactions).toEqual([]);
    expect(r2.openTickets).toBe(0);
  });

  it('compteurs du tableau de bord : uniquement les domaines délégués', async () => {
    const { service } = desk();
    const o = await service.overview(sup(['KYC_REVIEW']));
    expect(o.counts).toMatchObject({ tickets: null, refunds: null });
    expect(o.counts.kyc).toBe(0);
  });
});
