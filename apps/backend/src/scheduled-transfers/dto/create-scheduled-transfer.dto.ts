// apps/backend/src/scheduled-transfers/dto/create-scheduled-transfer.dto.ts
// =========================================================
// Corps de POST /scheduled-transfers (v1.0, phase 6) — avant, le contrôleur acceptait `body: any` :
// montant négatif ou nul, fréquence quelconque, devise inconnue, date illisible…
//
// payoutMethod : seul CASH_PICKUP est accepté. Le virement programmé débite l'expéditeur et crée un envoi
// à retirer en agence avec son code ; les autres modes (wallet, Mobile Money, banque) n'avaient aucun
// crédit côté destinataire : l'argent partait sans arriver.
// =========================================================

import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

export const SCHEDULED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'] as const;
export const SCHEDULED_FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;

export class CreateScheduledTransferDto {
  @IsString() @IsNotEmpty()
  beneficiaryId!: string;

  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @IsPositive() @Max(1_000_000_000_000)
  amount!: number;

  @Type(() => String) @IsIn(SCHEDULED_CURRENCIES)
  currency!: (typeof SCHEDULED_CURRENCIES)[number];

  @IsOptional() @IsIn(SCHEDULED_CURRENCIES)
  targetCurrency?: (typeof SCHEDULED_CURRENCIES)[number];

  @IsOptional() @IsIn(['CASH_PICKUP'], { message: 'Seul le retrait cash (CASH_PICKUP) est disponible pour un virement programmé.' })
  payoutMethod?: 'CASH_PICKUP';

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;

  @IsIn(SCHEDULED_FREQUENCIES)
  frequency!: (typeof SCHEDULED_FREQUENCIES)[number];

  /** Date de la première exécution (ISO 8601, dans le futur). Absente : exécution au prochain passage du planificateur. */
  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000)
  maxExecutions?: number;
}
