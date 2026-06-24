// apps/backend/src/auth/auth.module.ts
// =========================================================
// AUTH MODULE v5.1
// ✅ v5.0 : V2AuthService + V2AuthController
// ✅ v5.1 : SmsModule importé → SmsService dispo dans V2AuthService
//           et AuthService (SMS OTP réel via Twilio)
// =========================================================

import { Module, forwardRef } from '@nestjs/common';
import { JwtModule }    from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService }      from './auth.service';
import { AuthController }   from './auth.controller';
import { JwtAuthGuard }     from './jwt-auth.guard';
import { V2AuthService }    from './v2-auth.service';
import { V2AuthController } from './v2-auth.controller';

import { UsersModule }  from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule }   from '../mail/mail.module';
import { SmsModule }    from '../sms/sms.module';   // ✅ v5.1

function parseExpiresToSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return 3600;
  if (/^\d+$/.test(s)) { const n = Number(s); return Number.isFinite(n) && n > 0 ? n : 3600; }
  const m = /^(\d+)\s*([smhd])$/i.exec(s);
  if (!m) return 3600;
  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return 3600;
  switch (m[2].toLowerCase()) {
    case 's': return qty;
    case 'm': return qty * 60;
    case 'h': return qty * 3600;
    case 'd': return qty * 86400;
    default:  return 3600;
  }
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => UsersModule),
    MailModule,
    SmsModule,   // ✅ v5.1 : SMS réel via Twilio dans AuthService + V2AuthService

    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'SUPER_SECRET_KEY',
        signOptions: {
          expiresIn: parseExpiresToSeconds(
            config.get<string>('JWT_EXPIRES_IN') ??
            config.get<string>('JWT_EXPIRES')    ??
            '1h',   // ✅ v5.0 : défaut 1h (était 1d)
          ),
        },
      }),
    }),
  ],

  controllers: [
    AuthController,
    V2AuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    V2AuthService,
  ],

  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    V2AuthService,
  ],
})
export class AuthModule {}