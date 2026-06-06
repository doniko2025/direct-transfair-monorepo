// apps/backend/src/locations/locations.module.ts
// =========================================================
// LOCATIONS MODULE v1.0 — Direct Transf'air
// =========================================================

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { LocationsController } from './locations.controller';
import { LocationsService }    from './locations.service';

@Module({
  imports:     [PrismaModule],
  controllers: [LocationsController],
  providers:   [LocationsService],
})
export class LocationsModule {}