// apps/backend/src/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksScheduler } from './webhooks.scheduler';
import { WebhooksService } from './webhooks.service';

// PrismaModule est global ; AuthModule fournit le JwtService de JwtAuthGuard.
@Module({
  imports: [AuthModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksScheduler],
})
export class WebhooksModule {}
