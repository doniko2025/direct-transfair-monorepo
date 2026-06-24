// apps/backend/src/auth/dto/v2-auth.dto.ts
// =========================================================
// DTOs AUTH v2 — Sécurité renforcée
// ✅ 3 méthodes : OTP Email | OTP SMS | Mot de passe
// ✅ OTP 6 chiffres (vs 4 en v1)
// ✅ Vérification email + téléphone avant connexion
// =========================================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

// ── 1. Connexion par mot de passe ─────────────────────────
export class LoginPasswordV2Dto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @Length(6, 128, { message: 'Le mot de passe doit faire au moins 6 caractères' })
  password!: string;
}

// ── 2. Demande OTP par email ──────────────────────────────
export class RequestOtpEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty()
  email!: string;
}

// ── 3. Demande OTP par téléphone ──────────────────────────
export class RequestOtpPhoneDto {
  @ApiProperty({ example: '+224622000000', description: 'Format international' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[\d\s\-().]{7,20}$/, {
    message: 'Numéro de téléphone invalide (format international requis)',
  })
  phone!: string;
}

// ── 4. Vérification OTP (connexion) ──────────────────────
export class VerifyOtpLoginV2Dto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    example: '123456',
    description: 'Code OTP à 6 chiffres reçu par email ou SMS',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Le code OTP doit comporter exactement 6 chiffres' })
  @Matches(/^\d{6}$/, { message: 'Le code OTP ne doit contenir que des chiffres' })
  code!: string;

  @ApiProperty({
    enum: ['EMAIL', 'SMS'],
    description: 'Canal via lequel le code a été envoyé',
  })
  @IsEnum(['EMAIL', 'SMS'], { message: "Canal invalide — utilisez 'EMAIL' ou 'SMS'" })
  channel!: 'EMAIL' | 'SMS';

  @ApiPropertyOptional({ description: "Identifiant unique de l'appareil" })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: "Marquer l'appareil comme fiable après connexion" })
  @IsOptional()
  trustDevice?: boolean;
}

// ── 5. Envoi OTP de vérification (post-inscription) ──────
export class SendVerificationOtpDto {
  @ApiProperty({ description: "Identifiant de l'utilisateur" })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    enum: ['EMAIL', 'PHONE'],
    description: 'Canal à vérifier',
  })
  @IsEnum(['EMAIL', 'PHONE'], { message: "Canal invalide — utilisez 'EMAIL' ou 'PHONE'" })
  channel!: 'EMAIL' | 'PHONE';
}

// ── 6. Vérification contact (email ou téléphone) ─────────
export class VerifyContactDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    example: '123456',
    description: 'Code OTP à 6 chiffres reçu pour vérification',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Le code doit comporter exactement 6 chiffres' })
  @Matches(/^\d{6}$/, { message: 'Le code ne doit contenir que des chiffres' })
  code!: string;

  @ApiProperty({ enum: ['EMAIL', 'PHONE'] })
  @IsEnum(['EMAIL', 'PHONE'], { message: "Canal invalide — utilisez 'EMAIL' ou 'PHONE'" })
  channel!: 'EMAIL' | 'PHONE';
}