// apps/backend/src/bills/dto/bills.dto.ts
// Corps et requêtes typés par classes : le ValidationPipe (whitelist) supprime tout champ non déclaré ici.
// Le détail métier (motifs, champs dynamiques, bornes) est contrôlé par bills.rules.ts avec des messages en français.
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

import { AMOUNT_MODES, BILLER_STATUSES, PARTNERSHIP_STATUSES } from '../bills.rules';
import { SCHEDULE_FREQUENCIES, SCHEDULE_MODES } from '../bills.schedule';

// ── Client ──────────────────────────────────────────────

export class BillersQueryDto {
  @IsOptional() @IsString() @MaxLength(40)
  category?: string;

  @IsOptional() @IsString() @MaxLength(60)
  q?: string;
}

export class BillLookupDto {
  @IsString() @MinLength(1) @MaxLength(64)
  reference!: string;

  @IsOptional() @IsObject()
  fields?: Record<string, unknown>;
}

export class BillQuoteDto extends BillLookupDto {
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false })
  amount!: number;

  /** Devise du portefeuille débité (par défaut : devise principale du compte). */
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/, { message: 'Devise invalide' })
  walletCurrency?: string;
}

export class PayBillDto extends BillQuoteDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'Code secret invalide' })
  pin!: string;

  /** Clé unique de CETTE confirmation (générée par l'application) : rejouer la requête ne débite pas deux fois. */
  @IsString() @MinLength(8) @MaxLength(80)
  idempotencyKey!: string;

  /** Enregistre la facture dans « Mes factures » sous ce nom. */
  @IsOptional() @IsString() @MaxLength(60)
  saveAs?: string;
}

export class MyBillsQueryDto {
  @IsOptional() @IsIn(['SUBMITTED', 'PROCESSING', 'COMPLETED', 'REFUNDED'])
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}

export class SaveBillDto {
  @IsString() @MinLength(1) @MaxLength(60)
  label!: string;

  @IsString() @MinLength(1) @MaxLength(40)
  billerId!: string;

  @IsString() @MinLength(1) @MaxLength(64)
  reference!: string;

  @IsOptional() @IsObject()
  fields?: Record<string, unknown>;

  @IsOptional() @IsString() @MaxLength(80)
  customerName?: string;
}

// ── Factures récurrentes (lot 14b) ──────────────────────

export class CreateBillScheduleDto {
  @IsString() @MinLength(1) @MaxLength(40)
  billerId!: string;

  /** Nom donné par le client : « Loyer appartement ». */
  @IsString() @MinLength(1) @MaxLength(60)
  label!: string;

  @IsString() @MinLength(1) @MaxLength(64)
  reference!: string;

  @IsOptional() @IsObject()
  fields?: Record<string, unknown>;

  @IsOptional() @IsString() @MaxLength(80)
  customerName?: string;

  /** Montant de chaque échéance (devise du facturier) — omis si le facturier fournit lui-même le montant. */
  @IsOptional() @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false })
  amount?: number;

  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/, { message: 'Devise invalide' })
  walletCurrency?: string;

  @IsIn([...SCHEDULE_FREQUENCIES])
  frequency!: string;

  /** Première échéance, AAAA-MM-JJ. */
  @IsString() @MaxLength(10)
  startDate!: string;

  /** Dernière date possible, AAAA-MM-JJ (facultatif : sans fin). */
  @IsOptional() @IsString() @MaxLength(10)
  endDate?: string;

  /** REMIND : rappel seul · AUTO : prélèvement automatique (code secret exigé, une seule fois, ici). */
  @IsIn([...SCHEDULE_MODES])
  mode!: string;

  @IsOptional() @IsString() @Matches(/^\d{6}$/, { message: 'Code secret invalide' })
  pin?: string;
}

export class UpdateBillScheduleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  label?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false })
  amount?: number;

  /** AAAA-MM-JJ, ou chaîne vide pour retirer la date de fin. */
  @IsOptional() @IsString() @MaxLength(10)
  endDate?: string;

  @IsOptional() @IsIn([...SCHEDULE_MODES])
  mode?: string;

  /** Exigé pour passer en prélèvement automatique ou changer le montant d'un prélèvement automatique. */
  @IsOptional() @IsString() @Matches(/^\d{6}$/, { message: 'Code secret invalide' })
  pin?: string;
}

export class ResumeBillScheduleDto {
  /** Exigé pour relancer un prélèvement automatique. */
  @IsOptional() @IsString() @Matches(/^\d{6}$/, { message: 'Code secret invalide' })
  pin?: string;
}

export class VerifyReceiptDto {
  @IsString() @MaxLength(120)
  code!: string;
}

// ── Société (administrateur) ────────────────────────────

