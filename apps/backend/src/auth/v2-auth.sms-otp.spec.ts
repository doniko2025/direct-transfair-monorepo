// OTP par SMS (auth v2) : le code part réellement par SmsService et n'est jamais écrit dans les logs.
import 'reflect-metadata';
import { CommsType, OtpPurpose } from '@prisma/client';
import { V2AuthService } from './v2-auth.service';

function make(smsImpl: jest.Mock) {
  const prisma: any = {
    otpLog: { updateMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
    user: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail: any = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const sms: any = { sendOtp: smsImpl };
  const service = new V2AuthService(prisma, {} as any, mail, sms);
  const logs: string[] = [];
  const grab = (m: unknown) => { logs.push(String(m)); };
  jest.spyOn((service as any).logger, 'log').mockImplementation(grab);
  jest.spyOn((service as any).logger, 'warn').mockImplementation(grab);
  jest.spyOn((service as any).logger, 'error').mockImplementation(grab);
  return { service, prisma, mail, sms, logs };
}

describe('V2AuthService.sendOtpInternal — canal SMS', () => {
  it('envoie le code par SmsService (numéro, code, utilisateur) et pas par e-mail', async () => {
    const sendOtp = jest.fn().mockResolvedValue({ success: true, provider: 'twilio' });
    const { service, mail, prisma } = make(sendOtp);

    await (service as any).sendOtpInternal('u1', CommsType.SMS, OtpPurpose.LOGIN, '+33612345678');

    expect(sendOtp).toHaveBeenCalledTimes(1);
    const [to, code, userId] = sendOtp.mock.calls[0];
    expect(to).toBe('+33612345678');
    expect(code).toMatch(/^\d{4,8}$/);
    expect(userId).toBe('u1');
    expect(mail.sendEmail).not.toHaveBeenCalled();
    // le même code est celui enregistré en base
    expect(prisma.otpLog.create.mock.calls[0][0].data.code).toBe(code);
  });

  it("n'écrit jamais le code dans les journaux du serveur", async () => {
    const sendOtp = jest.fn().mockResolvedValue({ success: true, provider: 'stub' });
    const { service, logs } = make(sendOtp);
    await (service as any).sendOtpInternal('u1', CommsType.SMS, OtpPurpose.LOGIN, '+33612345678');
    const code = sendOtp.mock.calls[0][1] as string;
    expect(logs.join('\n')).not.toContain(code);
  });

  it("un échec d'envoi ne casse pas la demande (le code reste enregistré) et ne fuite pas le code", async () => {
    const sendOtp = jest.fn().mockRejectedValue(new Error('Twilio 503'));
    const { service, prisma, logs } = make(sendOtp);
    await expect(
      (service as any).sendOtpInternal('u1', CommsType.SMS, OtpPurpose.LOGIN, '+33612345678'),
    ).resolves.toBeUndefined();
    expect(prisma.otpLog.create).toHaveBeenCalledTimes(1);
    expect(logs.join('\n')).toContain('Twilio 503');
    expect(logs.join('\n')).not.toContain(sendOtp.mock.calls[0][1] as string);
  });

  it('envoi non confirmé par le prestataire → avertissement, sans exception', async () => {
    const sendOtp = jest.fn().mockResolvedValue({ success: false, provider: 'twilio', error: 'numéro invalide' });
    const { service, logs } = make(sendOtp);
    await (service as any).sendOtpInternal('u1', CommsType.SMS, OtpPurpose.LOGIN, '+33612345678');
    expect(logs.join('\n')).toContain('numéro invalide');
  });
});
