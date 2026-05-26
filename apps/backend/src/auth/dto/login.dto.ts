// apps/backend/src/auth/dto/login.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // ✅ Conservé : le frontend actuel envoie email, mais ce champ accepte aussi un téléphone.
  // Le service détecte le format automatiquement.
  @ApiProperty({ description: 'Email OU numéro de téléphone' }) 
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;

  // ✅ Nouveau (optionnel) : permet au frontend de poster explicitement identifier
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identifier?: string;
}

// ─── Étape 2 : vérification OTP après login (nouveau flow) ────────
export class VerifyLoginOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: "Marquer l'appareil comme fiable" })
  @IsOptional()
  trustDevice?: boolean;
}