export class BillerDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsString() @MaxLength(40)
  category!: string;

  @IsOptional() @IsString() @Matches(/^[A-Za-z]{2}$/, { message: 'Pays : code à 2 lettres' })
  country?: string;

  @IsString() @Matches(/^[A-Za-z]{3}$/, { message: 'Devise invalide' })
  currency!: string;

  @IsOptional() @IsString() @MaxLength(400)
  description?: string;

  @IsOptional() @IsIn([...BILLER_STATUSES])
  status?: string;

  @IsOptional() @IsString() @MaxLength(40)
  connectorKey?: string;

  @IsOptional() @IsString() @MaxLength(60)
  referenceLabel?: string;

  @IsOptional() @IsString() @MaxLength(160)
  referenceHint?: string;

  @IsOptional() @IsString() @MaxLength(120)
  referencePattern?: string;

  @IsOptional()
  fields?: unknown;

  @IsOptional() @IsIn([...AMOUNT_MODES])
  amountMode?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  minAmount?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  maxAmount?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  feeFixed?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(50)
  feePct?: number;

  @IsOptional() @IsIn([...PARTNERSHIP_STATUSES])
  partnershipStatus?: string;

  @IsOptional() @IsString() @MaxLength(600)
  settlementInfo?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720)
  settlementDelayHours?: number;

  @IsOptional() @IsString() @MaxLength(600)
  internalNote?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

/** Modification : tout est facultatif. */
export class UpdateBillerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(40)
  category?: string;

  @IsOptional() @IsString() @Matches(/^[A-Za-z]{2}$/, { message: 'Pays : code à 2 lettres' })
  country?: string | null;

  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/, { message: 'Devise invalide' })
  currency?: string;

  @IsOptional() @IsString() @MaxLength(400)
  description?: string | null;

  @IsOptional() @IsIn([...BILLER_STATUSES])
  status?: string;

  @IsOptional() @IsString() @MaxLength(40)
  connectorKey?: string;

  @IsOptional() @IsString() @MaxLength(60)
  referenceLabel?: string;

  @IsOptional() @IsString() @MaxLength(160)
  referenceHint?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  referencePattern?: string | null;

  @IsOptional()
  fields?: unknown;

  @IsOptional() @IsIn([...AMOUNT_MODES])
  amountMode?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  minAmount?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  maxAmount?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  feeFixed?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(50)
  feePct?: number;

  @IsOptional() @IsIn([...PARTNERSHIP_STATUSES])
  partnershipStatus?: string;

  @IsOptional() @IsString() @MaxLength(600)
  settlementInfo?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720)
  settlementDelayHours?: number;

  @IsOptional() @IsString() @MaxLength(600)
  internalNote?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class AdminPaymentsQueryDto {
  @IsOptional() @IsIn(['SUBMITTED', 'PROCESSING', 'COMPLETED', 'REFUNDED', 'OPEN'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(40)
  billerId?: string;

  /** true : seulement les factures en retard. */
  @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') @IsBoolean()
  late?: boolean;

  @IsOptional() @IsString() @MaxLength(64)
  q?: string;

  @IsOptional() @IsString() @MaxLength(10)
  from?: string;

  @IsOptional() @IsString() @MaxLength(10)
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;
}

export class ProcessBillDto {
  /** PROCESSING : « je m'en occupe » · COMPLETE : le facturier est réglé · FAIL : refus, le client est remboursé. */
  @IsIn(['PROCESSING', 'COMPLETE', 'FAIL'])
  action!: 'PROCESSING' | 'COMPLETE' | 'FAIL';

  /** Numéro de reçu / d'opération donné par le facturier (obligatoire pour COMPLETE). */
  @IsOptional() @IsString() @MaxLength(80)
  providerRef?: string;

  /** Jeton de compteur prépayé, code de recharge… (affiché au client). */
  @IsOptional() @IsString() @MaxLength(120)
  token?: string;

  @IsOptional() @IsString() @MaxLength(300)
  receiptNote?: string;

  /** Motif du refus (obligatoire pour FAIL ; montré au client). */
  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

// ── Rapprochement du fichier d'un facturier (lot 14b) ───

export class ColumnMappingDto {
  /** Intitulé de la colonne du montant, tel qu'écrit dans l'en-tête du fichier. */
  @IsString() @MinLength(1) @MaxLength(120)
  amount!: string;

  @IsOptional() @IsString() @MaxLength(120)
  providerRef?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  reference?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  date?: string | null;
}

export class ReconcileDto {
  @IsString() @MinLength(1) @MaxLength(40)
  billerId!: string;

  /** Contenu du fichier CSV du facturier (texte). */
  @IsString() @MinLength(1) @MaxLength(3_000_000)
  csv!: string;

  /** Colonnes à utiliser ; absentes, elles sont devinées d'après l'en-tête. */
  @IsOptional() @ValidateNested() @Type(() => ColumnMappingDto)
  mapping?: ColumnMappingDto;

  @IsOptional() @IsIn([';', ',', '\t', '|'])
  delimiter?: string;

  /** Période des factures à comparer (AAAA-MM-JJ) ; sinon déduite des dates du fichier, à défaut les 62 derniers jours. */
  @IsOptional() @IsString() @MaxLength(10)
  from?: string;

  @IsOptional() @IsString() @MaxLength(10)
  to?: string;

  /** Écart de montant toléré (arrondis du facturier), dans la devise du facturier. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000)
  tolerance?: number;
}
