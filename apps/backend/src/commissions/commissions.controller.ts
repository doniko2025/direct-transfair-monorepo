// apps/backend/src/commissions/commissions.controller.ts
// =========================================================
// COMMISSIONS CONTROLLER v5.1 — ✅ phase 6 : ?page=&limit= sur les deux routes ledger (voir service v5.2)
// ✅ v4.2 conservé : GET /fees, GET / (règles), POST / (upsert
//    règle/frais) — AUCUN changement, toujours utilisés par fees.tsx
//    et settings.tsx
//
// ✅ v5.0 : 🚨 REMPLACE /my-stats et /history
//
//   PROBLÈME RÉSOLU (juillet 2026), en plus de la refonte de la
//   source de données (voir commissions.service.ts v5.0) :
//   GET /commissions/history exigeait user.agencyId — or un
//   COMPANY_ADMIN n'a JAMAIS d'agencyId (agency est réservé aux
//   AGENT, voir personal-info-admin.tsx FIX 1). Résultat : cette
//   route renvoyait systématiquement 403 Forbidden pour un admin
//   société — admin/commissions/config.tsx, admin/commissions/
//   history.tsx et l'ancien admin/commissions.tsx n'ont donc jamais
//   pu charger la moindre donnée pour ce rôle, indépendamment de tout
//   le reste.
//
//   CORRECTIF : deux routes distinctes pour deux rôles aux besoins
//   différents, au lieu d'une route unique mal gatée pour les deux.
//   - GET /commissions/ledger/mine    → agent (exige agencyId, ce
//     qui est légitime pour ce rôle)
//   - GET /commissions/ledger/company → COMPANY_ADMIN (exige
//     clientId, PAS agencyId)
// =========================================================

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CommissionsService } from './commissions.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { isFreeMethod } from '../company-settings/company-settings.logic';
import { FEE_METHOD_KEYS } from '../fees-admin/fee-rules';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

@ApiTags('Commissions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(
    private readonly commissionsService: CommissionsService,
    private readonly prisma: PrismaService,
    private readonly settings: CompanySettingsService,
  ) {}

  // =========================================================
  // ✅ v5.0 — Commissions réellement créditées à MON agence (agent)
  // Source : LedgerEntry (argent réel), pas un recalcul.
  // =========================================================
  @Get('ledger/mine')
  async getMyLedgerCommissions(
    @Req() req: { user?: AuthUserPayload },
    @Query('period') period: string = 'day',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.clientId || !user.agencyId) {
      throw new ForbiddenException('Utilisateur non rattaché à une agence.');
    }
    return this.commissionsService.getMyLedgerCommissions(user.clientId, user.agencyId, period, page, limit);
  }

  // =========================================================
  // ✅ v5.0 — Commissions réellement créditées à la société + à
  // chacune de ses agences (Admin Société uniquement).
  // =========================================================
  @Get('ledger/company')
  async getCompanyLedgerCommissions(
    @Req() req: { user?: AuthUserPayload },
    @Query('period') period: string = 'day',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.getCompanyLedgerCommissions(user.clientId, period, page, limit);
  }

  // =========================================================
  // ✅ v4.2 — GET /commissions/fees (inchangé)
  // =========================================================
  @Get('fees')
  async getFeeRates(@Req() req: { user?: AuthUserPayload }) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.clientId) return [];

    const [configs, company] = await Promise.all([
      this.prisma.commissionConfig.findMany({ where: { clientId: user.clientId } }),
      this.settings.forClient(user.clientId),
    ]);
    const byMethod = new Map<string, any>();
    for (const c of configs as any[]) if (c.payoutMethod) byMethod.set(c.payoutMethod as string, c);

    // Une ligne par mode d'envoi : le tarif de la société s'il existe, sinon son taux de repli (paramètres de la société,
    // plus de 1,5 écrit ici). `charged` = faux pour les modes que la société a déclarés gratuits.
    return FEE_METHOD_KEYS.map((method) => {
      const c = byMethod.get(method);
      const charged = !isFreeMethod(company, method);
      return {
        payoutMethod: method,
        charged,
        feeRate: charged ? ((c?.feeRate ?? company.fees.fallbackFeeRatePct) as number) : 0,
        fixedFee: charged ? ((c?.fixedFee ?? 0) as number) : 0,
      };
    });
  }

  // =========================================================
  // Règles de commission (admin société) — inchangé
  // =========================================================
  @Get()
  async getMyRules(@Req() req: { user?: AuthUserPayload }) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.getClientRules(user.clientId);
  }

  // =========================================================
  // POST /commissions — inchangé
  // =========================================================
  @Post()
  async updateRule(
    @Req() req: { user?: AuthUserPayload },
    @Body() dto: UpdateCommissionDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }

    if (dto.payoutMethod) {
      const feeRate  = dto.feeRate  ?? dto.senderShare ?? 0;
      const fixedFee = dto.fixedFee ?? 0;
      return this.commissionsService.upsertFeeConfig(
        user.clientId,
        dto.payoutMethod,
        feeRate,
        fixedFee,
      );
    }

    return this.commissionsService.upsertRule(user.clientId, dto);
  }
}