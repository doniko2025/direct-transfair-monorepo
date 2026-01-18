//apps/backend/src/agencies/dto/create-agency.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgencyDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsString()
  address!: string;

  // Prisma: phone est optionnel, donc DTO doit tolérer.
  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  // ✅ CHAMPS REQUIS pour la création de l'agent
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @IsOptional()
  @IsString()
  adminLastName?: string;

  @IsOptional()
  @IsString()
  adminPassword?: string;

  // ✅ CHAMPS TOLÉRÉS (envoyés par le front mais ignorés ou gérés ailleurs)
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  subscriptionType?: string;
}
