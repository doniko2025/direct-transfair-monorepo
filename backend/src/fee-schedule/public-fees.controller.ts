// apps/backend/src/fee-schedule/public-fees.controller.ts
// =========================================================
// PUBLIC FEES CONTROLLER v1.0 — estimation des frais AVANT connexion (écran d'accueil de l'app)
//   GET /public-fees/quote?code=FLASH&amount=100&currency=EUR&payoutMethod=WALLET&sendCountry=FR&receiveCountry=GN
//
// Aucune authentification : la société est désignée par son code public (le même que /branding/:code). Le calcul est EXACTEMENT
// celui du serveur (FeeScheduleService.quote — barème de la société, modes gratuits, frais fixe converti) : l'estimation de
// l'accueil ne peut donc pas différer du montant facturé pour les mêmes paramètres. Aucune donnée personnelle n'est lue ni
// renvoyée : seulement le montant des frais. Limitée à 30 requêtes / minute / IP.
// =========================================================

import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CurrencyCode } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { FEE_METHOD_KEYS } from '../fees-admin/fee-rules';
import { FEE_COUNTRY_CODES } from './countries';
import { FeeScheduleService } from './fee-schedule.service';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const nullableUpper = ({ value }: { value: unknown }) => {
  if (value === '' || value === undefined || value === null) return null;
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
};

export class PublicFeeQuoteQueryDto {
  @IsString() @MaxLength(40) @Transform(upper)
  code!: string;

  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0.0001) @Max(1_000_000_000)
  amount!: number;

  @Transform(upper) @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @Transform(upper) @IsIn([...FEE_METHOD_KEYS])
  payoutMethod!: string;

  /** Pays d'envoi supposé (l'expéditeur n'est pas connu avant la connexion). */
  @IsOptional() @Transform(nullableUpper) @Matches(/^[A-Z]{2}$/) @IsIn([...FEE_COUNTRY_CODES])
  sendCountry?: string | null;

  @IsOptional() @Transform(nullableUpper) @Matches(/^[A-Z]{2}$/) @IsIn([...FEE_COUNTRY_CODES])
  receiveCountry?: string | null;
}

@ApiTags('Fee schedule public')
@Controller('public-fees') // pas de JwtAuthGuard : route publique (estimation uniquement)
export class PublicFeesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: FeeScheduleService,
  ) {}

  @Get('quote')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Estimation des frais d’un envoi avant connexion (barème de la société, sans authentification)' })
  async quote(@Query() q: PublicFeeQuoteQueryDto) {
    if (!q.code?.trim()) throw new BadRequestException('Code société requis.');
    const client = await this.prisma.client.findFirst({
      where: { code: q.code.toUpperCase(), isActive: true },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Société introuvable.');

    const r = await this.schedule.quote({
      clientId: client.id,
      senderId: null,
      payoutMethod: q.payoutMethod,
      amount: q.amount,
      currency: q.currency,
      receiveCountry: q.receiveCountry ?? null,
      sendCountry: q.sendCountry ?? undefined,
    });
    // On ne renvoie que l'essentiel (pas la règle interne ni son identifiant).
    return { fees: r.fees, total: r.total, currency: r.currency, estimated: true };
  }
}
