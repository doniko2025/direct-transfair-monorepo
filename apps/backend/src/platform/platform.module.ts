// apps/backend/src/platform/platform.module.ts
import { Global, Module } from '@nestjs/common';
import { PlatformPrismaService } from './platform-prisma.service';

@Global()
@Module({
  providers: [PlatformPrismaService],
  exports: [PlatformPrismaService],
})
export class PlatformModule {}
