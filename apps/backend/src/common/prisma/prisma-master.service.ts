//apps/backend/src/common/prisma/prisma-master.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma MASTER
 * -----------------------
 * Contient :
 * - Clients (entreprises)
 * - Configuration SaaS
 */
@Injectable()
export class PrismaMasterService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
