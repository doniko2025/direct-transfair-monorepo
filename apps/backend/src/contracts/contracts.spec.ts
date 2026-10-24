// apps/backend/src/contracts/contracts.spec.ts
import 'reflect-metadata';
import { BadRequestException, ConflictException, GoneException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { SignContractDto } from './dto/contract.dto';
import { ContractsService } from './contracts.service';
import { buildContract, normalizeTerms } from './contract-templates';
import { renderContractPdf } from './contract-pdf';
import { formatMoney, newSignToken, pdfText, sha256Hex, stableStringify } from './contract-format';

const customer = {
  name: 'Flash Transfer', legalName: 'Flash Transfer SARL', address: '12 avenue de la Paix', city: 'Dakar', country: 'SN',
  email: 'patron@flash.sn', representativeName: 'Aminata Diallo',
};

// PNG 200×50 transparent minimal mais valide (> 300 octets une fois rempli de bruit : on fabrique un PNG réel ci-dessous)
function fakePng(size = 400): string {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const body = Buffer.alloc(size, 7);
  return `data:image/png;base64,${Buffer.concat([head, body]).toString('base64')}`;
}

describe('modèles de contrat', () => {
  const rental = () =>
    buildContract({
      kind: 'RENTAL', reference: 'CT-2026-0001', issuedAt: new Date('2026-10-24T08:00:00Z'), customer,
      terms: normalizeTerms('RENTAL', { amount: 149, currency: 'EUR', billingPeriod: 'MONTHLY', commitmentMonths: 12, effectiveDate: '2026-11-01' }),
    });
  const purchase = (maintenance?: number) =>
    buildContract({
      kind: 'PURCHASE', reference: 'CT-2026-0002', issuedAt: new Date('2026-10-24T08:00:00Z'), customer,
      terms: normalizeTerms('PURCHASE', { amount: 4900, currency: 'EUR', maintenanceFeeYearly: maintenance, effectiveDate: '2026-11-01' }),
    });

  it('location : titre, redevance, engagement et articles numérotés', () => {
    const c = rental();
    expect(c.title).toMatch(/LOCATION/);
    const text = JSON.stringify(c);
    expect(text).toContain('149 €');
    expect(text).toContain('12 mois');
    expect(c.articles.map((a) => a.number)).toEqual(c.articles.map((_, i) => i + 1));
    expect(c.articles.length).toBeGreaterThanOrEqual(15);
    expect(c.customer.name).toBe('Flash Transfer SARL');
    expect(c.customer.lines.join(' ')).toContain('Sénégal');
  });

  it('achat : prix forfaitaire, licence perpétuelle, maintenance seulement si renseignée', () => {
    const sans = JSON.stringify(purchase());
    expect(sans).toContain('4 900 €');
    expect(sans).toMatch(/perpétuelle/);
    expect(sans).toContain('Non inclus');
    const avec = JSON.stringify(purchase(600));
    expect(avec).toContain('600 €');
    expect(avec).not.toContain('Non inclus');
  });

  it("les deux modèles n'ont pas le même texte", () => {
    expect(stableStringify(rental().articles)).not.toBe(stableStringify(purchase().articles));
  });

  it('empreinte stable (indépendante de l\'ordre des clés) et sensible au moindre changement', () => {
    expect(sha256Hex(stableStringify({ b: 1, a: 2 }))).toBe(sha256Hex(stableStringify({ a: 2, b: 1 })));
    expect(sha256Hex(stableStringify({ a: 1 }))).not.toBe(sha256Hex(stableStringify({ a: 2 })));
  });

  it('formatage : pas de caractère hors police PDF', () => {
    expect(formatMoney(1500.5, 'EUR')).toBe('1 500,50 €');
    expect(pdfText('a b c‑d')).toBe('a b c-d');
    expect(pdfText('Łukasz')).toMatch(/^[\x20-\xff]+$/);
  });
});

describe('PDF du contrat', () => {
  const content = buildContract({
    kind: 'RENTAL', reference: 'CT-2026-0001', issuedAt: new Date(), customer,
    terms: normalizeTerms('RENTAL', { amount: 149, currency: 'EUR', effectiveDate: '2026-11-01' }),
  });

  it('produit un vrai PDF, plus long une fois signé (certificat de signature)', async () => {
    const preview = await renderContractPdf(content, null);
    expect(preview.subarray(0, 5).toString()).toBe('%PDF-');
    const signed = await renderContractPdf(content, {
      signedAt: new Date(), signerName: 'Aminata Diallo', signerEmail: 'patron@flash.sn', signerIp: '203.0.113.7',
      signerUserAgent: 'test', signaturePng: null, contentHash: 'a'.repeat(64),
    });
    expect(signed.subarray(0, 5).toString()).toBe('%PDF-');
    expect(signed.length).toBeGreaterThan(preview.length - 2000);
  }, 20000);
});

describe('ContractsService', () => {
  const clientRow = {
    id: 7, name: 'Flash Transfer', legalCompanyName: null, address: '1 rue X', ownerAddress: null, city: 'Dakar', country: 'SN',
    email: 'patron@flash.sn', contactEmail: null, ownerFirstName: 'Aminata', ownerLastName: 'Diallo', representativeName: null,
    subscriptionType: 'RENTAL', deletedAt: null,
  };

  function make(overrides: { pending?: any; stored?: any } = {}) {
    const store: { row: any } = { row: overrides.stored ?? null };
    const prisma: any = {
      client: { findFirst: jest.fn().mockResolvedValue(clientRow) },
      contract: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(overrides.pending ?? null),
        create: jest.fn(async ({ data }: any) => {
          store.row = { id: 'c1', ...data, status: 'PENDING', client: { name: 'Flash Transfer' }, signedPdf: null, signedAt: null, clientId: 7 };
          return { id: 'c1', reference: data.reference };
        }),
        findUnique: jest.fn(async () => store.row),
        updateMany: jest.fn(async ({ data }: any) => {
          if (!store.row || store.row.status !== 'PENDING') return { count: 0 };
          Object.assign(store.row, data);
          return { count: 1 };
        }),
        update: jest.fn(async ({ data }: any) => Object.assign(store.row ?? {}, data)),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const mail: any = {
      sendSignatureRequest: jest.fn().mockResolvedValue(undefined),
      sendSignedContract: jest.fn().mockResolvedValue(undefined),
      sendSignedCopyToProvider: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new ContractsService(prisma, mail), prisma, mail, store };
  }

  const terms = { amount: 149, currency: 'EUR', effectiveDate: '2026-11-01' };
  beforeEach(() => {
    process.env.PLATFORM_APP_URL = 'https://app.example.com';
    process.env.CONTRACT_COPY_EMAIL = 'grandchef@example.com';
  });

  it("émet un contrat : lien à jeton, seul le hash du jeton est stocké, e-mail envoyé si notify", async () => {
    const { service, prisma, mail } = make();
    const issued = await service.issue({ clientId: 7, terms, notify: true });
    expect(issued.signUrl).toBe(`https://app.example.com/signature/${issued.token}`);
    const data = prisma.contract.create.mock.calls[0][0].data;
    expect(data.signTokenHash).toBe(sha256Hex(issued.token));
    expect(JSON.stringify(data)).not.toContain(issued.token);
    expect(data.type).toBe('RENTAL');
    expect(data.recipientEmail).toBe('patron@flash.sn');
    expect(mail.sendSignatureRequest).toHaveBeenCalledTimes(1);
    expect(mail.sendSignatureRequest.mock.calls[0][0].url).toBe(issued.signUrl);
  });

  it("notify=false : aucun e-mail (le lien est joint au courriel de bienvenue par ClientsService)", async () => {
    const { service, mail } = make();
    await service.issue({ clientId: 7, terms, notify: false });
    expect(mail.sendSignatureRequest).not.toHaveBeenCalled();
  });

  it('refuse un montant absent / nul, et un second contrat tant qu\'un contrat est en attente', async () => {
    const a = make();
    await expect(a.service.issue({ clientId: 7, terms: { currency: 'EUR' }, notify: false })).rejects.toBeInstanceOf(BadRequestException);
    await expect(a.service.issue({ clientId: 7, terms: { ...terms, amount: 0 }, notify: false })).rejects.toBeInstanceOf(BadRequestException);
    const b = make({ pending: { reference: 'CT-2026-0009' } });
    await expect(b.service.issue({ clientId: 7, terms, notify: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it('signature : PDF signé conservé, statut SIGNED, e-mail au signataire + copie au Prestataire', async () => {
    const { service, mail, store } = make();
    const issued = await service.issue({ clientId: 7, terms, notify: false });
    const res = await service.sign(issued.token, { signerName: 'Aminata Diallo', signature: fakePng(), accept: true }, { ip: '203.0.113.7', userAgent: 'jest' });
    expect(res.status).toBe('SIGNED');
    expect(store.row.status).toBe('SIGNED');
    expect(store.row.signerIp).toBe('203.0.113.7');
    expect(Buffer.from(store.row.signedPdf).subarray(0, 5).toString()).toBe('%PDF-');
    expect(store.row.signedPdfHash).toBe(sha256Hex(Buffer.from(store.row.signedPdf)));
    // e-mails partis en arrière-plan
    await new Promise((r) => setTimeout(r, 50));
    expect(mail.sendSignedContract).toHaveBeenCalledTimes(1);
    expect(mail.sendSignedContract.mock.calls[0][0].email).toBe('patron@flash.sn');
    expect(mail.sendSignedContract.mock.calls[0][0].pdf.length).toBeGreaterThan(1000);
    expect(mail.sendSignedCopyToProvider.mock.calls[0][0].to).toBe('grandchef@example.com');
  }, 20000);

  it('une seconde signature est refusée (déjà signé)', async () => {
    const { service } = make();
    const issued = await service.issue({ clientId: 7, terms, notify: false });
    const body = { signerName: 'Aminata Diallo', signature: fakePng(), accept: true };
    await service.sign(issued.token, body, {});
    await expect(service.sign(issued.token, body, {})).rejects.toBeInstanceOf(ConflictException);
  }, 20000);

  it('refuse : case non cochée, nom trop court, signature invalide, lien inconnu, lien expiré, contrat annulé', async () => {
    const { service, store } = make();
    const issued = await service.issue({ clientId: 7, terms, notify: false });
    const ok = { signerName: 'Aminata Diallo', signature: fakePng(), accept: true };
    await expect(service.sign(issued.token, { ...ok, accept: false }, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sign(issued.token, { ...ok, signerName: 'A ' }, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sign(issued.token, { ...ok, signature: 'data:image/png;base64,AAAA' }, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sign(issued.token, { ...ok, signature: 'javascript:alert(1)' }, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getPublic('x'.repeat(10))).rejects.toBeInstanceOf(NotFoundException);

    store.row.tokenExpiresAt = new Date(Date.now() - 1000);
    expect((await service.getPublic(issued.token)).status).toBe('EXPIRED');
    await expect(service.sign(issued.token, ok, {})).rejects.toBeInstanceOf(GoneException);

    store.row.tokenExpiresAt = new Date(Date.now() + 100000);
    store.row.status = 'CANCELLED';
    await expect(service.sign(issued.token, ok, {})).rejects.toBeInstanceOf(GoneException);
  }, 20000);

  it('renvoyer le lien : nouveau jeton, l\'ancien ne fonctionne plus, un contrat signé ne peut pas être renvoyé', async () => {
    const { service, store } = make();
    const issued = await service.issue({ clientId: 7, terms, notify: false });
    const oldHash = store.row.signTokenHash;
    const r = await service.resendLink('c1', 'u1');
    expect(r.signUrl).toMatch(/^https:\/\/app\.example\.com\/signature\//);
    expect(store.row.signTokenHash).not.toBe(oldHash);
    expect(sha256Hex(issued.token)).toBe(oldHash);
    store.row.status = 'SIGNED';
    await expect(service.resendLink('c1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.cancel('c1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('jetons : 256 bits, uniques, hash SHA-256', () => {
    const a = newSignToken();
    const b = newSignToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(a.hash).toBe(sha256Hex(a.token));
  });
});

describe('validation des DTO (ValidationPipe globale)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false });
  const base = { code: 'FLASH', name: 'Flash', adminEmail: 'a@b.test', adminFirstName: 'A', adminLastName: 'B', adminPassword: 'x'.repeat(12) };

  it('création de société : les conditions du contrat sont conservées (et converties en nombres)', async () => {
    const out: any = await pipe.transform({ ...base, contract: { amount: '149', currency: 'EUR', commitmentMonths: '12', billingPeriod: 'MONTHLY' } }, { type: 'body', metatype: CreateClientDto });
    expect(out.contract).toMatchObject({ amount: 149, currency: 'EUR', commitmentMonths: 12, billingPeriod: 'MONTHLY' });
  });

  it('refuse un montant nul, une devise inconnue, une périodicité inconnue', async () => {
    for (const contract of [{ amount: 0, currency: 'EUR' }, { amount: 10, currency: 'ZZZ' }, { amount: 10, currency: 'EUR', billingPeriod: 'DAILY' }]) {
      await expect(pipe.transform({ ...base, contract }, { type: 'body', metatype: CreateClientDto })).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('signature : la case « lu et approuvé » doit être vraie', async () => {
    const meta = { type: 'body' as const, metatype: SignContractDto };
    await expect(pipe.transform({ signerName: 'Aminata Diallo', signature: 'x', accept: false }, meta)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ signerName: 'Aminata Diallo', signature: 'x', accept: true }, meta)).resolves.toBeDefined();
  });
});
