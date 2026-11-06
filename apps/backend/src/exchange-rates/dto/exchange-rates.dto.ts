// apps/backend/src/exchange-rates/dto/exchange-rates.dto.ts
// Corps typés par classes : le ValidationPipe les contrôle (un type inline est effacé à l'exécution).
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsString, Matches, Max } from 'class-validator';

export class ConvertDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Montant invalide' })
  @IsPositive({ message: 'Le montant doit être supérieur à zéro' })
  @Max(1_000_000_000_000, { message: 'Montant trop élevé' })
  amount!: number;

  @IsString() @Matches(/^[A-Za-z]{3}$/, { message: 'Devise source invalide (3 lettres)' })
  from!: string;

  @IsString() @Matches(/^[A-Za-z]{3}$/, { message: 'Devise cible invalide (3 lettres)' })
  to!: string;
}

export class RateValueDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Le taux doit être un nombre' })
  rate!: number;
}

export class RatePairDto extends RateValueDto {
  @IsString() @IsNotEmpty({ message: 'Paire requise' })
  pair!: string;
}
