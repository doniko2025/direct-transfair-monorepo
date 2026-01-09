// apps/backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// ✅ CORRECTION DES CHEMINS (Dossiers strategies et guards)
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

// Fonction utilitaire pour gérer la durée du token (ex: "1d", "3600s")
function parseExpiresToSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;

  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return 86400; // Par défaut 1 jour

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 86400;
  }

  const m = /^(\d+)\s*([smhd])$/i.exec(s);
  if (!m) return 86400;

  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return 86400;

  switch (m[2].toLowerCase()) {
    case 's': return qty;
    case 'm': return qty * 60;
    case 'h': return qty * 3600;
    case 'd': return qty * 86400;
    default: return 86400;
  }
}

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    UsersModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'SUPER_SECRET_KEY', // Fallback de sécurité
        signOptions: {
          expiresIn: parseExpiresToSeconds(
            config.get<string>('JWT_EXPIRES_IN') ??
            config.get<string>('JWT_EXPIRES') ??
            '1d',
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  // ✅ On déclare bien la JwtStrategy ici
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtAuthGuard, 
  ],
})
export class AuthModule {}