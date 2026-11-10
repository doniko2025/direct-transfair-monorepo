// apps/backend/src/merchants/dto/merchants.dto.ts
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  /** Code postal du commerce — facultatif. */
  @IsOptional()
  @IsString()
  @MaxLength(12)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  /** Téléphone du commerce (avec indicatif) — facultatif, distinct du téléphone personnel. */
  @IsOptional()
  @IsString()
  @MaxLength(25)
  businessPhone?: string;

  /** NIF / IFU — facultatif. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  /** Numéro RCCM — obligatoire (contrôlé et normalisé par normalizeRccm, qui renvoie le message d'erreur en français). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  rccm?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  /** Code postal du commerce — facultatif. */
  @IsOptional()
  @IsString()
  @MaxLength(12)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  /** Téléphone du commerce (avec indicatif) — facultatif, distinct du téléphone personnel. */
  @IsOptional()
  @IsString()
  @MaxLength(25)
  businessPhone?: string;

  /** NIF / IFU — facultatif. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  /** Numéro RCCM : modifiable seulement tant qu'il n'est pas renseigné (comptes antérieurs à la règle) ; ensuite, via le support. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  rccm?: string;
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

  /** Caissier : commerce pour lequel il encaisse (absent = mon propre commerce). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  merchantId?: string;

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

  /** Caissier : commerce pour lequel il encaisse (absent = mon propre commerce). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  merchantId?: string;

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

// ── Lot 13 ─────────────────────────────────────────────

export class RefundPaymentDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class UpdateAlertsDto {
  /** Seuil de solde bas (devise du compte) ; `null` supprime l'alerte. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  lowBalanceThreshold?: number | null;

  @IsOptional()
  @IsBoolean()
  failureAlertsEnabled?: boolean;
}

export class AddStaffDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;

  /** Numéro (avec indicatif) du compte client de la personne à ajouter. */
  @IsString()
  @MaxLength(25)
  phone!: string;

  @IsOptional()
  @IsBoolean()
  canRefund?: boolean;

  /** Plafond par encaissement ; absent ou null = pas de plafond propre. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  maxAmount?: number | null;
}

export class UpdateStaffDto {
  /** Exigé pour accorder le droit de rembourser. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  canRefund?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  maxAmount?: number | null;
}

export class SaveLogoDto {
  /** Image en base64, avec ou sans préfixe « data:image/...;base64, ». */
  @IsString()
  @MinLength(100, { message: 'Logo manquant.' })
  image!: string;
}

export class SaveRccmDocumentDto {
  /** Photo (JPEG, PNG, WebP) ou PDF du RCCM, en base64, avec ou sans préfixe « data:...;base64, ». */
  @IsString()
  @MinLength(100, { message: 'Document manquant.' })
  file!: string;
}

export class CloseDayDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: PIN_MESSAGE })
  pin!: string;

  /** Jour à clôturer, AAAA-MM-JJ (jour de l'appareil). */
  @IsString()
  @MaxLength(10)
  day!: string;

  /** Décalage de fuseau de l'appareil en minutes en plus de l'UTC (Paris hiver : 60). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tz?: number;
}
