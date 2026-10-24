// apps/backend/src/contracts/contracts.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ContractsController, ContractsPublicController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [PrismaModule, AuthModule],
  // ContractsPublicController d'abord : « contracts/sign/:token » ne doit jamais être lu comme « contracts/:id ».
  controllers: [ContractsPublicController, ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
