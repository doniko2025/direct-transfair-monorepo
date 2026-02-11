// apps/backend/src/app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';

import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentsModule } from './payments/payments.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { RatesModule } from './rates/rates.module';

import { AgenciesModule } from './agencies/agencies.module';
import { CommissionsModule } from './commissions/commissions.module';

import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';

// ✅ AJOUT : modules globaux "channels"
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,
    PlatformModule,

    // ✅ Important : importés au moins 1 fois pour activer @Global()
    NotificationsModule,
    MailModule,

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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        // publiques
        'swagger',
        'swagger/(.*)',
        'auth/login',
        'auth/register',
        'auth/refresh',
        'health',

        // provisioning platform (pas de tenant requis)
        'admin/tenants',
        'admin/tenants/(.*)',
      )
      .forRoutes('*');
  }
}
