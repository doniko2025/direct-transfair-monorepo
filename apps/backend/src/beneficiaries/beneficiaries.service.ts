// apps/backend/src/beneficiaries/beneficiaries.service.ts
// =========================================================
// BENEFICIARIES SERVICE v4.1
// ✅ v4.0 : create() accepte clientId en argument
// ✅ v4.1 : lookupByPhone() — recherche d'un destinataire par téléphone
//    Priorité :
//      1. Bénéficiaire existant de l'utilisateur avec ce numéro
//      2. Utilisateur enregistré sur la plateforme (même clientId)
//    Retourne les données nécessaires pour :
//      - Afficher l'auto-suggestion dans le frontend (wallet transfer)
//      - Créer un bénéficiaire valide (avec country + city) si inexistant
// =========================================================

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Beneficiary } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

    return this.prisma.beneficiary.create({
      data: {
        fullName,
        country,
        city,
        phone: phone ?? null,
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

    return this.prisma.beneficiary.update({
      where: { id: existing.id },
      data: {
        fullName: dto.fullName ?? undefined,
        country:  dto.country  ?? undefined,
        city:     dto.city     ?? undefined,
        phone:    dto.phone === undefined ? undefined : dto.phone,
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
  // LOOKUP PAR TÉLÉPHONE — v4.1
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
  // Le résultat contient tout le nécessaire pour :
  //   - Afficher le nom dans l'UI (auto-suggestion)
  //   - Créer un bénéficiaire valide (country + city non vides)
  //   - Déterminer la devise cible (primaryCurrency)
  // ========================================================

  async lookupByPhone(
    phone: string,
    requestingUserId: string,
  ): Promise<PhoneLookupResult> {
    if (!phone) return { found: false, isPlatformUser: false };

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 6) return { found: false, isPlatformUser: false };

    // Récupère le clientId de l'utilisateur qui fait la recherche
    const requestingUser = await this.prisma.user.findUnique({
      where:  { id: requestingUserId },
      select: { clientId: true },
    });
    if (!requestingUser?.clientId) return { found: false, isPlatformUser: false };

    // ── 1. Bénéficiaire existant ──────────────────────────
    const existingBenef = await this.prisma.beneficiary.findFirst({
      where: {
        userId: requestingUserId,
        phone:  { contains: cleanPhone },
      },
    });

    // ── 2. Utilisateur de la même plateforme ─────────────
    const platformUser = await this.prisma.user.findFirst({
      where: {
        phone:    { contains: cleanPhone },
        clientId: requestingUser.clientId,
        isActive: true,
        id:       { not: requestingUserId }, // Ne pas trouver soi-même
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