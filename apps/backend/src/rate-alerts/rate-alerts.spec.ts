// apps/backend/src/rate-alerts/rate-alerts.spec.ts
// Phase 6, passe 3 — alertes de taux : corps validé, sens inverse, déclenchement unique, pannes d'envoi isolées.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateRateAlertDto } from './dto/create-rate-alert.dto';
import { currentRateOf, MAX_ACTIVE_ALERTS_PER_USER, RateAlertsService } from './rate-alerts.service';

describe('currentRateOf', () => {
  const rates = new Map([['EUR_XOF', 655.957]]);
  it('sens direct', () => expect(currentRateOf('EUR_XOF', rates)).toBe(655.957));
  it('sens inverse = 1 / taux', () => expect(currentRateOf('XOF_EUR', rates)).toBeCloseTo(1 / 655.957, 10));
  it('paire absente → null', () => expect(currentRateOf('EUR_GNF', rates)).toBeNull());
});

describe('CreateRateAlertDto', () => {
  const errs = async (o: object) => (await validate(plainToInstance(CreateRateAlertDto, o))).map((e) => e.property);
  it('accepte un corps valide (direction en minuscules, seuil texte)', async () => {
    expect(await errs({ pair: 'EUR_GNF', direction: 'above', threshold: '9500', notifiedVia: ['push', 'EMAIL'] })).toEqual([]);
  });
  it('refuse paire non textuelle, direction inconnue, seuil négatif ou énorme, canal inconnu', async () => {
    expect(await errs({ pair: 42, direction: 'ABOVE', threshold: 1 })).toContain('pair');
    expect(await errs({ pair: 'EUR_GNF', direction: 'SIDEWAYS', threshold: 1 })).toContain('direction');
    expect(await errs({ pair: 'EUR_GNF', direction: 'ABOVE', threshold: -1 })).toContain('threshold');
    expect(await errs({ pair: 'EUR_GNF', direction: 'ABOVE', threshold: 1e15 })).toContain('threshold');
    expect(await errs({ pair: 'EUR_GNF', direction: 'ABOVE', threshold: 1, notifiedVia: ['FAX'] })).toContain('notifiedVia');
  });
});

function make(opts: { alerts?: any[]; rates?: any[]; claim?: number[]; active?: number; client?: any } = {}) {
  const claims = [...(opts.claim ?? [])];
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', clientId: 7 }) },
    client: { findUnique: jest.fn().mockResolvedValue(opts.client ?? { featureRateAlerts: true }) },
    rateAlert: {
      count: jest.fn().mockResolvedValue(opts.active ?? 0),
      create: jest.fn(async ({ data }: any) => ({ id: 'a1', createdAt: new Date(), ...data })),
      findMany: jest.fn().mockResolvedValue(opts.alerts ?? []),
      updateMany: jest.fn(async () => ({ count: claims.length ? claims.shift()! : 1 })),
    },
    exchangeRate: { findMany: jest.fn().mockResolvedValue(opts.rates ?? []) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const push: any = { notifyRateAlert: jest.fn().mockResolvedValue(undefined) };
  const sms: any = { sendRateAlert: jest.fn().mockResolvedValue(undefined) };
  const mail: any = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  return { service: new RateAlertsService(prisma, push, sms, mail), prisma, push, sms, mail };
}

const alert = (over: any = {}) => ({
  id: 'a1', userId: 'u1', pair: 'EUR_XOF', direction: 'ABOVE', threshold: 650, notifiedVia: ['PUSH', 'EMAIL'],
  user: { id: 'u1', email: 'a@x.com', phone: '+33600000000', firstName: '<b>Al</b>', lastName: 'D' }, ...over,
});

describe('RateAlertsService.create', () => {
  it('normalise la paire (EUR/gnf → EUR_GNF) et enregistre', async () => {
    const { service, prisma } = make();
    await service.create('u1', { pair: 'eur/gnf', direction: 'ABOVE', threshold: 9500 });
    expect(prisma.rateAlert.create.mock.calls[0][0].data).toMatchObject({ pair: 'EUR_GNF', notifiedVia: ['PUSH', 'EMAIL'] });
  });
  it('refuse une devise inconnue ou deux fois la même', async () => {
    const { service } = make();
    await expect(service.create('u1', { pair: 'EUR_ABC', direction: 'ABOVE', threshold: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('u1', { pair: 'EUR_EUR', direction: 'ABOVE', threshold: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });
  it(`${MAX_ACTIVE_ALERTS_PER_USER} alertes actives au plus`, async () => {
    const { service, prisma } = make({ active: MAX_ACTIVE_ALERTS_PER_USER });
    await expect(service.create('u1', { pair: 'EUR_GNF', direction: 'ABOVE', threshold: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rateAlert.create).not.toHaveBeenCalled();
  });
});

describe('RateAlertsService.checkAlerts', () => {
  it('une alerte XOF_EUR se déclenche grâce au taux EUR_XOF (sens inverse)', async () => {
    const { service, push } = make({
      alerts: [alert({ pair: 'XOF_EUR', direction: 'BELOW', threshold: 0.0016 })],
      rates: [{ pair: 'EUR_XOF', rate: 655.957 }],
    });
    await service.checkAlerts();
    expect(push.notifyRateAlert).toHaveBeenCalledTimes(1);
  });

  it('ne se déclenche pas quand le seuil n’est pas atteint, ni sans taux enregistré', async () => {
    const a = make({ alerts: [alert({ threshold: 700 })], rates: [{ pair: 'EUR_XOF', rate: 655.957 }] });
    await a.service.checkAlerts();
    expect(a.prisma.rateAlert.updateMany).not.toHaveBeenCalled();
    const b = make({ alerts: [alert({ pair: 'EUR_GNF' })], rates: [] });
    await b.service.checkAlerts();
    expect(b.prisma.rateAlert.updateMany).not.toHaveBeenCalled();
  });

  it('un autre passage a déjà réservé l’alerte : aucun envoi', async () => {
    const { service, push, mail, prisma } = make({ alerts: [alert()], rates: [{ pair: 'EUR_XOF', rate: 655.957 }], claim: [0] });
    await service.checkAlerts();
    expect(push.notifyRateAlert).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('une panne d’email n’empêche ni la notification in-app ni l’alerte suivante', async () => {
    const { service, mail, prisma } = make({
      alerts: [alert(), alert({ id: 'a2', userId: 'u2', user: { id: 'u2', email: 'b@x.com', phone: null, firstName: 'B', lastName: 'C' } })],
      rates: [{ pair: 'EUR_XOF', rate: 655.957 }],
    });
    mail.sendEmail.mockRejectedValue(new Error('smtp'));
    await service.checkAlerts();
    expect(mail.sendEmail).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('le prénom est échappé dans l’email, et seuls les comptes actifs sont lus', async () => {
    const { service, mail, prisma } = make({ alerts: [alert()], rates: [{ pair: 'EUR_XOF', rate: 655.957 }] });
    await service.checkAlerts();
    expect(mail.sendEmail.mock.calls[0][2]).toContain('&lt;b&gt;Al&lt;/b&gt;');
    expect(mail.sendEmail.mock.calls[0][2]).not.toContain('<b>Al</b>');
    expect(prisma.rateAlert.findMany.mock.calls[0][0].where.user).toEqual({ isActive: true, deletedAt: null });
  });
});
