// PATCH /clients/:id — le corps n'est plus libre : liste blanche, mêmes règles qu'à la création, null = champ vidé.
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';

import { UpdateClientDto, UpdateClientStatusDto } from './dto/update-client.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype });
const run = (body: unknown) => pipe.transform(body, meta(UpdateClientDto)) as Promise<any>;

describe('UpdateClientDto', () => {
  it('retire les champs qui ne sont pas modifiables (isActive, tenantId, code, statut, devise, suppression)', async () => {
    const out = await run({
      name: ' Flash ', isActive: false, tenantId: 9, code: 'X', subscriptionStatus: 'ACTIVE',
      defaultCurrency: 'USD', deletedAt: '2020-01-01', maxDailyTransferAmount: 1, id: 3,
    });
    expect(out).toEqual({ name: 'Flash' });
  });

  it('refuse un nom vide ou une couleur invalide', async () => {
    await expect(run({ name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ primaryColor: 'rouge' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ subdomain: 'A_B' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ contactEmail: 'pas-un-mail' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepte null et "" pour vider un champ facultatif (jamais "" en base : colonnes uniques)', async () => {
    const out = await run({ subdomain: '', customDomain: null, tagline: '  ', contactEmail: '' });
    expect(out).toEqual({ subdomain: null, customDomain: null, tagline: null, contactEmail: null });
  });

  it('accepte une modification valide complète', async () => {
    const out = await run({ subdomain: 'flash', customDomain: 'www.flash-transfer.com', primaryColor: '#059669', subscriptionType: 'RENTAL' });
    expect(out).toMatchObject({ subdomain: 'flash', primaryColor: '#059669', subscriptionType: 'RENTAL' });
  });

  it('refuse un type d\'abonnement inconnu', async () => {
    await expect(run({ subscriptionType: 'GRATUIT' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateClientStatusDto', () => {
  const st = (b: unknown) => pipe.transform(b, meta(UpdateClientStatusDto)) as Promise<any>;
  it('accepte un statut connu, refuse le reste', async () => {
    await expect(st({ status: 'SUSPENDED' })).resolves.toMatchObject({ status: 'SUSPENDED' });
    await expect(st({ status: 'HACKED' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(st({})).rejects.toBeInstanceOf(BadRequestException);
  });
});
