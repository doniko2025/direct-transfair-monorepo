// apps/backend/src/supervision/supervision.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';

// PrismaModule est global ; AuthModule fournit le JwtService utilisé par JwtAuthGuard.
@Module({
  imports: [AuthModule],
  controllers: [SupervisionController],
  providers: [SupervisionService],
})
export class SupervisionModule {}
