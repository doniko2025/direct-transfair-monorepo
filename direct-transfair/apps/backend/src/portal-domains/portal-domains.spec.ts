// apps/backend/src/portal-domains/portal-domains.spec.ts
// Domaines des portails de sociétés : règles de nommage, machine d'états, conflits, échecs, planification.
// Cloudflare, Vercel et la base sont simulés : aucun appel réseau.
import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PortalDomainsController } from './portal-domains.controller';
import { integrationState } from './portal-domains.config';
import { DomainRuleError, hostVariants, normalizeHost, planCustomDomain, planSubdomain, registrableDomain } from './portal-domains.rules';
import { PortalDomainsService, planOfRecord, retryDelayMs, safeMessage, toView } from './portal-domains.service';
import { ProviderError } from './providers/cloudflare.client';

const ENV_KEYS = [
  'PORTAL_BASE_DOMAIN', 'VERCEL_API_TOKEN', 'PORTAL_VERCEL_PROJECT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_EMAIL',
  'CLOUDFLARE_GLOBAL_KEY', 'PLATFORM_CONSOLE_HOSTS', 'PORTAL_RESERVED_SUBDOMAINS', 'PORTAL_DNS_A_TARGET',
  'PORTAL_DNS_CNAME_TARGET', 'PORTAL_DOMAINS_MAX_ATTEMPTS',
] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  process.env.PORTAL_BASE_DOMAIN = 'dkmoney.store';
  process.env.VERCEL_API_TOKEN = 'vt';
  process.env.PORTAL_VERCEL_PROJECT_ID = 'prj_1';
  process.env.CLOUDFLARE_API_TOKEN = 'ct';
  process.env.PLATFORM_CONSOLE_HOSTS = 'dkmoney.store,www.dkmoney.store';
});
afterEach(() => ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));

// ───────────────────────── Règles pures ─────────────────────────

describe('normalizeHost / validation', () => {
  it('nettoie protocole, chemin, port, point final et casse', () => {
    expect(normalizeHost(' HTTPS://Flash-Transfer.COM:443/login?x=1 ')).toBe('flash-transfer.com');
    expect(normalizeHost('www.flash.com.')).toBe('www.flash.com');
  });
  it('convertit un nom accentué en punycode', () => {
    expect(normalizeHost('société.fr')).toBe('xn--socit-esab.fr');
  });
  it('refuse vide, espaces et arobase', () => {
    expect(() => normalizeHost('')).toThrow(DomainRuleError);
    expect(() => normalizeHost('a b.com')).toThrow(DomainRuleError);
    expect(() => normalizeHost('x@y.com')).toThrow(DomainRuleError);
  });
});

describe('registrableDomain', () => {
  it('prend les deux derniers libellés, ou trois pour un suffixe à deux niveaux', () => {
    expect(registrableDomain('admin.ma-societe.com')).toBe('ma-societe.com');
    expect(registrableDomain('ma-societe.com')).toBe('ma-societe.com');
    expect(registrableDomain('portail.flash.co.uk')).toBe('flash.co.uk');
    expect(registrableDomain('flash.com.gn')).toBe('flash.com.gn');
  });
});

