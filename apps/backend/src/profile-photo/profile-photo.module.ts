// apps/backend/src/profile-photo/profile-photo.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfilePhotoController } from './profile-photo.controller';
import { ProfilePhotoService } from './profile-photo.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProfilePhotoController],
  providers: [ProfilePhotoService],
  exports: [ProfilePhotoService],
})
export class ProfilePhotoModule {}
