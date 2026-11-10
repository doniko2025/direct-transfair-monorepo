// apps/backend/src/withdrawals/dto/agent-code.dto.ts
// Corps de POST /withdrawals/agent/check et /withdrawals/agent/pay — typés par classes (un type inline est effacé à
// l'exécution : le ValidationPipe ne contrôlait rien et un objet pouvait arriver jusqu'à la requête Prisma).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AgentCheckCodeDto {
  @ApiProperty({ description: 'Code de retrait (9 chiffres) — ou contenu du QR du reçu (code signé TF…, ou adresse de vérification qui le contient)' })
  @IsString({ message: 'Code invalide' }) @IsNotEmpty({ message: 'Code requis' }) @MaxLength(300)
  code!: string;
}

export class AgentPayCodeDto extends AgentCheckCodeDto {
  @ApiPropertyOptional({ description: 'Derniers chiffres du téléphone du bénéficiaire (si la société l\'exige)' })
  @IsOptional() @IsString({ message: 'Format invalide' }) @Matches(/^\d{3,8}$/, { message: 'Chiffres uniquement (3 à 8)' })
  phoneDigits?: string;
}