describe('planCustomDomain', () => {
  it('domaine nu : rattache le nu et www, enregistrements A + CNAME www', () => {
    const p = planCustomDomain('flash-transfer.com');
    expect(p).toMatchObject({ kind: 'CUSTOM', host: 'flash-transfer.com', zoneName: 'flash-transfer.com', customDomain: 'flash-transfer.com', subdomainLabel: null });
    expect(p.attachHosts).toEqual(['flash-transfer.com', 'www.flash-transfer.com']);
    expect(p.records).toEqual([{ type: 'A', name: 'flash-transfer.com' }, { type: 'CNAME', name: 'www.flash-transfer.com' }]);
  });
  it('« www.x » saisi pour le domaine nu devient le domaine nu', () => {
    expect(planCustomDomain('www.flash-transfer.com').host).toBe('flash-transfer.com');
  });
  it('sous-domaine d’un domaine propre : un seul CNAME, zone = domaine enregistrable', () => {
    const p = planCustomDomain('admin.ma-societe.com');
    expect(p).toMatchObject({ host: 'admin.ma-societe.com', zoneName: 'ma-societe.com' });
    expect(p.attachHosts).toEqual(['admin.ma-societe.com']);
    expect(p.records).toEqual([{ type: 'CNAME', name: 'admin.ma-societe.com' }]);
  });
  it('zone forcée : acceptée si elle contient l’hôte, refusée sinon', () => {
    expect(planCustomDomain('a.b.exemple.org', 'b.exemple.org').zoneName).toBe('b.exemple.org');
    expect(() => planCustomDomain('a.b.exemple.org', 'autre.org')).toThrow(DomainRuleError);
  });
  it.each([
    ['une adresse IP', '192.168.1.10'],
    ['un seul libellé', 'localhost'],
    ['une extension numérique', 'exemple.123'],
    ['un tiret en tête de libellé', '-x.com'],
    ['un domaine de la console', 'dkmoney.store'],
    ['un sous-domaine de la console', 'x.dkmoney.store'],
    ['le site vitrine', 'direct-transfair.eu'],
    ['un hébergeur', 'mon-portail.vercel.app'],
  ])('refuse %s', (_label, value) => {
    expect(() => planCustomDomain(value)).toThrow(DomainRuleError);
  });
});

describe('planSubdomain', () => {
  it('construit <libellé>.<domaine de plateforme> avec un seul CNAME', () => {
    const p = planSubdomain('Flash'.toLowerCase());
    expect(p).toMatchObject({ kind: 'SUBDOMAIN', host: 'flash.dkmoney.store', zoneName: 'dkmoney.store', subdomainLabel: 'flash', customDomain: null });
    expect(p.records).toEqual([{ type: 'CNAME', name: 'flash.dkmoney.store' }]);
  });
  it('refuse les libellés réservés, trop courts ou mal formés', () => {
    expect(() => planSubdomain('console')).toThrow(/réservé/);
    expect(() => planSubdomain('ab')).toThrow(DomainRuleError);
    expect(() => planSubdomain('-abc')).toThrow(DomainRuleError);
    expect(() => planSubdomain('a.b.c')).toThrow(DomainRuleError);
  });
  it('la liste des libellés réservés est configurable', () => {
    process.env.PORTAL_RESERVED_SUBDOMAINS = 'flash';
    expect(() => planSubdomain('flash')).toThrow(/réservé/);
    expect(() => planSubdomain('console')).not.toThrow();
  });
  it('sans PORTAL_BASE_DOMAIN : désactivé', () => {
    delete process.env.PORTAL_BASE_DOMAIN;
    expect(() => planSubdomain('flash')).toThrow(/PORTAL_BASE_DOMAIN/);
  });
});

describe('divers', () => {
  it('hostVariants : nu et www, sans doublon', () => {
    expect(hostVariants('www.x.com').sort()).toEqual(['www.x.com', 'x.com']);
    expect(hostVariants('x.com').sort()).toEqual(['www.x.com', 'x.com']);
  });
  it('retryDelayMs double à chaque échec et plafonne à 6 h', () => {
    expect(retryDelayMs(0)).toBe(5 * 60_000);
    expect(retryDelayMs(1)).toBe(10 * 60_000);
    expect(retryDelayMs(3)).toBe(40 * 60_000);
    expect(retryDelayMs(50)).toBe(6 * 3_600_000);
  });
  it('safeMessage : une ligne, 400 caractères au plus', () => {
    expect(safeMessage(new Error('a\n b'))).toBe('a b');
    expect(safeMessage(new Error('x'.repeat(900))).length).toBe(400);
  });
  it('integrationState reflète les variables', () => {
    expect(integrationState()).toMatchObject({ vercel: true, cloudflare: true, subdomains: true, baseDomain: 'dkmoney.store' });
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(integrationState()).toMatchObject({ cloudflare: false, subdomains: false });
    process.env.CLOUDFLARE_EMAIL = 'a@b.c'; process.env.CLOUDFLARE_GLOBAL_KEY = 'k';
    expect(integrationState().cloudflare).toBe(true);
  });
});

