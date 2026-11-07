// apps/backend/src/profile-photo/profile-photo.service.spec.ts
// Photo de profil : image seulement (type RÉEL), taille bornée, remplacement, lecture par son seul propriétaire, suppression.
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ProfilePhotoService } from './profile-photo.service';

type J = Record<string, any>;

const jpeg = (bytes = 20_000) => {
  const b = Buffer.alloc(bytes, 7);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
  return b.toString('base64');
};
const pdf = () => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20_000, 1)]).toString('base64');

function setup() {
  const rows: Record<string, J> = {};
  const prisma: J = {
    userPhoto: {
      upsert: jest.fn(async ({ where, create, update }: J) => { rows[where.userId] = rows[where.userId] ? { ...rows[where.userId], ...update } : { ...create }; return rows[where.userId]; }),
      findUnique: jest.fn(async ({ where }: J) => rows[where.userId] ?? null),
      deleteMany: jest.fn(async ({ where }: J) => { const had = !!rows[where.userId]; delete rows[where.userId]; return { count: had ? 1 : 0 }; }),
    },
  };
  return { service: new ProfilePhotoService(prisma as any), rows, prisma };
}

describe('photo de profil', () => {
  it('enregistre une image JPEG et renvoie sa version', async () => {
    const { service, rows } = setup();
    const out = await service.save('u1', jpeg());
    expect(out).toMatchObject({ mimeType: 'image/jpeg', sizeBytes: 20_000 });
    expect(rows.u1.sha256).toBe(out.version);
  });

  it('accepte le préfixe data: et remplace la photo précédente', async () => {
    const { service, rows } = setup();
    await service.save('u1', jpeg(20_000));
    await service.save('u1', `data:image/jpeg;base64,${jpeg(30_000)}`);
    expect(rows.u1.sizeBytes).toBe(30_000);
  });

  it('refuse un PDF, un fichier qui n’est pas une image, une photo trop lourde (> 2 Mo) ou trop petite', async () => {
    const { service, rows } = setup();
    await expect(service.save('u1', pdf())).rejects.toThrow(/image/);
    await expect(service.save('u1', Buffer.alloc(20_000, 65).toString('base64'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.save('u1', jpeg(2.5 * 1024 * 1024))).rejects.toThrow(/trop lourde/);
    await expect(service.save('u1', jpeg(100))).rejects.toBeInstanceOf(BadRequestException);
    expect(rows.u1).toBeUndefined();
  });

  it('lecture : chacun ne lit que SA photo ; 404 sans photo', async () => {
    const { service } = setup();
    await service.save('u1', jpeg());
    await expect(service.read('u1')).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    await expect(service.read('u2')).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.version('u2')).toBeNull();
  });

  it('suppression : la photo disparaît (retour aux initiales)', async () => {
    const { service } = setup();
    await service.save('u1', jpeg());
    await expect(service.remove('u1')).resolves.toEqual({ removed: true });
    await expect(service.remove('u1')).resolves.toEqual({ removed: false });
    await expect(service.read('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
