// apps/backend/src/agents-admin/agents-admin.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { AgentsAdminController } from './agents-admin.controller';
import { AgentsAdminService } from './agents-admin.service';

// PrismaModule est global ; AuthModule fournit le JwtService de JwtAuthGuard ; MailModule exporte MailService.
@Module({
  imports: [AuthModule, MailModule],
  controllers: [AgentsAdminController],
  providers: [AgentsAdminService],
})
export class AgentsAdminModule {}
