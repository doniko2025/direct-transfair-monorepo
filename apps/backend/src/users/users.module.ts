// apps/backend/src/users/users.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller'; // ✅ Ajout du contrôleur

@Module({
  imports: [PrismaModule],
  controllers: [UsersController], // ✅ Enregistrement du contrôleur
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}