// apps/backend/src/clients/branding.controller.ts
// =========================================================
// BRANDING PUBLIC CONTROLLER v2.0
// ✅ v1.0 conservé : GET /branding/:code
// ✅ v2.0 : GET /branding/by-host?host=flash.direct-transfer.com
//   → Résolution du branding depuis un hostname (web)
//   → Permet à TenantProvider de détecter le tenant au démarrage
//     sans que l'utilisateur n'ait à entrer un code société
//   → Aucune authentification requise (public)
//   → Délègue à clientsService.findPublicByHost()
//   IMPORTANT : by-host doit être déclaré AVANT :code
//   pour éviter que NestJS/Express ne l'intercepte comme param
// =========================================================

import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ClientsService } from './clients.service';

@ApiTags('Branding Public')
@Controller('branding') // Pas de JwtAuthGuard → routes 100% publiques
export class BrandingController {
  constructor(private readonly clientsService: ClientsService) {}

  // ──────────────────────────────────────────────────────
  // ✅ v2.0 — GET /branding/by-host?host=flash.direct-transfer.com
  //
  // Appelé par TenantProvider.tsx au démarrage de l'app web
  // pour détecter automatiquement la société depuis le hostname.
  //
  // Exemples d'appels :
  //   GET /branding/by-host?host=flash.direct-transfer.com
  //   GET /branding/by-host?host=www.flash-transfer.com
  //
  // Résolution dans ClientsService.findPublicByHost() :
  //   1. customDomain exact  (www.flash-transfer.com)
  //   2. subdomain extrait   ("flash" de flash.direct-transfer.com)
  //   3. code = subdomain    (fallback rétrocompat)
  //
  // DOIT être avant @Get(':code') — sinon NestJS catcherait "by-host" comme :code
  // ──────────────────────────────────────────────────────
  @Get('by-host')
  @ApiOperation({
    summary: 'Branding public depuis un hostname — aucune auth requise',
    description:
      'Résout le branding depuis un sous-domaine (flash.direct-transfer.com) ' +
      'ou un domaine personnalisé (www.flash-transfer.com). ' +
      'Appelé par le frontend au démarrage pour détecter le tenant automatiquement.',
  })
  @ApiQuery({
    name: 'host',
    required: true,
    description: 'Hostname complet. Ex: flash.direct-transfer.com',
    example: 'flash.direct-transfer.com',
  })
  async getBrandingByHost(@Query('host') host: string) {
    if (!host?.trim()) {
      throw new BadRequestException('Paramètre "host" requis.');
    }

    const normalized = host.trim().toLowerCase();

    // Sécurité : rejeter les hostnames trop courts ou manifestement invalides
    if (normalized.length < 4 || !normalized.includes('.')) {
      throw new BadRequestException('Hostname invalide.');
    }

    const branding = await this.clientsService.findPublicByHost(normalized);

    if (!branding) {
      throw new NotFoundException(
        `Aucun portail trouvé pour l'hôte "${normalized}". ` +
        `Vérifiez le sous-domaine ou contactez votre administrateur.`,
      );
    }

    return branding;
  }

  // ──────────────────────────────────────────────────────
  // GET /branding/:code
  //
  // Appelé par TenantProvider.loadBranding(code) quand
  // l'utilisateur saisit manuellement son code société.
  // DOIT être après @Get('by-host') pour éviter les conflits.
  // ──────────────────────────────────────────────────────
  @Get(':code')
  @ApiOperation({
    summary: 'Branding public d\'une société par code — aucune auth requise',
  })
  async getBranding(@Param('code') code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('Code société requis.');
    }

    const branding = await this.clientsService.findPublicByCode(
      code.trim().toUpperCase(),
    );

    if (!branding) {
      throw new NotFoundException(
        `Société "${code.toUpperCase()}" introuvable ou inactive.`,
      );
    }

    return branding;
  }
}