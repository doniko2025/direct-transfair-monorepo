// apps/backend/src/account-deletion/account-deletion.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PinVerifierService } from '../merchants/pin-verifier.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService, PinVerifierService], // PinVerifierService ne dépend que de PrismaService
})
export class AccountDeletionModule {}
