// apps/backend/src/merchants/dto/merchants.dto.ts
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

/** Code secret à 6 chiffres — confirmation d'une opération sensible. */
const PIN_MESSAGE = 'Code secret : 6 chiffres.';

export class PinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;
}

export class MerchantProfileInputDto {
  @IsString()
  @MinLength(2, { message: 'Nom du commerce : 2 caractères minimum.' })
  @MaxLength(80)
  businessName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  /** Numéro Orange Money qui recevra les retraits (avec l'indicatif du pays). Obligatoire en GNF / XOF, refusé pour les autres devises. */
  @IsOptional()
  @IsString()
  @MaxLength(25)
  orangeMoneyPhone?: string;
}

export class ActivateMerchantDto extends MerchantProfileInputDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;
}

export class UpdateMerchantProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;
}

export class ChangeDestinationDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  orangeMoneyPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankHolderName?: string;

  /** Chaîne vide : retire le compte bancaire. */
  @IsOptional()
  @IsString()
  @MaxLength(42)
  bankIban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  bankBic?: string;
}

export class SuspendMerchantDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class MerchantListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;
}

export class CreatePhonePaymentDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  amount!: number;

  /** Numéro du client (celui de son compte Direct Transf'air / Orange Money), avec indicatif. */
  @IsString()
  @MaxLength(25)
  payerPhone!: string;

  @IsOptional()
  @IsIn(['XOF', 'EUR', 'USD', 'GNF', 'GBP'])
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}

export class CreateQrPaymentDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  amount!: number;

  @IsOptional()
  @IsIn(['XOF', 'EUR', 'USD', 'GNF', 'GBP'])
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}

export class RequestPayoutDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  amount!: number;

  @IsIn(['ORANGE_MONEY', 'BANK_TRANSFER'])
  method!: 'ORANGE_MONEY' | 'BANK_TRANSFER';

  @IsOptional()
  @IsIn(['XOF', 'EUR', 'USD', 'GNF', 'GBP'])
  currency?: string;
}

export class RejectPayoutDto {
  @IsString()
  @MinLength(3, { message: 'Indiquez le motif du refus.' })
  @MaxLength(300)
  reason!: string;
}

export class MarkPayoutPaidDto {
  /** Référence de l'opérateur (Orange Money) ou du virement, pour le rapprochement. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerRef?: string;
}
