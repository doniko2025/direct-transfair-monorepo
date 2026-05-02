// apps/backend/src/users/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    PrismaModule,
    // ✅ CORRECTION CHIRURGICALE : Utilisation de forwardRef() pour briser la boucle avec UsersModule
    forwardRef(() => AuthModule), 
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}