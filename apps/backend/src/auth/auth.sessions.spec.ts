// apps/backend/src/auth/auth.sessions.spec.ts
// Phase 6 (v5.10) — sessions illimitées : une connexion ne supprime pas les sessions existantes.
import 'reflect-metadata';
import { AuthService } from './auth.service';
import { hashRefreshToken } from './refresh-token.util';

describe('AuthService.createSession — sessions illimitées', () => {
  it('crée une session (empreinte du refresh token) sans supprimer celles de l\'utilisateur', async () => {
    const prisma = {
      userSession: {
        deleteMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const fake = { prisma, logger: { warn: jest.fn() } };

    await (AuthService.prototype as any).createSession.call(
      fake, 'u1', { access_token: 'acc', refresh_token: 'ref' }, 'device-1',
    );

    expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    const data = prisma.userSession.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', token: 'acc', deviceId: 'device-1', status: 'ACTIVE' });
    expect(data.refreshToken).toBe(hashRefreshToken('ref'));
  });
});
