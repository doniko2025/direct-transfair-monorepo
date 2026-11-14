// apps/backend/src/locations/locations.module.ts
// =========================================================
// LOCATIONS MODULE v1.0 — Direct Transf'air
// =========================================================

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule }   from '../auth/auth.module'; // JwtAuthGuard (GET /locations/contacts)

import { LocationsController } from './locations.controller';
import { LocationsService }    from './locations.service';

@Module({
  imports:     [PrismaModule, AuthModule],
  controllers: [LocationsController],
  providers:   [LocationsService],
})
export class LocationsModule {}