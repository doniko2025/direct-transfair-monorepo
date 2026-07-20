// apps/backend/src/commissions/commissions.controller.ts
// =========================================================
// COMMISSIONS CONTROLLER v5.0
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
  ) {}

  // =========================================================
  // ✅ v5.0 — Commissions réellement créditées à MON agence (agent)
  // Source : LedgerEntry (argent réel), pas un recalcul.
  // =========================================================
  @Get('ledger/mine')
  async getMyLedgerCommissions(
    @Req() req: { user?: AuthUserPayload },
    @Query('period') period: string = 'day',
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.clientId || !user.agencyId) {
      throw new ForbiddenException('Utilisateur non rattaché à une agence.');
    }
    return this.commissionsService.getMyLedgerCommissions(user.clientId, user.agencyId, period);
  }

  // =========================================================
  // ✅ v5.0 — Commissions réellement créditées à la société + à
  // chacune de ses agences (Admin Société uniquement).
  // =========================================================
  @Get('ledger/company')
  async getCompanyLedgerCommissions(
    @Req() req: { user?: AuthUserPayload },
    @Query('period') period: string = 'day',
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.clientId || user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'Admin Société.");
    }
    return this.commissionsService.getCompanyLedgerCommissions(user.clientId, period);
  }

  // =========================================================
  // ✅ v4.2 — GET /commissions/fees (inchangé)
  // =========================================================
  @Get('fees')
  async getFeeRates(@Req() req: { user?: AuthUserPayload }) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.clientId) return [];

    const configs = await this.prisma.commissionConfig.findMany({
      where: { clientId: user.clientId },
    });

    return configs
      .filter((c: any) => !!c.payoutMethod)
      .map((c: any) => ({
        payoutMethod: c.payoutMethod as string,
        feeRate:      (c.feeRate  ?? c.senderShare ?? 1.5) as number,
        fixedFee:     (c.fixedFee ?? 0)                    as number,
      }));
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