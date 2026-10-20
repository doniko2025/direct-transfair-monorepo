// apps/backend/src/auth/auth.module.ts
// =========================================================
// AUTH MODULE v5.3
// ✅ v5.3 : SÉCURITÉ — plus de secret JWT de secours public (« SUPER_SECRET_KEY » permettait à n'importe qui de fabriquer
//   un jeton valide si JWT_SECRET était absent). En production, l'API REFUSE de démarrer sans JWT_SECRET d'au moins
//   32 caractères. Hors production, un secret aléatoire est généré à chaque démarrage (avertissement affiché ;
//   les jetons ne survivent pas à un redémarrage — définis JWT_SECRET dans .env pour les conserver).
// ✅ v5.2 : PlatformSsoController/Service — connexion unique depuis la console dkmoney.store
// ✅ v5.0 : V2AuthService + V2AuthController
// ✅ v5.1 : SmsModule importé → SmsService dispo dans V2AuthService
//           et AuthService (SMS OTP réel via Twilio)
// =========================================================

import { Module, forwardRef, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtModule }    from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService }      from './auth.service';
import { AuthController }   from './auth.controller';
import { JwtAuthGuard }     from './jwt-auth.guard';
import { V2AuthService }    from './v2-auth.service';
import { V2AuthController } from './v2-auth.controller';
import { PlatformSsoController } from './platform-sso.controller';   // ✅ v5.2
import { PlatformSsoService }    from './platform-sso.service';

import { UsersModule }  from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule }   from '../mail/mail.module';
import { SmsModule }    from '../sms/sms.module';   // ✅ v5.1

const JWT_MIN_LENGTH = 32;

/** Secret JWT : variable d'environnement obligatoire en production, aléatoire éphémère sinon. */
function resolveJwtSecret(raw: string | undefined): string {
  const secret = (raw ?? '').trim();
  const isProd = process.env.NODE_ENV === 'production';
  if (secret.length >= JWT_MIN_LENGTH) return secret;
  if (isProd) {
    throw new Error(
      `JWT_SECRET manquant ou trop court (minimum ${JWT_MIN_LENGTH} caractères) : démarrage refusé en production. ` +
      'Génère-en un avec : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  new Logger('AuthModule').warn(
    secret
      ? `JWT_SECRET trop court (< ${JWT_MIN_LENGTH}) : secret aléatoire temporaire utilisé (développement).`
      : 'JWT_SECRET absent : secret aléatoire temporaire utilisé (développement) — les connexions sautent à chaque redémarrage.',
  );
  return randomBytes(48).toString('hex');
}

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
        secret: resolveJwtSecret(config.get<string>('JWT_SECRET')),
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
    PlatformSsoController, // ✅ v5.2 : POST /auth/platform-sso
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    V2AuthService,
    PlatformSsoService,
  ],

  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    V2AuthService,
  ],
})
export class AuthModule {}