// apps/backend/src/sms/sms.module.ts
import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}