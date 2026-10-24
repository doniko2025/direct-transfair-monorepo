// apps/backend/src/clients/clients.create-fields.spec.ts
// Création d'une société : tous les champs de la fiche (coordonnées, apparence, mentions légales) sont enregistrés dès
// la création, sans retour par la modification.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

function make() {
  const created: { client?: any } = {};
  const tx: any = {
    client: { create: jest.fn(async ({ data }: any) => { created.client = data; return { id: 9, ...data }; }) },
    wallet: { create: jest.fn().mockResolvedValue({}) },
    user:   { create: jest.fn(async () => ({ id: 'adm1' })) },
  };
  const prisma: any = {
    client: { findUnique: jest.fn().mockResolvedValue(null) },
    user:   { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn: any) => fn(tx)),
  };
  const mail: any = { sendWelcomeCompanyAdmin: jest.fn().mockResolvedValue(undefined) };
  return { service: new (ClientsService as any)(prisma, mail) as ClientsService, created, tx };
}

const base = {
  code: 'FLASH26', name: 'Flash Transfert', adminEmail: 'admin@flash.test', adminFirstName: 'A', adminLastName: 'B',
  adminPassword: 'MotDePasse-123', ownerCountry: 'GN',
};

describe('ClientsService.create — champs complets', () => {
  it('enregistre ville, site web, adresse, apparence et mentions légales', async () => {
    const { service, created } = make();
    await service.create({
      ...base,
      contactEmail: 'contact@flash.test', city: 'Conakry', website: 'https://flash.test', address: '12 rue du Port',
      logoUrl: 'https://flash.test/logo.png', tagline: 'Rapide et sûr', welcomeMessage: 'Bienvenue', fontFamily: 'Poppins',
      legalCompanyName: 'Flash Transfert SAS', regulatorName: 'Banque Centrale', regulatorAcronym: 'BCRG',
      regulatoryFrameworkLabel: 'DSP2', regulatorLicenseType: 'Établissement de paiement', regulatorLicenseNumber: 'N° 12345',
      capitalSocial: '100 000 €', supportEmail: 'help@flash.test', whatsappNumber: '+224600000000',
      mediatorName: 'Médiateur BCRG', mediatorUrl: 'https://mediateur.test',
    } as any);
    expect(created.client).toMatchObject({
      contactEmail: 'contact@flash.test', city: 'Conakry', website: 'https://flash.test', address: '12 rue du Port',
      logoUrl: 'https://flash.test/logo.png', tagline: 'Rapide et sûr', welcomeMessage: 'Bienvenue', fontFamily: 'Poppins',
      legalCompanyName: 'Flash Transfert SAS', regulatorName: 'Banque Centrale', regulatorAcronym: 'BCRG',
      regulatoryFrameworkLabel: 'DSP2', regulatorLicenseType: 'Établissement de paiement', regulatorLicenseNumber: 'N° 12345',
      capitalSocial: '100 000 €', supportEmail: 'help@flash.test', whatsappNumber: '+224600000000',
      mediatorName: 'Médiateur BCRG', mediatorUrl: 'https://mediateur.test',
    });
  });

  it('champs vides ou absents → NULL (jamais une chaîne vide)', async () => {
    const { service, created } = make();
    await service.create({ ...base, city: '   ', legalCompanyName: '', supportEmail: '' } as any);
    expect(created.client.city).toBeNull();
    expect(created.client.legalCompanyName).toBeNull();
    expect(created.client.supportEmail).toBeNull();
    expect(created.client.mediatorUrl).toBeNull();
    expect(created.client.website).toBeNull();
  });

  it("l'adresse de la société prime sur celle du propriétaire, qui reste le repli", async () => {
    const a = make();
    await a.service.create({ ...base, address: 'Siège', ownerAddress: 'Domicile' } as any);
    expect(a.created.client.address).toBe('Siège');
    const b = make();
    await b.service.create({ ...base, ownerAddress: 'Domicile' } as any);
    expect(b.created.client.address).toBe('Domicile');
  });

  it("la validation du DTO accepte les mentions légales (elles ne sont plus retirées) et refuse un email d'assistance invalide", async () => {
    const ok = plainToInstance(CreateClientDto, { ...base, legalCompanyName: 'X SAS', supportEmail: 'help@x.test', capitalSocial: '1 €' });
    expect(await validate(ok, { whitelist: true })).toHaveLength(0);
    expect(ok.legalCompanyName).toBe('X SAS');
    const bad = plainToInstance(CreateClientDto, { ...base, supportEmail: 'pas-un-email' });
    expect((await validate(bad)).map((e) => e.property)).toContain('supportEmail');
    const tooLong = plainToInstance(CreateClientDto, { ...base, regulatorAcronym: 'X'.repeat(21) });
    expect((await validate(tooLong)).map((e) => e.property)).toContain('regulatorAcronym');
  });
});
