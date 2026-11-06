// apps/backend/src/scheduled-transfers/dto/create-scheduled-transfer.dto.ts
// =========================================================
// Corps de POST /scheduled-transfers (v1.0, phase 6) — avant, le contrôleur acceptait `body: any` :
// montant négatif ou nul, fréquence quelconque, devise inconnue, date illisible…
//
// payoutMethod : CASH_PICKUP (code à retirer en agence), WALLET ou MOBILE_MONEY (crédit direct du bénéficiaire inscrit sur la
// plateforme). Chaque échéance est créée par TransactionsService.create() qui résout le destinataire et refuse l'envoi,
// sans débit, si aucun compte ne correspond. Les virements bancaires n'ont pas de circuit de paiement automatique.
// =========================================================

import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

export const SCHEDULED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'] as const;
export const SCHEDULED_FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;

export class CreateScheduledTransferDto {
  @IsString() @IsNotEmpty()
  beneficiaryId!: string;

  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 }) @IsPositive() @Min(0.01) @Max(1_000_000_000) // ✅ audit point 11 : même borne que les envois
  amount!: number;

  @Type(() => String) @IsIn(SCHEDULED_CURRENCIES)
  currency!: (typeof SCHEDULED_CURRENCIES)[number];

  @IsOptional() @IsIn(SCHEDULED_CURRENCIES)
  targetCurrency?: (typeof SCHEDULED_CURRENCIES)[number];

  @IsOptional() @IsIn(['CASH_PICKUP', 'WALLET', 'MOBILE_MONEY'], { message: 'Mode disponible pour un virement programmé : CASH_PICKUP, WALLET ou MOBILE_MONEY.' })
  payoutMethod?: 'CASH_PICKUP' | 'WALLET' | 'MOBILE_MONEY';

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
