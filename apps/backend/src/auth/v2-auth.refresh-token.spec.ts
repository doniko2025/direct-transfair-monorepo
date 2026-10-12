// apps/backend/src/auth/v2-auth.refresh-token.spec.ts
// Phase 6 (v2.5) — la session ouverte par /auth/v2/login-password stocke l'EMPREINTE du refresh token,
// la seule forme que AuthService.refreshTokens() sait retrouver.
import 'reflect-metadata';
import * as crypto from 'crypto';
import { V2AuthService } from './v2-auth.service';
import { hashRefreshToken } from './refresh-token.util';

describe('V2AuthService.buildLoginResponse — refresh token', () => {
  it('stocke le SHA-256 du refresh token renvoyé au client, jamais le jeton en clair', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { userSession: { create } } as any;
    const jwt = { sign: jest.fn().mockReturnValue('access.jwt.token') } as any;
    const service = new V2AuthService(prisma, jwt, {} as any);

    const res = await (service as any).buildLoginResponse({
      id: 'u1', email: 'a@b.c', role: 'USER', clientId: 1, wallets: [],
    });

    const stored = create.mock.calls[0][0].data.refreshToken;
    expect(res.refresh_token).toMatch(/^[0-9a-f]{96}$/);
    expect(stored).not.toBe(res.refresh_token);
    expect(stored).toBe(crypto.createHash('sha256').update(res.refresh_token).digest('hex'));
    expect(stored).toBe(hashRefreshToken(res.refresh_token));
  });
});
