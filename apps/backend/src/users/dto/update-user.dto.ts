// apps/backend/src/users/dto/update-user.dto.ts
// =========================================================
// UPDATE USER DTO v1.0 (phase 6, passe 2) — corps de PATCH /users/:id.
// Avant : simple interface TypeScript, donc aucune validation à l'exécution : une valeur non textuelle
// (objet, nombre…) dans un champ faisait échouer Prisma en 500, et l'email n'était pas mis en minuscules
// (le compte ne pouvait plus se connecter, la connexion cherchant l'email en minuscules).
// =========================================================
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsEmail({}, { message: "L'email doit être valide" }) @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(30) gender?: string;
  @IsOptional() @IsString() @MaxLength(40) birthDate?: string;
  @IsOptional() @IsString() @MaxLength(100) nationality?: string;
  @IsOptional() @IsString() @MaxLength(200) addressStreet?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(50) mobileMoneyOperator?: string;
  @IsOptional() @IsString() @MaxLength(40) mobileMoneyNumber?: string;
}
