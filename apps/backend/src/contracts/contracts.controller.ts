// apps/backend/src/contracts/contracts.controller.ts
// =========================================================
// CONTRATS — routes
//   Espace Grand Chef (SUPER_ADMIN, JWT) :
//     GET    /contracts                  liste (?status=PENDING|SIGNED|EXPIRED|CANCELLED &clientId= &q=)
//     GET    /contracts/:id              détail (texte, conditions, piste d'audit)
//     GET    /contracts/:id/pdf          PDF (signé si signé, sinon aperçu)
//     POST   /contracts                  émettre un contrat pour une société existante
//     POST   /contracts/:id/resend       nouveau lien de signature + e-mail
//     POST   /contracts/:id/resend-signed renvoyer le contrat signé par e-mail
//     POST   /contracts/:id/cancel       annuler un contrat non signé
//   Page publique de signature (sans connexion, protégée par le jeton du lien) :
//     GET    /contracts/sign/:token      contrat à lire
//     GET    /contracts/sign/:token/pdf  PDF (aperçu ou signé)
//     POST   /contracts/sign/:token      signer
// =========================================================

import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, StreamableFile, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CancelContractDto, IssueContractDto, SignContractDto } from './dto/contract.dto';
import { ContractsService } from './contracts.service';
import type { ContractKind, ContractTerms } from './contract-templates';

function sendPdf(res: Response, file: { buffer: Buffer; filename: string }, download: boolean): StreamableFile {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${file.filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  return new StreamableFile(file.buffer);
}

// ─── Page publique de signature ───────────────────────────
@ApiTags('Contrats — signature publique')
@Controller('contracts/sign')
export class ContractsPublicController {
  constructor(private readonly contracts: ContractsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Lire le contrat à signer (lien reçu par e-mail)' })
  get(@Param('token') token: string) {
    return this.contracts.getPublic(token);
  }

  @Get(':token/pdf')
  @ApiOperation({ summary: 'PDF du contrat (aperçu non signé, ou exemplaire signé)' })
  pdf(@Param('token') token: string, @Query('download') download: string, @Res({ passthrough: true }) res: Response) {
    return this.contracts.getPublicPdf(token).then((file) => sendPdf(res, file, download === '1'));
  }

  @Post(':token')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Signer le contrat en ligne' })
  sign(@Param('token') token: string, @Body() dto: SignContractDto, @Req() req: Request) {
    return this.contracts.sign(token, dto, { ip: req.ip, userAgent: req.get('user-agent') });
  }
}

// ─── Espace Grand Chef ────────────────────────────────────
@ApiTags('Contrats')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les contrats de toutes les sociétés' })
  list(@Query('status') status?: string, @Query('clientId') clientId?: string, @Query('q') q?: string) {
    const id = Number(clientId);
    return this.contracts.list({ status, q, clientId: Number.isInteger(id) && id > 0 ? id : undefined });
  }

  @Post()
  @ApiOperation({ summary: 'Émettre un contrat pour une société existante' })
  async issue(@Body() dto: IssueContractDto, @Req() req: { user?: AuthUserPayload }) {
    const issued = await this.contracts.issue({
      clientId: dto.clientId,
      kind: dto.kind as ContractKind | undefined,
      terms: dto.terms as Partial<ContractTerms>,
      recipientEmail: dto.recipientEmail,
      notify: dto.notify !== false,
      issuedById: req.user?.id ?? null,
    });
    // Le jeton n'est jamais renvoyé seul : l'adresse complète suffit à copier le lien si l'e-mail n'arrive pas.
    return {
      id: issued.id,
      reference: issued.reference,
      signUrl: issued.signUrl,
      expiresAt: issued.expiresAt,
      recipientEmail: issued.recipientEmail,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un contrat (texte, conditions, piste d'audit)" })
  getOne(@Param('id') id: string) {
    return this.contracts.getOne(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'PDF du contrat (signé si signé, sinon aperçu)' })
  async pdf(@Param('id') id: string, @Query('download') download: string, @Res({ passthrough: true }) res: Response) {
    return sendPdf(res, await this.contracts.pdf(id), download === '1');
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Envoyer un nouveau lien de signature (invalide l\'ancien)' })
  resend(@Param('id') id: string, @Req() req: { user?: AuthUserPayload }) {
    return this.contracts.resendLink(id, req.user?.id ?? '');
  }

  @Post(':id/resend-signed')
  @ApiOperation({ summary: 'Renvoyer par e-mail le contrat signé' })
  resendSigned(@Param('id') id: string, @Req() req: { user?: AuthUserPayload }) {
    return this.contracts.resendSigned(id, req.user?.id ?? '');
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Annuler un contrat non signé' })
  cancel(@Param('id') id: string, @Body() dto: CancelContractDto, @Req() req: { user?: AuthUserPayload }) {
    return this.contracts.cancel(id, req.user?.id ?? '', dto.reason);
  }
}
