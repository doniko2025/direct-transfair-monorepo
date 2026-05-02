// apps/backend/src/mail/mail.module.ts
import { Module, Global } from '@nestjs/common';

import { MailService } from './mail.service';
import { WalletMailService } from './channels/wallet-mail.service';
import { CompanyMailService } from './channels/company-mail.service';
import { AgentMailService } from './channels/agent-mail.service';
import { AdminMailService } from './channels/admin-mail.service';

import { PrismaModule } from '../prisma/prisma.module';

@Global() // ✅ Disponible partout sans ré-import
@Module({
  imports: [PrismaModule],
  providers: [
    MailService,
    WalletMailService,
    CompanyMailService,
    AgentMailService,
    AdminMailService,
  ],
  exports: [
    MailService,
    WalletMailService,
    CompanyMailService,
    AgentMailService,
    AdminMailService,
  ],
})
export class MailModule {}