// Confirmation asynchrone d'un facturier : signature obligatoire, rejeu refusé, un connecteur ne règle que ses propres paiements,
// même confirmation reçue deux fois = un seul règlement.
import 'reflect-metadata';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { BillConnectorsService } from './bills.connectors';
import { parseSignatureHeader, signWebhook, verifyWebhook, webhookSecretEnvName, webhookSecretFor } from './bills.webhook';
import { BillsWebhookService } from './bills-webhook.service';

const SECRET = 'a-very-long-shared-secret-123';

describe('bills.webhook — signature', () => {
  const body = JSON.stringify({ reference: 'FAC-X', status: 'COMPLETED' });
  const now = 1_800_000_000;
  const header = (t: number, secret = SECRET, b = body) => `t=${t},v1=${signWebhook(secret, t, b)}`;

  it('nom de variable : clé en majuscules, caractères spéciaux remplacés', () => {
    expect(webhookSecretEnvName('orange-money')).toBe('BILLS_WEBHOOK_SECRET_ORANGE_MONEY');
  });

  it('secret trop court ou absent = pas de webhook', () => {
    expect(webhookSecretFor('x', { BILLS_WEBHOOK_SECRET_X: 'court' } as never)).toBeNull();
    expect(webhookSecretFor('x', {} as never)).toBeNull();
    expect(webhookSecretFor('x', { BILLS_WEBHOOK_SECRET_X: SECRET } as never)).toBe(SECRET);
  });

  it('signature valide acceptée', () => {
    expect(verifyWebhook({ secret: SECRET, header: header(now), rawBody: body, nowSeconds: now })).toEqual({ ok: true });
  });

  it('corps modifié, mauvais secret, en-tête mal formé : refusés', () => {
    expect(verifyWebhook({ secret: SECRET, header: header(now), rawBody: body.replace('COMPLETED', 'FAILED'), nowSeconds: now })).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    expect(verifyWebhook({ secret: SECRET, header: header(now, 'un-autre-secret-0123456'), rawBody: body, nowSeconds: now })).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    expect(verifyWebhook({ secret: SECRET, header: 'n importe quoi', rawBody: body, nowSeconds: now })).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(verifyWebhook({ secret: SECRET, header: undefined, rawBody: body, nowSeconds: now })).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(parseSignatureHeader('t=1,v1=zz')).toBeNull();
  });

  it('rejeu : horodatage de plus de 5 minutes refusé (dans le passé comme dans le futur)', () => {
    expect(verifyWebhook({ secret: SECRET, header: header(now - 301), rawBody: body, nowSeconds: now })).toEqual({ ok: false, reason: 'EXPIRED' });
    expect(verifyWebhook({ secret: SECRET, header: header(now + 301), rawBody: body, nowSeconds: now })).toEqual({ ok: false, reason: 'EXPIRED' });
    expect(verifyWebhook({ secret: SECRET, header: header(now - 299), rawBody: body, nowSeconds: now })).toEqual({ ok: true });
  });
});

