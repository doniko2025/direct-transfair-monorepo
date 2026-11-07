// apps/backend/src/kyc/kyc.controller.ts
// =========================================================
// KYC CONTROLLER v1.0
//   CLIENT  GET  /kyc/me                         mon dossier
//           POST /kyc/documents                  envoyer une pièce (JSON base64)
//           GET  /kyc/documents/:id/:kind        relire ma pièce (front | back)
//   ADMIN   GET  /kyc/admin/stats                compteurs de la société
//           GET  /kyc/admin/queue                file de validation (status, search, page, limit)
//           GET  /kyc/admin/users/:userId        dossier complet d'un client (consultation journalisée)
//           GET  /kyc/admin/counter-customers[/:id[/file/:kind]]   clients de passage et photos de leur pièce (journalisé)
//           POST /kyc/admin/documents/:id/approve | reject
//           POST /kyc/admin/users/:userId/remind
// Les pièces ne sont jamais servies sans jeton ; réponses « no-store » pour qu'aucun cache ne les garde.
// =========================================================

import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { ApproveKycDocumentDto, RejectKycDocumentDto, SubmitKycDocumentDto } from './dto/kyc.dto';
import { CounterAdminService } from './counter-admin.service';
import { KycService } from './kyc.service';

type Authed = Request & { user?: AuthUserPayload };

function me(req: Authed): AuthUserPayload {
  if (!req.user?.id) throw new ForbiddenException('Non authentifié');
  return req.user;
}

@ApiTags('KYC')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kyc: KycService,
    private readonly counterAdmin: CounterAdminService,
  ) {}

  // ── Client ───────────────────────────────────────────
  @Get('me')
  getMine(@Req() req: Authed) {
    return this.kyc.getMyStatus(me(req).id);
  }

  @Post('documents')
  submit(@Req() req: Authed, @Body() dto: SubmitKycDocumentDto) {
    return this.kyc.submit(me(req).id, dto);
  }

  // ── Admin (déclarées AVANT les routes à paramètres) ──
  @Get('admin/stats')
  stats(@Req() req: Authed, @Query('clientId') clientId?: string) {
    return this.kyc.adminStats(me(req), clientId ? Number(clientId) || undefined : undefined);
  }

  @Get('admin/queue')
  queue(
    @Req() req: Authed,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.kyc.adminQueue(me(req), {
      status,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      clientId: clientId ? Number(clientId) || undefined : undefined,
    });
  }

  // ── Clients de passage (lot 8) : fiche + photos de la pièce prises au comptoir ──
  @Get('admin/counter-customers')
  counterList(@Req() req: Authed, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('clientId') clientId?: string) {
    return this.counterAdmin.list(me(req), {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      clientId: clientId ? Number(clientId) || undefined : undefined,
    });
  }

  @Get('admin/counter-customers/:id')
  counterDetail(@Req() req: Authed, @Param('id') id: string) {
    return this.counterAdmin.detail(me(req), id);
  }

  @Get('admin/counter-customers/:id/file/:kind')
  async counterFile(@Req() req: Authed, @Param('id') id: string, @Param('kind') kind: string, @Res() res: Response) {
    if (kind !== 'front' && kind !== 'back') throw new NotFoundException('Photo introuvable.');
    const f = await this.counterAdmin.getFile(me(req), id, kind);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Length', String(f.buffer.length));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${f.name}.${f.mimeType === 'application/pdf' ? 'pdf' : f.mimeType.split('/')[1]}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
    res.end(f.buffer);
  }

  @Get('admin/users/:userId')
  dossier(@Req() req: Authed, @Param('userId') userId: string) {
    return this.kyc.adminDossier(me(req), userId);
  }

  @Post('admin/documents/:id/approve')
  approve(@Req() req: Authed, @Param('id') id: string, @Body() dto: ApproveKycDocumentDto) {
    return this.kyc.approve(me(req), id, dto?.note);
  }

  @Post('admin/documents/:id/reject')
  reject(@Req() req: Authed, @Param('id') id: string, @Body() dto: RejectKycDocumentDto) {
    return this.kyc.reject(me(req), id, dto.reason);
  }

  @Post('admin/users/:userId/remind')
  remind(@Req() req: Authed, @Param('userId') userId: string) {
    return this.kyc.adminRemind(me(req), userId);
  }

  // ── Contenu d'une pièce (propriétaire, admins de sa société, super admin) ──
  @Get('documents/:id/:kind')
  async file(@Req() req: Authed, @Param('id') id: string, @Param('kind') kind: string, @Res() res: Response) {
    if (kind !== 'front' && kind !== 'back') throw new NotFoundException('Fichier introuvable.');
    const f = await this.kyc.getFile(me(req), id, kind);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Length', String(f.buffer.length));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${f.name}.${f.mimeType === 'application/pdf' ? 'pdf' : f.mimeType.split('/')[1]}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
    res.end(f.buffer);
  }
}
