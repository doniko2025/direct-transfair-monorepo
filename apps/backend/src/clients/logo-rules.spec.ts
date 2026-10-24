// apps/backend/src/clients/logo-rules.spec.ts
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { MAX_LOGO_CHARS, normalizeLogoUrl } from './logo-rules';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('normalizeLogoUrl', () => {
  it('vide / absent → null (logo retiré)', () => {
    expect(normalizeLogoUrl(undefined)).toBeNull();
    expect(normalizeLogoUrl(null)).toBeNull();
    expect(normalizeLogoUrl('   ')).toBeNull();
  });

  it('accepte une adresse web et une image PNG / JPEG / WebP / GIF importée', () => {
    expect(normalizeLogoUrl(' https://exemple.com/logo.png ')).toBe('https://exemple.com/logo.png');
    expect(normalizeLogoUrl(PNG)).toBe(PNG);
    for (const t of ['jpeg', 'jpg', 'webp', 'gif']) {
      expect(normalizeLogoUrl(`data:image/${t};base64,AAAA`)).toContain(`image/${t}`);
    }
  });

  it('refuse les schémas dangereux, le SVG en data URL et les valeurs non textuelles', () => {
    for (const bad of [
      'javascript:alert(1)', 'file:///etc/passwd', 'ftp://x/logo.png', 'logo.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,@@@',
    ]) {
      expect(() => normalizeLogoUrl(bad)).toThrow(BadRequestException);
    }
    expect(() => normalizeLogoUrl(42)).toThrow(BadRequestException);
    expect(() => normalizeLogoUrl({})).toThrow(BadRequestException);
  });

  it('refuse un logo trop lourd, et une adresse web trop longue', () => {
    expect(() => normalizeLogoUrl(`data:image/png;base64,${'A'.repeat(MAX_LOGO_CHARS)}`)).toThrow(/trop lourd/);
    expect(() => normalizeLogoUrl(`https://x.com/${'a'.repeat(600)}`)).toThrow(BadRequestException);
  });
});

describe('ClientsService — logo à la création et à la mise à jour', () => {
  const make = () => {
    const prisma: any = {
      client: {
        update: jest.fn(async ({ data }: any) => ({ id: 1, ...data })),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    return { service: new (ClientsService as any)(prisma, {}) as ClientsService, prisma };
  };

  it('update : enregistre une image importée, la vide en null, refuse une valeur invalide', async () => {
    const { service, prisma } = make();
    await service.update(1, { logoUrl: PNG });
    expect(prisma.client.update.mock.calls[0][0].data.logoUrl).toBe(PNG);
    await service.update(1, { logoUrl: null });
    expect(prisma.client.update.mock.calls[1][0].data.logoUrl).toBeNull();
    await expect(service.update(1, { logoUrl: 'javascript:alert(1)' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.update).toHaveBeenCalledTimes(2);
  });

  it("update : sans logoUrl dans la requête, le logo n'est pas touché", async () => {
    const { service, prisma } = make();
    await service.update(1, { tagline: 'x' });
    expect(prisma.client.update.mock.calls[0][0].data).not.toHaveProperty('logoUrl');
  });

  it('create : un logo invalide est refusé avant toute écriture', async () => {
    const { service, prisma } = make();
    await expect(service.create({
      code: 'ABC', name: 'N', adminEmail: 'a@b.test', adminFirstName: 'A', adminLastName: 'B', adminPassword: 'x'.repeat(12),
      logoUrl: 'file:///x',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
