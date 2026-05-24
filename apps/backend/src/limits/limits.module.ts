//apps/backend/src/limits/limits.module.ts
import { Module } from '@nestjs/common';
import { LimitsController } from './limits.controller';
import { LimitsService } from './limits.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ AJOUT
import { AuthModule } from '../auth/auth.module';           // ✅ AJOUT

@Module({
  imports: [
    PrismaModule,
    TenantsModule, // ✅ obligatoire pour TenantGuard
    AuthModule,    // ✅ obligatoire pour JwtAuthGuard
  ],
  controllers: [LimitsController],
  providers: [LimitsService],
})
export class LimitsModule {}