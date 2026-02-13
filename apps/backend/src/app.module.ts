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

// ✅ LE BON middleware
import { TenantMiddleware } from './tenants/tenant.middleware';

// modules globaux
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,
    PlatformModule,

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
      .apply(TenantMiddleware) // ✅ FIX CRITIQUE
      .exclude(
        'swagger',
        'swagger/(.*)',
        'auth/login',
        'auth/register',
        'auth/refresh',
        'health',
        'admin/tenants',
        'admin/tenants/(.*)',
      )
      .forRoutes('*');
  }
}
