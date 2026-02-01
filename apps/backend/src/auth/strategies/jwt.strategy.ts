// apps/backend/src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

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
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: unknown): Promise<AuthUserPayload> {
    const p = (payload ?? {}) as JwtPayloadLike;

    const sub =
      typeof p.sub === 'string' && p.sub.trim().length > 0 ? p.sub : null;
    
    if (!sub) {
        this.logger.error('Invalid JWT payload (sub missing)');
        throw new UnauthorizedException('Invalid JWT');
    }

    const email = typeof p.email === 'string' ? p.email : '';
    // ✅ FALLBACK ROLE : Si pas de rôle, on met USER par défaut
    const role = isRole(p.role) ? p.role : Role.USER;

    // ✅ CONVERSION SECURISÉE CLIENT ID
    let clientId: number | null = null;
    if (typeof p.clientId === 'number') {
        clientId = p.clientId;
    } else if (typeof p.clientId === 'string') {
        const parsed = parseInt(p.clientId, 10);
        clientId = isNaN(parsed) ? null : parsed;
    }

    return {
      id: sub,
      sub,
      email,
      role,
      clientId,
    };
  }
}