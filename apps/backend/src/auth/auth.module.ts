// apps/backend/src/auth/auth.module.ts
// =========================================================
// AUTH MODULE v4.0
// ✅ Pas de Passport (guard custom JwtAuthGuard)
// ✅ MailModule importé pour les emails OTP/welcome/confirmation
// ✅ JwtModule.registerAsync conservé tel quel
// =========================================================

import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

// =========================================================
// HELPER : durée du token (ex: "1d", "3600s", "15m")
// =========================================================

function parseExpiresToSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;

  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return 86400;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 86400;
  }

  const m = /^(\d+)\s*([smhd])$/i.exec(s);
  if (!m) return 86400;

  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return 86400;

  switch (m[2].toLowerCase()) {
    case 's':
      return qty;
    case 'm':
      return qty * 60;
    case 'h':
      return qty * 3600;
    case 'd':
      return qty * 86400;
    default:
      return 86400;
  }
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // ✅ CORRECTION CHIRURGICALE : Utilisation de forwardRef() pour briser la boucle avec AuthModule
    forwardRef(() => UsersModule),
    MailModule, // ✅ Pour les emails OTP, bienvenue, confirmation password

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'SUPER_SECRET_KEY',
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
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}