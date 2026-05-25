// apps/backend/src/clients/dto/create-client.dto.ts
// =========================================================
// CREATE CLIENT DTO v2.1
// ✅ FIX: contactPhone, contactEmail ajoutés (manquaient)
// ✅ FIX: adminEmail + adminPassword requis (non optionnels)
// ✅ Champs branding : logoUrl, primaryColor, secondaryColor
// =========================================================

import {
  IsString, IsOptional, IsEmail, IsEnum,
  IsNotEmpty, Matches,
} from 'class-validator';
import { SubscriptionType, CurrencyCode } from '@prisma/client';

export class CreateClientDto {

  // ═══ IDENTITÉ SOCIÉTÉ ════════════════════════════════════
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  // ═══ BRANDING ════════════════════════════════════════════
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor doit être une couleur hex valide ex: #059669' })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor doit être une couleur hex valide ex: #10B981' })
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  splashBgColor?: string;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  // ═══ COORDONNÉES SOCIÉTÉ ═════════════════════════════════
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  activitySector?: string;

  // ✅ FIX — champs manquants dans l'ancien DTO
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  // ═══ ABONNEMENT ══════════════════════════════════════════
  @IsOptional()
  @IsEnum(SubscriptionType)
  subscriptionType?: SubscriptionType;

  @IsOptional()
  @IsEnum(CurrencyCode)
  defaultCurrency?: CurrencyCode;

  // ═══ PROPRIÉTAIRE LÉGAL ══════════════════════════════════
  @IsOptional()
  @IsString()
  ownerFirstName?: string;

  @IsOptional()
  @IsString()
  ownerLastName?: string;

  @IsOptional()
  @IsString()
  ownerCountry?: string;

  @IsOptional()
  @IsString()
  ownerBirthDate?: string;

  @IsOptional()
  @IsString()
  ownerBirthPlace?: string;

  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  // ═══ ADMIN À CRÉER (COMPANY_ADMIN) ═══════════════════════
  // ✅ Requis — sans ça la création échoue
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  adminLastName: string;

  @IsString()
  @IsNotEmpty()
  adminPassword: string;
}