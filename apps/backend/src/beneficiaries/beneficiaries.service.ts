// apps/backend/src/beneficiaries/beneficiaries.service.ts
// =========================================================
// BENEFICIARIES SERVICE v4.2
// ✅ v4.0 : create() accepte clientId en argument
// ✅ v4.1 : lookupByPhone() — recherche d'un destinataire par téléphone
//    Priorité :
//      1. Bénéficiaire existant de l'utilisateur avec ce numéro
//      2. Utilisateur enregistré sur la plateforme (même clientId)
//    Retourne les données nécessaires pour :
//      - Afficher l'auto-suggestion dans le frontend (wallet transfer)
//      - Créer un bénéficiaire valide (avec country + city) si inexistant
//
// ✅ v4.2 : 🚨 FIX SÉCURITÉ CRITIQUE — collision de téléphone (même bug
//    que transactions.service.ts v4.18 et users.service.ts v4.5,
//    repéré ici en relisant ce fichier)
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   lookupByPhone() faisait phone: { contains: cleanPhone }, où
//   cleanPhone est une simple chaîne de chiffres nettoyée (pas de
//   normalisation E.164). Cette stratégie est symétrique : si le
//   numéro d'un compte A est un suffixe strict du numéro d'un compte B
//   ("0033766736226" vs "+33766736226"/"33766736226" — confusion entre
//   préfixe international "+" et "00"), LES DEUX comptes matchent la
//   même recherche. C'est exactement le même mécanisme que l'incident
//   réel documenté dans transactions.service.ts (dépôt agent de
//   50 000 € crédité sur le mauvais compte) — ici, le risque est côté
//   auto-suggestion à la création d'un bénéficiaire : le frontend
//   wallet-transfer peut proposer/pré-remplir le mauvais utilisateur
//   plateforme comme destinataire pour un numéro donné.
//
//   CORRECTIF :
//   Normalisation via normalizePhoneE164() (source unique — voir
//   common/utils/phone.util.ts, déjà utilisée dans transactions.
//   service.ts, users.service.ts, auth.service.ts) puis correspondance
//   EXACTE sur le champ `phone`, pour existingBenef ET platformUser.
//   platformUser filtre maintenant aussi deletedAt: null, cohérent
//   avec le reste de l'app (un agent désactivé — voir
//   agencies.service.ts v4.5 — ne doit pas être proposé comme
//   destinataire).
//   create()/updateForUser() normalisent également le téléphone AVANT
//   stockage — Beneficiary.phone était jusqu'ici enregistré tel quel,
//   sans normalisation, contrairement à User.phone partout ailleurs
//   dans l'app. Ne causait pas de faux-match en pratique (les lookups
//   normalisent déjà à la comparaison), mais laissait une donnée non
//   normalisée en base, à contre-courant de la convention établie —
//   corrigé pour cohérence et pour éviter qu'un futur lookup naïf
//   (sans normalisation à la lecture) ne se fasse piéger.
// =========================================================

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Beneficiary } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneE164 } from '../common/utils/phone.util';
import type { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import type { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

export interface PhoneLookupResult {
  found:           boolean;
  isPlatformUser:  boolean;
  beneficiaryId?:  string;
  fullName?:       string;
  firstName?:      string;
  lastName?:       string;
  displayPhone?:   string;
  country?:        string;
  city?:           string;
  primaryCurrency?:string;
}

@Injectable()
export class BeneficiariesService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ On accepte maintenant clientId en argument
  async create(
    userId: string,
    clientId: number,
    dto: CreateBeneficiaryDto,
  ): Promise<Beneficiary> {
    if (!clientId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.clientId)
        throw new BadRequestException('Impossible de déterminer la société.');
      clientId = user.clientId;
    }

    const { fullName, country, city, phone } = dto;

    // ✅ v4.2 — FIX : normalisation à l'écriture, cohérent avec
    // User.phone partout ailleurs dans l'app (voir changelog en tête
    // de fichier). Un numéro fourni mais invalide est rejeté plutôt
    // que silencieusement stocké tel quel.
    let normalizedPhone: string | null = null;
    if (phone) {
      normalizedPhone = normalizePhoneE164(phone);
      if (!normalizedPhone) {
        throw new BadRequestException('Numéro de téléphone invalide.');
      }
    }

    return this.prisma.beneficiary.create({
      data: {
        fullName,
        country,
        city,
        phone: normalizedPhone,
        user:   { connect: { id: userId } },
        client: { connect: { id: clientId } },
      },
    });
  }

  async findAllForUser(userId: string): Promise<Beneficiary[]> {
    return this.prisma.beneficiary.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(id: string, userId: string): Promise<Beneficiary> {
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id, userId },
    });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');
    return beneficiary;
  }

  async updateForUser(
    id: string,
    userId: string,
    dto: UpdateBeneficiaryDto,
  ): Promise<Beneficiary> {
    const existing = await this.findOneForUser(id, userId);

    const hasAny =
      dto.fullName  !== undefined ||
      dto.country   !== undefined ||
      dto.city      !== undefined ||
      dto.phone     !== undefined;
    if (!hasAny) throw new BadRequestException('No fields provided');

    // ✅ v4.2 — FIX : même normalisation qu'en création (voir
    // changelog en tête de fichier).
    let normalizedPhone: string | null | undefined = undefined;
    if (dto.phone !== undefined) {
      if (!dto.phone) {
        normalizedPhone = null; // effacement explicite autorisé
      } else {
        normalizedPhone = normalizePhoneE164(dto.phone);
        if (!normalizedPhone) {
          throw new BadRequestException('Numéro de téléphone invalide.');
        }
      }
    }

    return this.prisma.beneficiary.update({
      where: { id: existing.id },
      data: {
        fullName: dto.fullName ?? undefined,
        country:  dto.country  ?? undefined,
        city:     dto.city     ?? undefined,
        phone:    normalizedPhone,
      },
    });
  }

  async deleteForUser(
    id: string,
    userId: string,
  ): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOneForUser(id, userId);

    const txCount = await this.prisma.transaction.count({
      where: { beneficiaryId: existing.id },
    });
    if (txCount > 0)
      throw new BadRequestException(
        'Cannot delete beneficiary linked to transactions',
      );

    await this.prisma.beneficiary.delete({ where: { id: existing.id } });
    return { deleted: true, id: existing.id };
  }

  // ========================================================
  // LOOKUP PAR TÉLÉPHONE — ✅ v4.2 SÉCURITÉ CRITIQUE
  //
  // Utilisé par le frontend wallet-transfer pour auto-suggérer
  // le destinataire quand l'utilisateur saisit un numéro.
  //
  // Ordre de priorité :
  //   1. Bénéficiaire existant de cet utilisateur → renvoie beneficiaryId
  //   2. Utilisateur enregistré sur la même plateforme (clientId)
  //      → renvoie firstName/lastName/country/city pour création bénéf.
  //   3. Non trouvé → found: false
  //
  // 🚨 v4.2 : normalizePhoneE164() + correspondance EXACTE partout
  // (voir changelog en tête de fichier) — remplace l'ancien
  // phone: { contains: cleanPhone } vulnérable aux collisions de
  // format (+33... vs 0033...).
  // ========================================================

  async lookupByPhone(
    phone: string,
    requestingUserId: string,
  ): Promise<PhoneLookupResult> {
    if (!phone) return { found: false, isPlatformUser: false };

    const normalized = normalizePhoneE164(phone);
    if (!normalized) return { found: false, isPlatformUser: false };

    // Récupère le clientId de l'utilisateur qui fait la recherche
    const requestingUser = await this.prisma.user.findUnique({
      where:  { id: requestingUserId },
      select: { clientId: true },
    });
    if (!requestingUser?.clientId) return { found: false, isPlatformUser: false };

    // ── 1. Bénéficiaire existant — correspondance EXACTE ─
    const existingBenef = await this.prisma.beneficiary.findFirst({
      where: {
        userId: requestingUserId,
        phone:  normalized,
      },
    });

    // ── 2. Utilisateur de la même plateforme — correspondance EXACTE
    const platformUser = await this.prisma.user.findFirst({
      where: {
        phone:     normalized,
        clientId:  requestingUser.clientId,
        isActive:  true,
        deletedAt: null, // ✅ v4.2 — exclut les agents désactivés (agencies.service.ts v4.5)
        id:        { not: requestingUserId }, // Ne pas trouver soi-même
      },
      select: {
        firstName:       true,
        lastName:        true,
        phone:           true,
        country:         true,
        city:            true,
        primaryCurrency: true,
      },
    });

    // Cas 1 : bénéficiaire déjà enregistré
    if (existingBenef) {
      return {
        found:           true,
        isPlatformUser:  !!platformUser,
        beneficiaryId:   existingBenef.id,
        fullName:        existingBenef.fullName,
        displayPhone:    existingBenef.phone ?? phone,
        country:         existingBenef.country,
        city:            existingBenef.city,
        primaryCurrency: platformUser?.primaryCurrency ?? undefined,
      };
    }

    // Cas 2 : utilisateur plateforme non encore en bénéficiaires
    if (platformUser) {
      const firstName = platformUser.firstName ?? '';
      const lastName  = platformUser.lastName  ?? '';
      return {
        found:           true,
        isPlatformUser:  true,
        firstName,
        lastName,
        fullName:        `${firstName} ${lastName}`.trim(),
        displayPhone:    platformUser.phone ?? phone,
        country:         platformUser.country  ?? '',
        city:            platformUser.city     ?? '',
        primaryCurrency: platformUser.primaryCurrency ?? 'XOF',
      };
    }

    // Cas 3 : non trouvé
    return { found: false, isPlatformUser: false };
  }
}