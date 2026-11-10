// apps/backend/src/merchants/merchants-extras.controller.ts
// =========================================================
// LOT 13 — côté marchand / caissier / client (application mobile)
//   QR de caisse permanent
//     GET    /merchants/me/qr?merchantId=      QR à afficher ou imprimer (propriétaire, ou caissier avec ?merchantId=)
//     POST   /merchants/me/qr/rotate { pin }   renouvelle le QR (l'ancien cesse de fonctionner)
//   Logo
//     PUT    /merchants/me/logo { image }      envoie / remplace le logo       GET /merchants/me/logo   DELETE /merchants/me/logo
//     GET    /merchants/:shopId/logo           logo d'un commerce de ma société (client qui paie, caissier)
//   Alertes
//     PATCH  /merchants/me/alerts              seuil de solde bas, alerte « échecs de paiement »
//   Rapports et clôture de caisse (propriétaire)
//     GET    /merchants/me/report              ?from=&to=&tz=       JSON
//     GET    /merchants/me/report.csv          ?from=&to=&tz=       CSV
//     GET    /merchants/me/closing             ?day=&tz=            totaux du jour + clôtures déjà faites
//     POST   /merchants/me/closing { day, tz, pin }                 clôture la journée
//     GET    /merchants/me/closings                                 journées clôturées
//   Équipe de caisse
//     GET    /merchants/staff                  mes caissiers (propriétaire)
//     POST   /merchants/staff { pin, phone, canRefund?, maxAmount? }
//     PATCH  /merchants/staff/:id              droits, plafond, suspension
//     DELETE /merchants/staff/:id              retirer un caissier
//     GET    /merchants/staff/memberships      les commerces où je suis caissier
//     GET    /merchants/staff/day?merchantId=&tz=   mon total du jour dans ce commerce
// Les routes fixes sont déclarées avant « :shopId/logo ».
// =========================================================

