// apps/backend/src/transactions/dto/create-agency-collection.dto.ts
// =========================================================
// CREATE AGENCY COLLECTION DTO v1.0 — Direct Transf'air
// Fichier indépendant — ne touche à aucun DTO existant.
//
// Utilisé par POST /transactions/agency/collect (société → agence,
// retrait forcé initié par l'admin). agencyId est fourni par
// l'admin (sélecteur d'agence côté formulaire) ; contrairement à
// CreateAgencyRemittanceDto, l'admin AGIT SUR une agence qui n'est
// pas la sienne au sens "compte personnel" — d'où la présence du
// champ ici, avec vérification d'appartenance côté service
// (AgencyTreasuryService.collectFromAgency).
//
// Pas de champ currency : chaque agence n'a qu'une seule devise
// active (cf. demande explicite), dérivée côté service depuis
// l'agence elle-même.
//
// note est OBLIGATOIRE ici (contrairement à la remittance) : un
// retrait forcé sur le compte d'un tiers (l'agence) doit toujours
// être justifié dans l'historique.
// =========================================================

import { IsNotEmpty, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateAgencyCollectionDto {
  @IsString()
  @IsNotEmpty()
  agencyId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  note!: string;
}