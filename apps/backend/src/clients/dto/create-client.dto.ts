// apps/backend/src/clients/dto/create-client.dto.ts
// =========================================================
// CREATE CLIENT DTO v2.2
// ✅ v2.1 conservé intégralement
// ✅ v2.2 : subdomain + customDomain ajoutés
//   - subdomain : "flash" → flash.direct-transfer.com
//     Validation : minuscules, chiffres, tirets uniquement
//   - customDomain : "www.flash-transfer.com"
//     Validation : format domaine valide
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
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primaryColor doit être une couleur hex valide ex: #059669',
  })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'secondaryColor doit être une couleur hex valide ex: #10B981',
  })
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

  // ═══ PORTAIL WEB DÉDIÉ ✅ v2.2 ═══════════════════════════
  // Sous-domaine auto : "flash" → flash.direct-transfer.com
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/, {
    message:
      'subdomain: minuscules/chiffres/tirets uniquement, 3–32 caractères, ' +
      'sans tiret en début ou fin. Ex: "flash", "miroir-transfer"',
  })
  subdomain?: string;

  // Domaine personnalisé : "www.flash-transfer.com"
  @IsOptional()
  @IsString()
  @Matches(
    /^(www\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/,
    {
      message:
        'customDomain invalide. Ex: "www.flash-transfer.com" ou "flash-transfer.com"',
    },
  )
  customDomain?: string;

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