// ───────────────────────── Service (faux Prisma / faux fournisseurs) ─────────────────────────

type Client = { id: number; code: string; name: string; isActive: boolean; deletedAt: Date | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null; subscriptionStatus: string; subdomain: string | null; customDomain: string | null };

function makeWorld() {
  const clients: Client[] = [1, 2, 3].map((id) => ({
    id, code: id === 3 ? 'DONIKO' : `CO${id}`, name: `Société ${id}`, isActive: true, deletedAt: null, logoUrl: null,
    primaryColor: '#059669', secondaryColor: '#10B981', subscriptionStatus: 'ACTIVE', subdomain: null, customDomain: null,
  }));
  let rows: any[] = [];
  let seq = 1;
  const audits: any[] = [];

  const clientMatches = (c: Client, where: any): boolean => {
    if (where.id?.not !== undefined && c.id === where.id.not) return false;
    if (where.id !== undefined && typeof where.id === 'number' && c.id !== where.id) return false;
    if (where.OR) {
      return where.OR.some((o: any) =>
        (o.customDomain?.in && c.customDomain && o.customDomain.in.includes(c.customDomain)) ||
        (typeof o.subdomain === 'string' && c.subdomain === o.subdomain));
    }
    return true;
  };

  const prisma: any = {
    client: {
      findUnique: jest.fn(async ({ where }: any) => clients.find((c) => c.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) => clients.find((c) => clientMatches(c, where)) ?? null),
      findMany: jest.fn(async () => clients.filter((c) => c.code !== 'DONIKO')),
      update: jest.fn(async ({ where, data }: any) => { Object.assign(clients.find((c) => c.id === where.id)!, data); }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = clients.filter((c) =>
          c.id === where.id && (where.subdomain === undefined || c.subdomain === where.subdomain) &&
          (where.customDomain?.in === undefined || (c.customDomain && where.customDomain.in.includes(c.customDomain))));
        hit.forEach((c) => Object.assign(c, data));
        return { count: hit.length };
      }),
    },
    clientPortalDomain: {
      findUnique: jest.fn(async ({ where }: any) => { const r = rows.find((x) => x.clientId === where.clientId); return r ? { ...r } : null; }),
      findMany: jest.fn(async () => rows.map((r) => ({ ...r }))),
      findFirst: jest.fn(async ({ where }: any) => rows.find((r) => r.clientId !== where.clientId.not && where.host.in.includes(r.host)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: seq++, nameServers: [], zoneId: null, status: 'PENDING_NAMESERVERS', lastError: null, attempts: 0, lastCheckedAt: null, activatedAt: null, leaseUntil: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.clientId === where.clientId)!;
        for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'set' in (v as any) ? (v as any).set : v;
        return { ...row };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const now = new Date();
        const hit = rows.filter((r) => r.clientId === where.clientId && (r.leaseUntil === null || r.leaseUntil < now));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
      delete: jest.fn(async ({ where }: any) => { rows = rows.filter((r) => r.clientId !== where.clientId); }),
    },
    auditLog: { create: jest.fn(async ({ data }: any) => { audits.push(data); }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const zones: Record<string, any> = {};
  const cf: any = {
    findZone: jest.fn(async (n: string) => zones[n] ?? null),
    ensureZone: jest.fn(async (n: string) => (zones[n] ??= { id: `z_${n}`, name: n, status: 'pending', name_servers: ['a.ns.cloudflare.com', 'b.ns.cloudflare.com'] })),
    upsertRecord: jest.fn(async () => undefined),
    deleteRecord: jest.fn(async () => undefined),
  };
  const vercelState = { verified: true, misconfigured: false, verification: undefined as any };
  const vercel: any = {
    addDomain: jest.fn(async (h: string) => ({ name: h, verified: vercelState.verified })),
    getDomain: jest.fn(async (h: string) => ({ name: h, verified: vercelState.verified, verification: vercelState.verification })),
    isMisconfigured: jest.fn(async () => vercelState.misconfigured),
    removeDomain: jest.fn(async () => undefined),
  };
  zones['dkmoney.store'] = { id: 'z_base', name: 'dkmoney.store', status: 'active', name_servers: [] };

  const service = new PortalDomainsService(prisma, cf, vercel);
  return { service, prisma, cf, vercel, vercelState, zones, clients, audits, rows: () => rows };
}

describe('PortalDomainsService — sous-domaine de la plateforme', () => {
  it('pose le CNAME, rattache à Vercel et passe ACTIVE ; Client.subdomain est renseigné', async () => {
    const w = makeWorld();
    const res = await w.service.setDomain('u1', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    expect(res.domain).toMatchObject({ host: 'flash.dkmoney.store', status: 'ACTIVE', kind: 'SUBDOMAIN', dnsMode: 'CLOUDFLARE' });
    expect(w.cf.upsertRecord).toHaveBeenCalledWith('z_base', 'CNAME', 'flash.dkmoney.store', 'cname.vercel-dns.com');
    expect(w.vercel.addDomain).toHaveBeenCalledWith('flash.dkmoney.store');
    expect(w.clients[0].subdomain).toBe('flash');
    expect(w.audits[0]).toMatchObject({ action: 'PORTAL_DOMAIN_SET', clientId: 1, userId: 'u1' });
    expect(w.rows()[0].activatedAt).toBeInstanceOf(Date);
  });

  it('ne crée JAMAIS la zone de la plateforme : zone absente ⇒ FAILED avec un message clair', async () => {
    const w = makeWorld();
    delete w.zones['dkmoney.store'];
    const res = await w.service.setDomain('u1', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    expect(res.domain).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(res.domain!.lastError).toMatch(/introuvable/);
    expect(w.cf.ensureZone).not.toHaveBeenCalled();
  });

  it('libellé réservé ⇒ 400 ; libellé pris par une autre société ⇒ 409', async () => {
    const w = makeWorld();
    await expect(w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'console' })).rejects.toBeInstanceOf(BadRequestException);
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    await expect(w.service.setDomain('u', 2, { kind: 'SUBDOMAIN', subdomain: 'flash' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('Vercel en attente de validation ⇒ PENDING_VERIFICATION, puis ACTIVE au passage suivant', async () => {
    const w = makeWorld();
    w.vercelState.verified = false;
    const res = await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    expect(res.domain!.status).toBe('PENDING_VERIFICATION');
    w.vercelState.verified = true;
    const next = await w.service.advance(1);
    expect(next!.status).toBe('ACTIVE');
  });
});

describe('PortalDomainsService — domaine propre', () => {
  it('zone Cloudflare en attente : nameservers affichés, aucun DNS ni Vercel touché', async () => {
    const w = makeWorld();
    const res = await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'www.Flash-Transfer.com' });
    expect(res.domain).toMatchObject({ host: 'flash-transfer.com', status: 'PENDING_NAMESERVERS', nameServers: ['a.ns.cloudflare.com', 'b.ns.cloudflare.com'] });
    expect(w.cf.upsertRecord).not.toHaveBeenCalled();
    expect(w.vercel.addDomain).not.toHaveBeenCalled();
    expect(w.clients[0].customDomain).toBe('flash-transfer.com');
  });

  it('zone devenue active : A + CNAME www posés, deux hôtes rattachés, puis ACTIVE', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com' });
    w.zones['flash-transfer.com'].status = 'active';
    const next = await w.service.advance(1);
    expect(next!.status).toBe('ACTIVE');
    expect(w.cf.upsertRecord).toHaveBeenCalledWith('z_flash-transfer.com', 'A', 'flash-transfer.com', '76.76.21.21');
    expect(w.cf.upsertRecord).toHaveBeenCalledWith('z_flash-transfer.com', 'CNAME', 'www.flash-transfer.com', 'cname.vercel-dns.com');
    expect(w.vercel.addDomain.mock.calls.map((c: any[]) => c[0])).toEqual(['flash-transfer.com', 'www.flash-transfer.com']);
  });

  it('cibles DNS configurables', async () => {
    process.env.PORTAL_DNS_A_TARGET = '203.0.113.9';
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com' });
    w.zones['flash-transfer.com'].status = 'active';
    await w.service.advance(1);
    expect(w.cf.upsertRecord).toHaveBeenCalledWith(expect.anything(), 'A', 'flash-transfer.com', '203.0.113.9');
  });

  it('DNS géré par la société : Cloudflare jamais appelé, instructions renvoyées', async () => {
    const w = makeWorld();
    w.vercelState.verified = false;
    const res = await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com', dnsMode: 'EXTERNAL' });
    expect(res.domain).toMatchObject({ status: 'PENDING_VERIFICATION', dnsMode: 'EXTERNAL' });
    expect(res.domain!.dnsInstructions).toEqual([
      { type: 'A', name: 'flash-transfer.com', value: '76.76.21.21' },
      { type: 'CNAME', name: 'www.flash-transfer.com', value: 'cname.vercel-dns.com' },
    ]);
    expect(w.cf.ensureZone).not.toHaveBeenCalled();
    expect(w.cf.findZone).not.toHaveBeenCalled();
  });

  it('Vercel réclame un enregistrement de vérification : message conservé, statut PENDING_VERIFICATION', async () => {
    const w = makeWorld();
    w.vercelState.verified = false;
    w.vercelState.verification = [{ type: 'TXT', domain: '_vercel.flash-transfer.com', value: 'vc-domain-verify=abc' }];
    const res = await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com', dnsMode: 'EXTERNAL' });
    expect(res.domain!.status).toBe('PENDING_VERIFICATION');
    expect(res.domain!.lastError).toContain('_vercel.flash-transfer.com');
  });

  it('refuse un domaine déjà utilisé par une autre société (domaine propre, avec ou sans www)', async () => {
    const w = makeWorld();
    w.clients[1].customDomain = 'www.flash-transfer.com';
    await expect(w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuse les hôtes de la plateforme et la société système', async () => {
    const w = makeWorld();
    await expect(w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'dkmoney.store' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.service.setDomain('u', 3, { kind: 'SUBDOMAIN', subdomain: 'flash' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(w.service.setDomain('u', 99, { kind: 'SUBDOMAIN', subdomain: 'flash' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('intégration absente ⇒ 400 explicite (Vercel, Cloudflare)', async () => {
    const w = makeWorld();
    delete process.env.CLOUDFLARE_API_TOKEN;
    await expect(w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com' })).rejects.toThrow(/Cloudflare/);
    await expect(w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com', dnsMode: 'EXTERNAL' })).resolves.toBeDefined();
    delete process.env.VERCEL_API_TOKEN;
    await expect(w.service.setDomain('u', 2, { kind: 'CUSTOM', domain: 'autre-societe.com', dnsMode: 'EXTERNAL' })).rejects.toThrow(/Vercel/);
  });

  it('remplacer le domaine détache l’ancien de Vercel et met à jour Client', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'ancien.com', dnsMode: 'EXTERNAL' });
    const res = await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'nouveau' });
    expect(w.vercel.removeDomain.mock.calls.map((c: any[]) => c[0])).toEqual(['ancien.com', 'www.ancien.com']);
    expect(w.clients[0]).toMatchObject({ subdomain: 'nouveau', customDomain: null });
    expect(res.domain).toMatchObject({ host: 'nouveau.dkmoney.store', kind: 'SUBDOMAIN' });
    expect(w.rows()).toHaveLength(1);
  });

  it('redéfinir le même domaine ne remet pas le suivi à zéro', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    const before = w.rows()[0].activatedAt;
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    expect(w.rows()[0].activatedAt).toBe(before);
    expect(w.rows()[0].status).toBe('ACTIVE');
  });

  it('collision d’unicité en base (course) ⇒ 409', async () => {
    const w = makeWorld();
    w.prisma.client.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't' }));
    await expect(w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PortalDomainsService — échecs, verrou, contrôle', () => {
  it('erreur d’un fournisseur ⇒ FAILED + message, sans lever ; « Vérifier » remet le compteur à zéro', async () => {
    const w = makeWorld();
    w.vercel.addDomain.mockRejectedValue(new ProviderError('Vercel a refusé la demande : quota'));
    const res = await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    expect(res.domain).toMatchObject({ status: 'FAILED', attempts: 1, lastError: 'Vercel a refusé la demande : quota' });

    w.vercel.addDomain.mockResolvedValue({ name: 'x', verified: true });
    const again = await w.service.recheck('u', 1);
    expect(again.domain.status).toBe('ACTIVE');
    expect(again.domain.attempts).toBe(0);
  });

  it('verrou : un traitement déjà en cours n’est pas doublé', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    w.rows()[0].leaseUntil = new Date(Date.now() + 60_000);
    w.vercel.getDomain.mockClear();
    const res = await w.service.advance(1);
    expect(res).toBeTruthy();
    expect(w.vercel.getDomain).not.toHaveBeenCalled();
  });

  it('un domaine actif devenu mal configuré repasse en PENDING_VERIFICATION, sans toucher au DNS', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    w.cf.upsertRecord.mockClear(); w.vercel.addDomain.mockClear();
    w.vercelState.misconfigured = true;
    const next = await w.service.advance(1, { verifyOnly: true });
    expect(next!.status).toBe('PENDING_VERIFICATION');
    expect(next!.lastError).toMatch(/ne pointe plus/);
    expect(w.cf.upsertRecord).not.toHaveBeenCalled();
    expect(w.vercel.addDomain).not.toHaveBeenCalled();
  });

  it('recheck sans domaine ⇒ 404', async () => {
    const w = makeWorld();
    await expect(w.service.recheck('u', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checkDue : traite les domaines à échéance, ignore les récents et les verrouillés', async () => {
    const w = makeWorld();
    w.vercelState.verified = false;
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' }); // PENDING_VERIFICATION, vérifié à l'instant
    w.vercelState.verified = true;
    w.vercel.getDomain.mockClear();

    const none = await w.service.checkDue(new Date());
    expect(none.examined).toBe(0);

    const later = await w.service.checkDue(new Date(Date.now() + 6 * 60_000));
    expect(later).toMatchObject({ examined: 1, activated: 1, failed: 0 });
    expect(w.rows()[0].status).toBe('ACTIVE');
  });

  it('checkDue : un domaine actif n’est recontrôlé qu’après 24 h, en lecture seule', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    w.cf.upsertRecord.mockClear();
    expect((await w.service.checkDue(new Date(Date.now() + 3_600_000))).examined).toBe(0);
    expect((await w.service.checkDue(new Date(Date.now() + 25 * 3_600_000))).examined).toBe(1);
    expect(w.cf.upsertRecord).not.toHaveBeenCalled();
  });

  it('checkDue : après le nombre maximal d’échecs automatiques, on attend une action manuelle', async () => {
    process.env.PORTAL_DOMAINS_MAX_ATTEMPTS = '2';
    const w = makeWorld();
    w.vercel.addDomain.mockRejectedValue(new ProviderError('boom'));
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' }); // attempts = 1
    const far = new Date(Date.now() + 48 * 3_600_000);
    expect((await w.service.checkDue(far)).failed).toBe(1);                       // attempts = 2
    expect((await w.service.checkDue(new Date(far.getTime() + 48 * 3_600_000))).examined).toBe(0);
  });

  it('checkDue : sans Vercel configuré, ne fait rien', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    delete process.env.VERCEL_API_TOKEN;
    expect(await w.service.checkDue(new Date(Date.now() + 99 * 3_600_000))).toEqual({ examined: 0, activated: 0, failed: 0 });
  });
});

describe('PortalDomainsService — liste et retrait', () => {
  it('list : toutes les sociétés clientes (sans la société système), avec ou sans domaine', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    const list = await w.service.list();
    expect(list.map((i) => i.client.code)).toEqual(['CO1', 'CO2']);
    expect(list[0].domain?.host).toBe('flash.dkmoney.store');
    expect(list[1].domain).toBeNull();
    expect(JSON.stringify(list)).not.toMatch(/leaseUntil|zoneId/);
  });

  it('remove : supprime le suivi, vide Client.subdomain, détache Vercel et retire le CNAME', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    const res = await w.service.remove('u', 1);
    expect(res.domain).toBeNull();
    expect(w.rows()).toHaveLength(0);
    expect(w.clients[0].subdomain).toBeNull();
    expect(w.vercel.removeDomain).toHaveBeenCalledWith('flash.dkmoney.store');
    expect(w.cf.deleteRecord).toHaveBeenCalledWith('z_base', 'CNAME', 'flash.dkmoney.store');
    expect(w.audits.at(-1)).toMatchObject({ action: 'PORTAL_DOMAIN_REMOVE' });
  });

  it('remove d’un domaine propre : DNS de la société conservé, Vercel détaché, Client.customDomain vidé', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'CUSTOM', domain: 'flash-transfer.com', dnsMode: 'EXTERNAL' });
    await w.service.remove('u', 1);
    expect(w.cf.deleteRecord).not.toHaveBeenCalled();
    expect(w.vercel.removeDomain.mock.calls.map((c: any[]) => c[0])).toEqual(['flash-transfer.com', 'www.flash-transfer.com']);
    expect(w.clients[0].customDomain).toBeNull();
  });

  it('remove : un échec Vercel devient un avertissement, le retrait aboutit', async () => {
    const w = makeWorld();
    await w.service.setDomain('u', 1, { kind: 'SUBDOMAIN', subdomain: 'flash' });
    w.vercel.removeDomain.mockRejectedValue(new ProviderError('indisponible'));
    const res = await w.service.remove('u', 1);
    expect(res.warnings[0]).toMatch(/détaché de Vercel/);
    expect(w.rows()).toHaveLength(0);
  });

  it('remove sans domaine ⇒ 404', async () => {
    await expect(makeWorld().service.remove('u', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('toView n’expose ni verrou ni identifiant de zone', () => {
    const v = toView({ id: 1, clientId: 1, kind: 'SUBDOMAIN', dnsMode: 'CLOUDFLARE', host: 'a.dkmoney.store', zoneName: 'dkmoney.store', zoneId: 'secret-zone', nameServers: [], status: 'ACTIVE', lastError: null, attempts: 0, lastCheckedAt: null, activatedAt: null, leaseUntil: new Date(), createdAt: new Date(), updatedAt: new Date() } as any);
    expect(Object.keys(v)).not.toContain('zoneId');
    expect(Object.keys(v)).not.toContain('leaseUntil');
    expect(planOfRecord({ kind: 'CUSTOM', host: 'x.com', zoneName: 'x.com' }).attachHosts).toEqual(['x.com', 'www.x.com']);
  });
});

describe('PortalDomainsController', () => {
  it('toutes les routes sont réservées au SUPER_ADMIN', () => {
    const roles = Reflect.getMetadata('roles', PortalDomainsController);
    expect(roles).toEqual(['SUPER_ADMIN']);
    expect(Reflect.getMetadata('__guards__', PortalDomainsController)).toHaveLength(2);
  });
});
