// apps/backend/src/beneficiaries/beneficiaries.module.ts
import { Module } from '@nestjs/common';

import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    AuthModule, // 🔑 OBLIGATOIRE pour JwtAuthGuard
  ],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService],
})
export class BeneficiariesModule {}
