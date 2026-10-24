// apps/backend/src/contracts/dto/contract.dto.ts
// DTO des contrats : conditions commerciales, émission, signature.

import { Type } from 'class-transformer';
import {
  Equals, IsBoolean, IsEmail, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export const CONTRACT_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'] as const;
export const CONTRACT_KINDS = ['RENTAL', 'PURCHASE'] as const;
export const BILLING_PERIODS = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

/** Conditions commerciales du contrat. Location : redevance par période ; achat : prix forfaitaire. */
export class ContractTermsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Le montant du contrat doit être supérieur à 0.' })
  @Max(1_000_000_000)
  amount: number;

  @IsIn(CONTRACT_CURRENCIES as unknown as string[])
  currency: string;

  @IsOptional()
  @IsIn(BILLING_PERIODS as unknown as string[])
  billingPeriod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  commitmentMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  maintenanceFeeYearly?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  paymentDays?: number;

  @IsOptional()
  @IsISO8601()
  effectiveDate?: string;
}

/** POST /contracts — émettre un contrat pour une société existante. */
export class IssueContractDto {
  @Type(() => Number)
  @IsInt()
  clientId: number;

  @IsOptional()
  @IsIn(CONTRACT_KINDS as unknown as string[])
  kind?: string;

  @ValidateNested()
  @Type(() => ContractTermsDto)
  terms: ContractTermsDto;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  /** Envoyer tout de suite le lien de signature par e-mail (défaut : oui). */
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}

export class CancelContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

/** POST /contracts/sign/:token — signature du client. */
export class SignContractDto {
  @IsString()
  @MinLength(3, { message: 'Saisissez votre nom complet.' })
  @MaxLength(120)
  signerName: string;

  /** Signature dessinée, PNG en data URL. */
  @IsString()
  @MaxLength(90_000)
  signature: string;

  @IsBoolean()
  @Equals(true, { message: 'Vous devez cocher « Lu et approuvé » pour signer.' })
  accept: boolean;
}
