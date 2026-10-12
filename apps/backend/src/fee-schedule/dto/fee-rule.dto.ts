// apps/backend/src/fee-schedule/dto/fee-rule.dto.ts
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrencyCode } from '@prisma/client';

import { CHARGED_METHOD_KEYS, MAX_FEE_RATE, MAX_FIXED_FEE } from '../../fees-admin/fee-rules';
import { FEE_COUNTRY_CODES } from '../countries';

export const MAX_RULE_AMOUNT = 1_000_000_000_000;

/** Une chaîne vide venue d'un formulaire veut dire « tous » : elle devient null. */
const emptyToNull = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : value);
/** Code en majuscules ; vide ou absent = null. Un seul @Transform par champ : leur ordre d'exécution n'est pas garanti. */
const nullableUpper = ({ value }: { value: unknown }) => {
  if (value === '' || value === undefined || value === null) return null;
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
};
/** Nombre ou null (« sans plafond »). Pas de @Type ici : il convertirait '' en 0 avant ce @Transform. */
const nullableNumber = ({ value }: { value: unknown }) => (value === '' || value === undefined || value === null ? null : Number(value));
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class FeeRuleBodyDto {
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60)
  label?: string | null;

  @IsOptional() @Transform(nullableUpper) @IsIn([...CHARGED_METHOD_KEYS])
  payoutMethod?: string | null;

  @IsOptional() @Transform(nullableUpper) @Matches(/^[A-Z]{2}$/) @IsIn([...FEE_COUNTRY_CODES])
  sendCountry?: string | null;

  @IsOptional() @Transform(nullableUpper) @Matches(/^[A-Z]{2}$/) @IsIn([...FEE_COUNTRY_CODES])
  receiveCountry?: string | null;

  @Transform(upper) @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_RULE_AMOUNT)
  minAmount!: number;

  @IsOptional() @Transform(nullableNumber) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_RULE_AMOUNT)
  maxAmount?: number | null;

  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_FEE_RATE)
  feeRate!: number;

  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(MAX_FIXED_FEE)
  fixedFee!: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class FeeRulesQueryDto {
  /** Super admin : société à consulter. Ignoré pour un admin de société. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  clientId?: number;
}

export class FeeRuleHistoryQueryDto extends FeeRulesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;
}

export class FeeQuoteQueryDto extends FeeRulesQueryDto {
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0.0001) @Max(MAX_RULE_AMOUNT)
  amount!: number;

  @Transform(upper) @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @Transform(upper) @IsIn([...CHARGED_METHOD_KEYS, 'MOBILE_MONEY', 'WALLET'])
  payoutMethod!: string;

  @IsOptional() @Transform(nullableUpper) @IsIn([...FEE_COUNTRY_CODES])
  receiveCountry?: string | null;

  /** Simulation par un administrateur : pays d'envoi imposé. Ignoré pour un client ou un agent. */
  @IsOptional() @Transform(nullableUpper) @IsIn([...FEE_COUNTRY_CODES])
  sendCountry?: string | null;
}
