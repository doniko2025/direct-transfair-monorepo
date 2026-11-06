// apps/backend/src/company-settings/company-settings.module.ts
import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';

// Global : les paramètres de la société sont lus par l'envoi, le retrait, les frais, la répartition, l'expiration…
// PrismaModule est global ; AuthModule fournit JwtService au JwtAuthGuard.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [CompanySettingsController],
  providers: [CompanySettingsService],
  exports: [CompanySettingsService],
})
export class CompanySettingsModule {}
