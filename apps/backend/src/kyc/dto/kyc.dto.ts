// apps/backend/src/kyc/dto/kyc.dto.ts
import { IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

import { ALL_DOC_TYPES } from '../kyc-rules';

/** Envoi d'une pièce : photo (base64) recto + verso éventuel. Limites de taille et type RÉEL contrôlés par kyc-rules.decodeUpload. */
export class SubmitKycDocumentDto {
  @IsIn([...ALL_DOC_TYPES], { message: 'Type de pièce inconnu.' })
  type: string;

  /** Recto (ou unique photo : passeport, selfie, justificatif) en base64, avec ou sans préfixe data:. */
  @IsString()
  @MinLength(100, { message: 'Photo manquante.' })
  front: string;

  @IsOptional()
  @IsString()
  back?: string;

  @IsOptional()
  @IsString()
  @Length(4, 40, { message: 'Numéro de pièce : 4 à 40 caractères.' })
  documentNumber?: string;

  /** AAAA-MM-JJ — obligatoire pour une pièce d'identité. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  issuedCountry?: string;
}

export class RejectKycDocumentDto {
  @IsString()
  @MinLength(5, { message: 'Indiquez le motif du refus (5 caractères au moins).' })
  @MaxLength(500)
  reason: string;
}

export class ApproveKycDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
