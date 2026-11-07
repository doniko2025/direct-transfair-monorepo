// apps/backend/src/merchants/merchant-payments.controller.ts
// =========================================================
// ENCAISSEMENTS — marchand : crée et suit ; client (ou marchand-payeur) : voit, paie, refuse.
//   POST /merchant-payments/phone            crée une demande adressée à un numéro        (marchand)
//   POST /merchant-payments/qr               crée un QR code d'encaissement               (marchand)
//   GET  /merchant-payments                  mes encaissements                            (marchand)
//   GET  /merchant-payments/incoming         les demandes qui attendent mon paiement      (client)
//   POST /merchant-payments/qr/preview       { payload }  aperçu d'un QR scanné           (client)
//   POST /merchant-payments/qr/pay           { payload, pin }  payer un QR scanné         (client)
//   GET  /merchant-payments/:id              suivi d'une demande (marchand ou payeur)
//   POST /merchant-payments/:id/pay          { pin }  payer une demande reçue par téléphone
//   POST /merchant-payments/:id/decline      refuser une demande reçue
//   POST /merchant-payments/:id/cancel       annuler une demande (marchand)
// Les routes fixes (qr/*, incoming) sont déclarées avant « :id ».
// =========================================================

import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePhonePaymentDto, CreateQrPaymentDto, PinDto } from './dto/merchants.dto';
import { MerchantPaymentsService } from './merchant-payments.service';

type AuthRequest = Request & { user?: AuthUserPayload };
const me = (req: AuthRequest): AuthUserPayload => {
  if (!req.user) throw new ForbiddenException('Non authentifié');
  return req.user;
};
const num = (v?: string): number | undefined => (v ? Number(v) || undefined : undefined);

class QrPayloadDto {
  /** Contenu lu par la caméra : lien de l'application ou jeton seul. */
  @IsString()
  @MaxLength(200)
  payload!: string;
}

class QrPayDto extends QrPayloadDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code secret : 6 chiffres.' })
  pin!: string;
}

@ApiTags('Encaissements marchand')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('merchant-payments')
export class MerchantPaymentsController {
  constructor(private readonly payments: MerchantPaymentsService) {}

  // L'envoi à un numéro révèle si le numéro a un compte : cadence limitée pour empêcher le balayage de numéros.
  @Post('phone')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createPhone(@Req() req: AuthRequest, @Body() body: CreatePhonePaymentDto) {
    return this.payments.createPhoneRequest(me(req), body);
  }

  @Post('qr')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createQr(@Req() req: AuthRequest, @Body() body: CreateQrPaymentDto) {
    return this.payments.createQrRequest(me(req), body);
  }

  @Get()
  list(@Req() req: AuthRequest, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.payments.listMine(me(req), { status, page: num(page), limit: num(limit) });
  }

  @Get('incoming')
  incoming(@Req() req: AuthRequest) {
    return this.payments.incoming(me(req));
  }

  @Post('qr/preview')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  previewQr(@Req() req: AuthRequest, @Body() body: QrPayloadDto) {
    return this.payments.previewQr(me(req), body.payload);
  }

  @Post('qr/pay')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  payQr(@Req() req: AuthRequest, @Body() body: QrPayDto) {
    return this.payments.payQr(me(req), body.payload, body.pin);
  }

  @Get(':id')
  one(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.payments.getOne(me(req), id);
  }

  @Post(':id/pay')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  pay(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: PinDto) {
    return this.payments.payRequest(me(req), id, body.pin);
  }

  @Post(':id/decline')
  decline(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.payments.decline(me(req), id);
  }

  @Post(':id/cancel')
  cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.payments.cancel(me(req), id);
  }
}
