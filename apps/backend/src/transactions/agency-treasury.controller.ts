// apps/backend/src/transactions/agency-treasury.controller.ts
// =========================================================
// AGENCY TREASURY CONTROLLER v1.0 — Direct Transf'air
// Fichier indépendant — n'ajoute aucune route à
// transactions.controller.ts existant.
//
// POST /transactions/agency/remit   — AGENT uniquement
//   Remontée de fonds : l'agent envoie des fonds de SA propre
//   agence vers le compte de la société.
//
// POST /transactions/agency/collect — COMPANY_ADMIN / SUPER_ADMIN
//   Retrait forcé : l'admin retire des fonds d'une agence de sa
//   société (choisie dans le body) vers son propre compte.
//   Réutilise AdminGuard (common/guards/admin.guard.ts), déjà
//   testé et utilisé ailleurs — pas de nouveau guard de rôle créé
//   pour ce cas.
//
// Le contrôle "AGENT uniquement" pour /remit utilise RolesGuard
// (auth/roles.guard.ts, déjà existant) avec un décorateur @Roles
// local à ce fichier (SetMetadata('roles', ...)) — pas besoin de
// dépendre d'un fichier roles.decorator.ts dont je n'ai pas la
// certitude qu'il existe déjà sous ce nom exact.
// =========================================================

import { Body, Controller, Post, Req, SetMetadata, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AdminGuard } from '../common/guards/admin.guard';

import { AgencyTreasuryService } from './agency-treasury.service';
import { CreateAgencyRemittanceDto } from './dto/create-agency-remittance.dto';
import { CreateAgencyCollectionDto } from './dto/create-agency-collection.dto';

const Roles = (...roles: string[]) => SetMetadata('roles', roles);

type AuthenticatedRequest = Request & {
  user?: { id: string; role?: string; clientId?: number; agencyId?: string | null };
};

@Controller('transactions/agency')
@UseGuards(JwtAuthGuard)
export class AgencyTreasuryController {
  constructor(private readonly agencyTreasury: AgencyTreasuryService) {}

  @Post('remit')
  @UseGuards(RolesGuard)
  @Roles('AGENT')
  async remit(@Req() req: AuthenticatedRequest, @Body() dto: CreateAgencyRemittanceDto) {
    return this.agencyTreasury.remitToAdmin(req.user!.id, dto);
  }

  @Post('collect')
  @UseGuards(AdminGuard)
  async collect(@Req() req: AuthenticatedRequest, @Body() dto: CreateAgencyCollectionDto) {
    return this.agencyTreasury.collectFromAgency(req.user!.id, dto);
  }
}