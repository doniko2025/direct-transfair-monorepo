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

import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,
    PlatformModule,

    UsersModule,
    ClientsModule,
    TenantsModule,
    AuthModule,
    BeneficiariesModule,
    TransactionsModule,
    PaymentsModule,
    WithdrawalsModule,
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
