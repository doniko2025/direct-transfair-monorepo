// apps/backend/src/mail/mail.log-body.spec.ts
// Phase 6 — le journal des communications ne garde pas le corps des emails ni des SMS.
import 'reflect-metadata';
import { MailService } from './mail.service';
import { SmsService } from '../sms/sms.service';

describe('Journal des communications — pas de corps de message', () => {
  it('email : htmlBody absent des données enregistrées', async () => {
    const prisma: any = { communicationLog: { create: jest.fn().mockResolvedValue({ id: 'l1' }), update: jest.fn().mockResolvedValue({}) } };
    const svc: any = new MailService(prisma);
    svc.isHttpConfigured = true;
    svc.sendMail = jest.fn().mockResolvedValue({ messageId: 'm1', usedProvider: 'http' });
    await svc.sendEmail('a@x.com', 'Mot de passe temporaire', '<p>MotDePasse123</p>');
    const data = prisma.communicationLog.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('htmlBody');
    expect(data).not.toHaveProperty('textBody');
    expect(JSON.stringify(data)).not.toContain('MotDePasse123');
    expect(data).toMatchObject({ recipient: 'a@x.com', subject: 'Mot de passe temporaire', type: 'EMAIL' });
  });

  it('SMS : smsContent absent des données enregistrées', async () => {
    const prisma: any = { communicationLog: { create: jest.fn().mockResolvedValue({ id: 'l2' }), update: jest.fn().mockResolvedValue({}) } };
    const svc = new SmsService(prisma);
    await svc.send({ to: '+224620000000', message: 'Votre code est 481516' });
    const data = prisma.communicationLog.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('smsContent');
    expect(JSON.stringify(data)).not.toContain('481516');
    expect(data).toMatchObject({ recipient: '+224620000000', type: 'SMS' });
  });
});
