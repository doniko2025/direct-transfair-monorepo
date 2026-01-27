// apps/backend/src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

// ✅ Type exporté (utilisé par AuthController)
export interface AuthUserPayload {
  id: string;
  sub: string;
  email: string;
  role: Role;
  clientId: number | null;
}

type JwtPayloadLike = {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  clientId?: unknown;
};

function isRole(value: unknown): value is Role {
  return (
    value === 'SUPER_ADMIN' ||
    value === 'COMPANY_ADMIN' ||
    value === 'AGENT' ||
    value === 'USER'
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET') || 'SUPER_SECRET_KEY';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: unknown): Promise<AuthUserPayload> {
    const p = (payload ?? {}) as JwtPayloadLike;

    const sub = typeof p.sub === 'string' && p.sub.trim().length > 0 ? p.sub : null;
    if (!sub) throw new UnauthorizedException();

    const email = typeof p.email === 'string' ? p.email : '';
    const role = isRole(p.role) ? p.role : Role.USER;

    const clientId =
      typeof p.clientId === 'number' && Number.isFinite(p.clientId)
        ? p.clientId
        : null;

    return {
      id: sub,
      sub,
      email,
      role,
      clientId,
    };
  }
}
