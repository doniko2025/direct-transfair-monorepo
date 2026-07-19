// apps/backend/src/transactions/dto/create-agency-remittance.dto.ts
// =========================================================
// CREATE AGENCY REMITTANCE DTO v1.0 — Direct Transf'air
// Fichier indépendant — ne touche à aucun DTO existant.
//
// Utilisé par POST /transactions/agency/remit (agent → société).
// Pas de champ agencyId ni currency : l'agence et sa devise sont
// dérivées côté service depuis l'agent authentifié (agent.agencyId),
// jamais depuis le body — évite qu'un agent remonte des fonds
// depuis l'agence d'un autre en falsifiant le payload.
// =========================================================

import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateAgencyRemittanceDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}