describe('BillsWebhookService', () => {
  const OLD = process.env.BILLS_WEBHOOK_SECRET_SANDBOX;
  beforeAll(() => { process.env.BILLS_WEBHOOK_SECRET_SANDBOX = SECRET; });
  afterAll(() => { if (OLD === undefined) delete process.env.BILLS_WEBHOOK_SECRET_SANDBOX; else process.env.BILLS_WEBHOOK_SECRET_SANDBOX = OLD; });

  function make(payment: Record<string, unknown> | null) {
    const prisma: any = { billPayment: { findUnique: jest.fn(async () => payment) } };
    const settlement: any = { complete: jest.fn(async () => ({})), fail: jest.fn(async () => ({})) };
    return { svc: new BillsWebhookService(prisma, settlement, new BillConnectorsService()), settlement };
  }
  const send = (svc: BillsWebhookService, body: Record<string, unknown>, opts: { key?: string; secret?: string; t?: number } = {}) => {
    const raw = Buffer.from(JSON.stringify(body));
    const t = opts.t ?? Math.floor(Date.now() / 1000);
    return svc.handle(opts.key ?? 'sandbox', raw, `t=${t},v1=${signWebhook(opts.secret ?? SECRET, t, raw)}`, body);
  };

  it('COMPLETED : facture réglée avec reçu et jeton', async () => {
    const { svc, settlement } = make({ id: 'p1', status: 'PROCESSING', connectorKey: 'sandbox' });
    await expect(send(svc, { reference: 'FAC-1', status: 'COMPLETED', providerRef: 'OP-7', token: '1234', message: 'ok' })).resolves.toEqual({ ok: true, status: 'COMPLETED' });
    expect(settlement.complete).toHaveBeenCalledWith('p1', { providerRef: 'OP-7', token: '1234', receiptNote: 'ok' });
  });

  it('FAILED : client remboursé', async () => {
    const { svc, settlement } = make({ id: 'p1', status: 'PROCESSING', connectorKey: 'sandbox' });
    await expect(send(svc, { reference: 'FAC-1', status: 'FAILED', message: 'Compte inconnu' })).resolves.toEqual({ ok: true, status: 'REFUNDED' });
    expect(settlement.fail).toHaveBeenCalledWith('p1', { reason: 'Compte inconnu' });
  });

  it('même confirmation reçue deux fois : réponse « ok », aucun second règlement ni remboursement', async () => {
    const { svc, settlement } = make({ id: 'p1', status: 'COMPLETED', connectorKey: 'sandbox' });
    await expect(send(svc, { reference: 'FAC-1', status: 'COMPLETED' })).resolves.toEqual({ ok: true, status: 'COMPLETED' });
    await expect(send(svc, { reference: 'FAC-1', status: 'FAILED' })).resolves.toEqual({ ok: true, status: 'COMPLETED' });
    expect(settlement.complete).not.toHaveBeenCalled();
    expect(settlement.fail).not.toHaveBeenCalled();
  });

  it('signature fausse : 401 et rien n\'est lu ni modifié', async () => {
    const { svc, settlement } = make({ id: 'p1', status: 'PROCESSING', connectorKey: 'sandbox' });
    await expect(send(svc, { reference: 'FAC-1', status: 'COMPLETED' }, { secret: 'un-autre-secret-0123456' })).rejects.toThrow(UnauthorizedException);
    await expect(send(svc, { reference: 'FAC-1', status: 'COMPLETED' }, { t: 1_000 })).rejects.toThrow(UnauthorizedException);
    expect(settlement.complete).not.toHaveBeenCalled();
  });

  it('connecteur sans secret ou inconnu : l\'adresse n\'existe pas', async () => {
    const { svc } = make(null);
    await expect(send(svc, { reference: 'FAC-1', status: 'COMPLETED' }, { key: 'manual' })).rejects.toThrow(NotFoundException);
    await expect(send(svc, { reference: 'FAC-1', status: 'COMPLETED' }, { key: '../etc' })).rejects.toThrow(NotFoundException);
  });

  it('un connecteur ne règle pas le paiement d\'un autre connecteur ; paiement inconnu ; corps incomplet', async () => {
    await expect(send(make({ id: 'p1', status: 'PROCESSING', connectorKey: 'manual' }).svc, { reference: 'FAC-1', status: 'COMPLETED' })).rejects.toThrow(NotFoundException);
    await expect(send(make(null).svc, { reference: 'FAC-?', status: 'COMPLETED' })).rejects.toThrow(NotFoundException);
    await expect(send(make({ id: 'p1', status: 'PROCESSING', connectorKey: 'sandbox' }).svc, { reference: 'FAC-1', status: 'MAYBE' })).rejects.toThrow(BadRequestException);
    await expect(make(null).svc.handle('sandbox', Buffer.alloc(0), 'x', {})).rejects.toThrow(BadRequestException);
  });
});
