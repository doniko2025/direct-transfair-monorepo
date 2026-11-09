// apps/backend/src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  /**
   * ✅ Compat uniquement:
   * - En SaaS "un lien par société", le tenant est résolu via x-tenant-id
   * - Donc le client n'a plus à saisir ce champ.
   */
  @IsString()
  @IsOptional()
  tenantCode?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  // ✅ phase 6 : le champ `role` n'existe plus. L'inscription publique crée
  // TOUJOURS un client (USER) ; ValidationPipe (whitelist) ignore un `role`
  // envoyé par le client. Agents et admins sont créés par un administrateur.

  @IsString()
  @IsOptional()
  phone?: string;

  /**
   * ✅ Code ISO alpha-2 (FR, GN, GB, US, SN…)
   *    → utilisé pour déduire la devise principale et créer le wallet automatiquement
   *    Ex: country="FR" → primaryCurrency="EUR" + Wallet EUR créé
   */
  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  addressStreet?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  birthCountry?: string;

  @IsString()
  @IsOptional()
  birthCity?: string;

  @IsString()
  @IsOptional()
  birthPlace?: string;

  /**
   * Lot 11 — type de compte choisi à l'inscription : PERSONAL (client, défaut) ou MERCHANT (commerçant).
   * Un compte MERCHANT exige le nom du commerce et le numéro Orange Money qui recevra les retraits.
   */
  @IsIn(['PERSONAL', 'MERCHANT'])
  @IsOptional()
  accountType?: 'PERSONAL' | 'MERCHANT';

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  businessCategory?: string;

  @IsString()
  @IsOptional()
  businessAddress?: string;

  @IsString()
  @IsOptional()
  businessCity?: string;

  /** Coordonnées complètes du commerce (facultatives, jamais reprises des données personnelles). */
  @IsString()
  @IsOptional()
  businessDistrict?: string;

  @IsString()
  @IsOptional()
  businessPostalCode?: string;

  @IsString()
  @IsOptional()
  businessCountry?: string;

  @IsString()
  @IsOptional()
  businessPhone?: string;

  @IsString()
  @IsOptional()
  businessTaxId?: string;

  /** Numéro RCCM du commerce — obligatoire pour un compte MERCHANT (validé par normalizeProfileInput). */
  @IsString()
  @IsOptional()
  businessRccm?: string;

  @IsString()
  @IsOptional()
  orangeMoneyPhone?: string;
}
