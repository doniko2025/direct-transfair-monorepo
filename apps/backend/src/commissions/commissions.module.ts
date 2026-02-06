//apps/backend/src/commissions/commissions.module.ts
import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService, PrismaService],
  exports: [CommissionsService], // Exporté pour être utilisé par TransactionsService plus tard
})
export class CommissionsModule {}