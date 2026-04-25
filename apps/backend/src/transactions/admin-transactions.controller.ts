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
// ✅ CORRECTION CHIRURGICALE : 
// On change le chemin du contrôleur pour éviter que NestJS ne "hijack" (détourne) 
// les requêtes destinées à `transactions.controller.ts` qui, lui, gère vraiment /transactions/admin/fund-self
@Controller('deprecated-admin-transactions') 
@UseGuards(JwtAuthGuard, TenantGuard, AdminGuard)
export class AdminTransactionsController {
  
  // Les routes sont vides, la gestion est faite dans transactions.controller.ts
}