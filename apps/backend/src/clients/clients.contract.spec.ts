// apps/backend/src/clients/clients.contract.spec.ts
// Création de société : le contrat est émis et son lien de signature est joint au courriel de bienvenue.
import 'reflect-metadata';
import { ClientsService } from './clients.service';

function make(contractsService: any) {
  const tx: any = {
    client: { create: jest.fn(async ({ data }: any) => ({ id: 42, ...data })) },
    wallet: { create: jest.fn().mockResolvedValue({}) },
    user: { create: jest.fn(async () => ({ id: 'u1' })) },
  };
  const prisma: any = {
    client: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const mail: any = { sendWelcomeCompanyAdmin: jest.fn().mockResolvedValue(undefined) };
  return { service: new (ClientsService as any)(prisma, mail, contractsService) as ClientsService, mail };
}

const dto: any = {
  code: 'FLASH', name: 'Flash', adminEmail: 'patron@flash.sn', adminFirstName: 'Aminata', adminLastName: 'Diallo',
  adminPassword: 'Secret-pass-123', ownerCountry: 'SN', subscriptionType: 'RENTAL',
};

describe('ClientsService.create — contrat', () => {
  it('émet le contrat sans e-mail séparé et joint le lien au courriel de bienvenue', async () => {
    const contracts: any = {
      issue: jest.fn(async () => ({ id: 'c1', reference: 'CT-2026-0001', label: 'contrat de location', signUrl: 'https://app/signature/T', expiresAt: new Date('2026-12-01') })),
      markSent: jest.fn().mockResolvedValue(undefined),
    };
    const { service, mail } = make(contracts);
    const res: any = await service.create({ ...dto, contract: { amount: 149, currency: 'EUR' } }, 'admin-1');
    expect(contracts.issue).toHaveBeenCalledWith(expect.objectContaining({ clientId: 42, notify: false, recipientEmail: 'patron@flash.sn', issuedById: 'admin-1' }));
    expect(res.contract).toMatchObject({ id: 'c1', reference: 'CT-2026-0001', signUrl: 'https://app/signature/T' });
    expect(res.contractError).toBeUndefined();
    await new Promise((r) => setTimeout(r, 20));
    const sent = mail.sendWelcomeCompanyAdmin.mock.calls[0][0];
    expect(sent.temporaryPassword).toBe('Secret-pass-123');
    expect(sent.signature).toMatchObject({ url: 'https://app/signature/T', reference: 'CT-2026-0001' });
    expect(contracts.markSent).toHaveBeenCalledWith('c1');
  });

  it("sans conditions de contrat : aucun contrat, courriel de bienvenue classique", async () => {
    const contracts: any = { issue: jest.fn(), markSent: jest.fn() };
    const { service, mail } = make(contracts);
    const res: any = await service.create(dto);
    expect(contracts.issue).not.toHaveBeenCalled();
    expect(res.contract).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(mail.sendWelcomeCompanyAdmin.mock.calls[0][0].signature).toBeUndefined();
  });

  it("échec d'émission : la société est créée, l'erreur est remontée, les identifiants partent quand même", async () => {
    const contracts: any = { issue: jest.fn().mockRejectedValue(new Error('Montant invalide')), markSent: jest.fn() };
    const { service, mail } = make(contracts);
    const res: any = await service.create({ ...dto, contract: { amount: 0, currency: 'EUR' } });
    expect(res.client.id).toBe(42);
    expect(res.contract).toBeNull();
    expect(res.contractError).toBe('Montant invalide');
    await new Promise((r) => setTimeout(r, 20));
    expect(mail.sendWelcomeCompanyAdmin).toHaveBeenCalledTimes(1);
    expect(mail.sendWelcomeCompanyAdmin.mock.calls[0][0].signature).toBeUndefined();
  });
});
