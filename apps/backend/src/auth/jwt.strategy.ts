//apps/backend/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import type { AuthUserPayload } from './types/auth-user-payload.type';

type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  clientId?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  validate(payload: JwtPayload): AuthUserPayload {
    return {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      clientId: payload.clientId,
    };
  }
}

// Optionnel mais pratique (ne casse rien)
export default JwtStrategy;
