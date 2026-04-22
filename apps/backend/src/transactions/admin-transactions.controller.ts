// apps/backend/src/transactions/admin-transactions.controller.ts
import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';

import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('Transactions (Admin)')
@ApiBearerAuth('access-token')
@ApiSecurity('x-tenant-id')
@Controller('transactions/admin')
@UseGuards(JwtAuthGuard, TenantGuard, AdminGuard)
export class AdminTransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
  ) {}

  // 🛑 ROUTE SUPPRIMÉE CAR ELLE CRÉAIT UN CONFLIT DÉSASTREUX
  // La route POST /transactions/admin/fund-self est déjà gérée
  // parfaitement dans transactions.controller.ts avec les bonnes vérifications de rôles.
}