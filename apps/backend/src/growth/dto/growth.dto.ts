// apps/backend/src/growth/dto/growth.dto.ts
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const CURRENCY = /^[A-Za-z]{3}$/;

export class QuoteRateLockDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount!: number;

  @IsString()
  @Matches(CURRENCY)
  currency!: string;

  @IsString()
  @Matches(CURRENCY)
  targetCurrency!: string;

  /** Montant que le client a SAISI côté « à recevoir » : le serveur crédite exactement ce montant (voir fitDesiredReceived). Facultatif. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000_000)
  desiredReceivedAmount?: number;
}

export class CreateMoneyRequestDto {
  /** Téléphone du client à qui l'on demande l'argent (compte de la même société). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  payerPhone!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000_000)
  amount!: number;

  @IsString()
  @Matches(CURRENCY)
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateReferralConfigDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() refereeWaivers?: number;
  @IsOptional() @IsNumber() referrerWaivers?: number;
  @IsOptional() @IsNumber() minFirstTransfer?: number;
  @IsOptional() @IsNumber() rewardValidityDays?: number;
  @IsOptional() @IsNumber() maxRewardsPerMonth?: number;
}

export class MoneyRequestListQuery {
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'DECLINED', 'CANCELLED', 'EXPIRED'])
  status?: string;
}
