// apps/backend/src/support/dto/support-staff.dto.ts
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSupportStaffDto {
  @Transform(trim)
  @IsEmail({}, { message: "L'email doit être valide." })
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** Délégations accordées dès la création (optionnel : par défaut aucune — le compte ne voit alors que son tableau de bord). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  permissions?: string[];
}

export class SetSupportPermissionsDto {
  /** Liste COMPLÈTE des délégations actives (les clés inconnues sont ignorées). */
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateSupportStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