import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { AddStaffDto, CloseDayDto, PinDto, SaveLogoDto, SaveRccmDocumentDto, UpdateAlertsDto, UpdateStaffDto } from './dto/merchants.dto';
import { MerchantLogoService } from './merchant-logo.service';
import { MerchantRccmDocumentService } from './merchant-rccm-document.service';
import { MerchantReportsService } from './merchant-reports.service';
import { MerchantStaffService } from './merchant-staff.service';
import { MerchantsService } from './merchants.service';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};
/** Document privé : jamais mis en cache partagé, affiché dans le navigateur/l'application (image ou PDF), jamais interprété comme autre chose. */
export function sendDocument(res: Response, f: { buffer: Buffer; mimeType: string; sha256: string }): void {
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Length', String(f.buffer.length));
  res.setHeader('ETag', `"${f.sha256}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="rccm.${f.mimeType === 'application/pdf' ? 'pdf' : f.mimeType.split('/')[1] ?? 'bin'}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(f.buffer);
}
const shortId = (v?: string): string | undefined => (v ? v.slice(0, 40) : undefined);

@ApiTags('Marchand — caisse')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('merchants')
export class MerchantsExtrasController {
  constructor(
    private readonly merchants: MerchantsService,
    private readonly logos: MerchantLogoService,
    private readonly rccmDocs: MerchantRccmDocumentService,
    private readonly staff: MerchantStaffService,
    private readonly reports: MerchantReportsService,
  ) {}

  // ── QR de caisse permanent ─────────────────────────────

  @Get('me/qr')
  qr(@Req() req: AuthRequest, @Query('merchantId') merchantId?: string) {
    return this.merchants.getStaticQr(me(req), shortId(merchantId));
  }

  @Post('me/qr/rotate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  rotateQr(@Req() req: AuthRequest, @Body() body: PinDto) {
    return this.merchants.rotateStaticQr(me(req), body.pin);
  }

  // ── Alertes ────────────────────────────────────────────

  @Patch('me/alerts')
  alerts(@Req() req: AuthRequest, @Body() body: UpdateAlertsDto) {
    return this.merchants.updateAlerts(me(req), body);
  }

  // ── Logo ───────────────────────────────────────────────

  @Put('me/logo')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  saveLogo(@Req() req: AuthRequest, @Body() body: SaveLogoDto) {
    return this.logos.save(me(req).id, body.image);
  }

  @Delete('me/logo')
  removeLogo(@Req() req: AuthRequest) {
    return this.logos.remove(me(req).id);
  }

  @Get('me/logo')
  async myLogo(@Req() req: AuthRequest, @Res() res: Response) {
    const user = me(req);
    return this.sendLogo(req, res, await this.logos.shopIdOf(user.id), user.clientId);
  }

  // ── Pièce justificative du RCCM ────────────────────────

  @Put('me/rccm-document')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  saveRccmDocument(@Req() req: AuthRequest, @Body() body: SaveRccmDocumentDto) {
    return this.rccmDocs.save(me(req).id, body.file);
  }

  @Get('me/rccm-document')
  async myRccmDocument(@Req() req: AuthRequest, @Res() res: Response) {
    return sendDocument(res, await this.rccmDocs.readMine(me(req).id));
  }

  // ── Rapports et clôture ────────────────────────────────

  @Get('me/report')
  report(@Req() req: AuthRequest, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string) {
    return this.reports.report(me(req), { from, to, tz });
  }

  @Get('me/report.csv')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  async reportCsv(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response, @Query('from') from?: string, @Query('to') to?: string, @Query('tz') tz?: string) {
    const f = await this.reports.csv(me(req), { from, to, tz });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename}"`);
    return f.body;
  }

  @Get('me/closing')
  closing(@Req() req: AuthRequest, @Query('day') day?: string, @Query('tz') tz?: string) {
    return this.reports.day(me(req), { day, tz });
  }

  @Post('me/closing')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  close(@Req() req: AuthRequest, @Body() body: CloseDayDto) {
    return this.reports.close(me(req), body);
  }

  @Get('me/closings')
  closings(@Req() req: AuthRequest) {
    return this.reports.closings(me(req));
  }

  // ── Équipe de caisse ───────────────────────────────────

  @Get('staff')
  listStaff(@Req() req: AuthRequest) {
    return this.staff.list(me(req));
  }

  @Post('staff')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  addStaff(@Req() req: AuthRequest, @Body() body: AddStaffDto) {
    return this.staff.add(me(req), body);
  }

  @Get('staff/memberships')
  memberships(@Req() req: AuthRequest) {
    return this.staff.memberships(me(req));
  }

  @Get('staff/day')
  staffDay(@Req() req: AuthRequest, @Query('merchantId') merchantId?: string, @Query('tz') tz?: string) {
    return this.staff.myDay(me(req), shortId(merchantId) ?? '', tz);
  }

  @Patch('staff/:id')
  updateStaff(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: UpdateStaffDto) {
    return this.staff.update(me(req), id, body);
  }

  @Delete('staff/:id')
  removeStaff(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.staff.remove(me(req), id);
  }

  // ── Logo d'un commerce (en dernier : « :shopId » ne doit pas masquer les routes fixes) ──

  @Get(':shopId/logo')
  async shopLogo(@Req() req: AuthRequest, @Param('shopId') shopId: string, @Res() res: Response) {
    return this.sendLogo(req, res, shopId.slice(0, 40), me(req).clientId);
  }

  /** Réponses « private, no-cache » + ETag : l'application ne retélécharge que si le logo a changé (If-None-Match → 304). */
  private async sendLogo(req: AuthRequest, res: Response, shopId: string, clientId: number | undefined): Promise<void> {
    const version = await this.logos.version(shopId, clientId);
    const etag = version ? `"${version}"` : null;
    if (etag && req.headers['if-none-match'] === etag) {
      res.status(304).setHeader('ETag', etag).setHeader('Cache-Control', 'private, no-cache').end();
      return;
    }
    const f = await this.logos.read(shopId, clientId); // 404 si aucun logo
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Length', String(f.buffer.length));
    res.setHeader('ETag', `"${f.sha256}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(f.buffer);
  }
}
