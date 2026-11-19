import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const WATCHLIST_KINDS = ['SANCTION', 'PEP', 'INTERNAL'] as const;
export const CASE_ACTIONS = ['TAKE', 'ESCALATE', 'RESOLVE', 'DISMISS', 'RELEASE', 'REJECT'] as const;

export class WatchlistEntryDto {
  @IsIn(WATCHLIST_KINDS)
  kind!: (typeof WATCHLIST_KINDS)[number];

  @IsString() @MinLength(3) @MaxLength(160)
  fullName!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(160, { each: true })
  aliases?: string[];

  @IsOptional() @IsString() @MaxLength(60)
  country?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100)
  birthYear?: number;

  @IsOptional() @IsString() @MaxLength(80)
  reference?: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class UpdateWatchlistEntryDto {
  @IsOptional() @IsIn(WATCHLIST_KINDS)
  kind?: (typeof WATCHLIST_KINDS)[number];

  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  fullName?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(160, { each: true })
  aliases?: string[];

  @IsOptional() @IsString() @MaxLength(60)
  country?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100)
  birthYear?: number;

  @IsOptional() @IsString() @MaxLength(80)
  reference?: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ImportWatchlistDto {
  @IsIn(WATCHLIST_KINDS)
  kind!: (typeof WATCHLIST_KINDS)[number];

  /** Une personne par ligne : « Nom ; alias1 | alias2 ; pays ; année ; référence ». */
  @IsString() @IsNotEmpty() @MaxLength(400_000)
  text!: string;
}

export class TestNameDto {
  @IsString() @MinLength(2) @MaxLength(160)
  name!: string;
}

export class CaseActionDto {
  @IsIn(CASE_ACTIONS)
  action!: (typeof CASE_ACTIONS)[number];

  /** Obligatoire pour clore (RESOLVE, DISMISS, RELEASE, REJECT) : la décision doit être justifiée. */
  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class UpdateComplianceSettingsDto {
  @IsOptional() @IsBoolean()
  sanctionsEnabled?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(70) @Max(100)
  matchThreshold?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(70) @Max(100)
  strongMatchThreshold?: number;

  @IsOptional() @IsBoolean()
  holdOnStrongMatch?: boolean;

  /** null / absent = valeur de la plateforme. */
  @IsOptional() @IsNumber() @Min(1000) @Max(1_000_000_000_000)
  amlThresholdXof?: number | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  amlFlagScore?: number | null;

  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) @Matches(/^[A-Za-zÀ-ÿ' \-]{2,40}$/, { each: true })
  highRiskCountries?: string[];

  /** 0 ou 1 désactive la règle. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20)
  structuringCount?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20)
  fanInSenders?: number;

  /** Listes officielles activées : UN, OFAC, EU. */
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(['UN', 'OFAC', 'EU'], { each: true })
  officialLists?: string[];
}

export class ToggleOfficialListDto {
  @IsBoolean()
  enabled!: boolean;
}
