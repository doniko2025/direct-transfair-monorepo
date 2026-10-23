// apps/backend/src/treasury/treasury.audit-fixes.spec.ts
// Trésorerie v5.6 : idempotence des opérations, interrupteur ALLOW_SELF_FUNDING.
import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import { assertSelfFundingAllowed, selfFundingEnabled } from './self-funding';

function make() {
  const store = new Map<string, any>();
  const k = (w: any) => `${w.userId_key.userId}|${w.userId_key.key}`;
  const prisma: any = {
    idempotencyRecord: {
      create: jest.fn(async ({ data }: any) => {
        const id = `${data.userId}|${data.key}`;
        if (store.has(id)) throw Object.assign(new Error('dup'), { code: 'P2002' });
        store.set(id, { ...data, response: null });
      }),
      findUnique: jest.fn(async ({ where }: any) => store.get(k(where)) ?? null),
      update: jest.fn(async ({ where, data }: any) => { Object.assign(store.get(k(where)), data); }),
      delete: jest.fn(async ({ where }: any) => { store.delete(k(where)); }),
    },
  };
  return { service: new TreasuryService(prisma, {} as any, {} as any), prisma, store };
}

describe('TreasuryService.runIdempotent', () => {
  it('sans clé : exécute à chaque fois', async () => {
    const { service } = make();
    const job = jest.fn().mockResolvedValue({ ok: 1 });
    await service.runIdempotent('u1', null, 'X', job);
    await service.runIdempotent('u1', null, 'X', job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it('même clé : le job ne tourne qu\'une fois, la réponse de la première est rejouée', async () => {
    const { service } = make();
    const job = jest.fn().mockResolvedValue({ credited: 500 });
    const a = await service.runIdempotent('u1', 'key-12345678', 'TREASURY_INJECT', job);
    const b = await service.runIdempotent('u1', 'key-12345678', 'TREASURY_INJECT', job);
    expect(job).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it('la même clé pour deux utilisateurs différents ne se mélange pas', async () => {
    const { service } = make();
    const job = jest.fn().mockResolvedValue({ ok: true });
    await service.runIdempotent('u1', 'key-12345678', 'S', job);
    await service.runIdempotent('u2', 'key-12345678', 'S', job);
    expect(job).toHaveBeenCalledTimes(2);
  });

  it('même clé pour une autre route → 409', async () => {
    const { service } = make();
    await service.runIdempotent('u1', 'key-12345678', 'TREASURY_INJECT', async () => ({ ok: true }));
    await expect(service.runIdempotent('u1', 'key-12345678', 'TREASURY_WITHDRAW', async () => ({ ok: true }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('exécution encore en cours (pas de réponse) → 409, le job ne repart pas', async () => {
    const { service } = make();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const slow = jest.fn(async () => { await gate; return { ok: true }; });
    const first = service.runIdempotent('u1', 'key-12345678', 'S', slow);
    await new Promise((r) => setImmediate(r));
    await expect(service.runIdempotent('u1', 'key-12345678', 'S', slow)).rejects.toBeInstanceOf(ConflictException);
    release();
    await first;
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('job en échec : la clé est libérée, un nouvel essai est possible', async () => {
    const { service } = make();
    await expect(service.runIdempotent('u1', 'key-12345678', 'S', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const job = jest.fn().mockResolvedValue({ ok: true });
    await service.runIdempotent('u1', 'key-12345678', 'S', job);
    expect(job).toHaveBeenCalledTimes(1);
  });
});

describe('ALLOW_SELF_FUNDING', () => {
  afterEach(() => { delete process.env.ALLOW_SELF_FUNDING; });

  it('ouvert par défaut (comportement historique)', () => {
    expect(selfFundingEnabled()).toBe(true);
    expect(() => assertSelfFundingAllowed()).not.toThrow();
  });

  it('ALLOW_SELF_FUNDING=false → 403', () => {
    process.env.ALLOW_SELF_FUNDING = 'false';
    expect(selfFundingEnabled()).toBe(false);
    expect(() => assertSelfFundingAllowed()).toThrow(ForbiddenException);
  });

  it('toute autre valeur laisse ouvert', () => {
    process.env.ALLOW_SELF_FUNDING = 'true';
    expect(selfFundingEnabled()).toBe(true);
  });
});
