// apps/backend/src/app.module.ts
// =========================================================
// APP MODULE v4.5
// ✅ v4.4 : exclusion auth/v2/(.*) du TenantMiddleware
// ✅ v4.5 : ThrottlerModule global — rate limiting par IP
//   Prérequis : npm install @nestjs/throttler
//
//   3 niveaux configurés :
//   — default : 100 req / 60s  (APIs normales)
//   — auth    :   5 req / 60s  (login, register → @Throttle sur controller)
//   — otp     :  10 req /  1h  (envoi OTP → @Throttle sur controller)
//
//   APP_GUARD ThrottlerGuard appliqué globalement.
//   Exempter une route : @SkipThrottle() sur le handler.
// =========================================================

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // ✅ v4.5
import { APP_GUARD }    from '@nestjs/core';                          // ✅ v4.5

import { PrismaModule }   from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';
import { MailModule }     from './mail/mail.module';
import { SmsModule }      from './sms/sms.module';
import { PushModule }     from './push/push.module';

import { NotificationsModule }      from './notifications/notifications.module';
import { UsersModule }              from './users/users.module';
import { ClientsModule }            from './clients/clients.module';
import { TenantsModule }            from './tenants/tenants.module';
import { AuthModule }               from './auth/auth.module';
import { BeneficiariesModule }      from './beneficiaries/beneficiaries.module';
import { TransactionsModule }       from './transactions/transactions.module';
import { PaymentsModule }           from './payments/payments.module';
import { WithdrawalsModule }        from './withdrawals/withdrawals.module';
import { RatesModule }              from './rates/rates.module';
import { AgenciesModule }           from './agencies/agencies.module';
import { CommissionsModule }        from './commissions/commissions.module';
import { WalletsModule }            from './wallets/wallets.module';
import { TreasuryModule }           from './treasury/treasury.module';
import { ScheduledTransfersModule } from './scheduled-transfers/scheduled-transfers.module';
import { RateAlertsModule }         from './rate-alerts/rate-alerts.module';
import { LimitsModule }             from './limits/limits.module';
import { LocationsModule }          from './locations/locations.module';

import { TenantMiddleware }        from './tenants/tenant.middleware';
import { ExchangeRatesController } from './exchange-rates/exchange-rates.controller';
import { ExchangeRatesService }    from './exchange-rates/exchange-rates.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // ✅ v4.5 : Rate limiting global par IP
    ThrottlerModule.forRoot([
      {
        name:  'default',
        ttl:   60_000,   // 1 minute
        limit: 100,      // 100 req/min → APIs standard
      },
      {
        name:  'auth',
        ttl:   60_000,   // 1 minute
        limit: 5,        // 5 req/min → login, register (voir v2-auth.controller.ts)
      },
      {
        name:  'otp',
        ttl:   3_600_000, // 1 heure
        limit: 10,        // 10/h → envoi OTP (couche IP en plus du rate limit service)
      },
    ]),

    PrismaModule,
    PlatformModule,
    MailModule,
    SmsModule,
    PushModule,
    NotificationsModule,
    UsersModule,
    ClientsModule,
    TenantsModule,
    AuthModule,
    BeneficiariesModule,
    TransactionsModule,
    PaymentsModule,
    WithdrawalsModule,
    RatesModule,
    AgenciesModule,
    CommissionsModule,
    WalletsModule,
    TreasuryModule,
    ScheduledTransfersModule,
    RateAlertsModule,
    LimitsModule,
    LocationsModule,
  ],

  controllers: [ExchangeRatesController],

  providers: [
    ExchangeRatesService,
    // ✅ v4.5 : ThrottlerGuard appliqué globalement sur toutes les routes
    {
      provide:  APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        'auth/login',
        'auth/register',
        'auth/refresh',
        'auth/v2/(.*)',       // ✅ v4.4
        'branding',
        'branding/(.*)',      // ✅ v4.3
        'swagger',
        'swagger/(.*)',
        'health',
        'admin/tenants',
        'admin/tenants/(.*)',
        'locations',
        'locations/(.*)',
      )
      .forRoutes('*');
  }
}