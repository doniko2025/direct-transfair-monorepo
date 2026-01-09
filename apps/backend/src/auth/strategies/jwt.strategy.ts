//apps/backend/src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

// ✅ On définit le type ici pour pouvoir l'exporter vers le contrôleur
export interface AuthUserPayload {
  id: string;
  sub: string; // On garde 'sub' pour la compatibilité
  email: string;
  role: Role;
  clientId: number;
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

  async validate(payload: any): Promise<AuthUserPayload> {
    if (!payload.sub) throw new UnauthorizedException();

    // ✅ On renvoie un objet complet compatible avec tout le système
    return { 
        id: payload.sub,           // 'id' pour les contrôleurs standards
        sub: payload.sub,          // 'sub' pour la compatibilité avec AuthController
        email: payload.email, 
        role: payload.role as Role,
        clientId: payload.clientId 
    };
  }
}