// apps/backend/src/withdrawals/withdrawals.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantsModule, // ✅ OBLIGATOIRE pour TenantGuard
  ],
  controllers: [WithdrawalsController],
  providers: [
    WithdrawalsService,
    AdminGuard,
  ],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
