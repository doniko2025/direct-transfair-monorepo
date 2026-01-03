// apps/backend/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';

import { PrismaClientManager } from '../common/prisma/prisma-client.manager';
import { PrismaService } from './prisma.service';
import { PrismaMultiTenantService } from './prisma-multitenant.service';
import { PrismaResolver } from './prisma-resolver.service';

@Global()
@Module({
  providers: [PrismaService, PrismaClientManager, PrismaMultiTenantService, PrismaResolver],
  exports: [PrismaService, PrismaClientManager, PrismaMultiTenantService, PrismaResolver],
})
export class PrismaModule {}
