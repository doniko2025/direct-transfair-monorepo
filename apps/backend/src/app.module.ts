// apps/backend/src/app.module.ts
// =========================================================
// APP MODULE v4.3
// ✅ v4.1 : LimitsModule ajouté
// ✅ v4.2 : LocationsModule ajouté (endpoint public GET /locations)
// ✅ v4.3 : 'branding' et 'branding/(.*)' exclus du TenantMiddleware
//   → L'endpoint GET /branding/:code est appelé AVANT que le tenant
//     soit connu (chargement du login). S'il passe par le middleware,
//     ce dernier tente de résoudre un tenant depuis x-tenant-id=DONIKO,
//     ce qui peut échouer ou retourner le mauvais contexte.
//   → Exclure branding garantit que chaque société retourne son propre
//     logo/couleur sans interférence du middleware tenant.
// =========================================================

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule }   from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';

import { MailModule } from './mail/mail.module';
import { SmsModule }  from './sms/sms.module';
import { PushModule } from './push/push.module';

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

import { TenantMiddleware } from './tenants/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

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
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        // Auth publique
        'auth/login',
        'auth/register',
        'auth/refresh',

        // ✅ v4.3 : branding exclu — appelé AVANT que le tenant soit connu
        // GET /branding/:code doit fonctionner sans x-tenant-id valide
        // sinon le middleware échoue et le login de chaque société
        // retombe sur le branding par défaut (DONIKO)
        'branding',
        'branding/(.*)',

        // Infra
        'swagger',
        'swagger/(.*)',
        'health',

        // Admin plateforme
        'admin/tenants',
        'admin/tenants/(.*)',

        // Locations publiques
        'locations',
        'locations/(.*)',
      )
      .forRoutes('*');
  }
}