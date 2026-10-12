// apps/backend/src/agents-admin/dto/agents-admin.dto.ts
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAgentDto {
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

  /** Agence de rattachement : elle doit appartenir à la société de l'administrateur. */
  @IsString()
  @IsNotEmpty()
  agencyId!: string;

  /** Désigne aussi cet agent comme responsable de l'agence. */
  @IsOptional()
  @IsBoolean()
  makeManager?: boolean;
}

export class AssignAgencyDto {
  @IsString()
  @IsNotEmpty()
  agencyId!: string;
}
