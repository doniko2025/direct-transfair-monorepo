//apps/backend/src/mail/mail.module.ts
import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';
import { WalletMailService } from './channels/wallet-mail.service';
import { AgentMailService } from './channels/agent-mail.service';
import { CompanyMailService } from './channels/company-mail.service';
import { AdminMailService } from './channels/admin-mail.service';

@Global()
@Module({
  providers: [
    MailService,
    WalletMailService,
    AgentMailService,
    CompanyMailService,
    AdminMailService,
  ],
  exports: [
    MailService,
    WalletMailService,
    AgentMailService,
    CompanyMailService,
    AdminMailService,
  ],
})
export class MailModule {}