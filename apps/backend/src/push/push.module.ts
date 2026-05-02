// apps/backend/src/push/push.module.ts
import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}