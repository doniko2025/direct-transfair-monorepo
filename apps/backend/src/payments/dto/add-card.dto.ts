//apps/backend/src/payments/dto/add-card.dto.ts
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class AddCardDto {
  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'Numéro de carte invalide (13–19 chiffres)' })
  cardNumber!: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'Format MM/AA attendu' })
  expiry!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}