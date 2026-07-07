// apps/backend/src/users/users.service.ts
// =========================================================
// USERS SERVICE v4.5
// ✅ v4.0-4.3 : findAll, findByEmail, findById, create, update,
//               suspend, reactivate, softDelete, serializeForAdmin
// ✅ v4.4 : Ajout findByPhoneInTenant()
//   PROBLÈME RÉSOLU :
//   Dans send.tsx, la saisie d'un numéro de téléphone ne détectait
//   que les bénéficiaires SAUVEGARDÉS (getBeneficiaries).
//   Si l'utilisateur est inscrit sur la plateforme mais pas encore
//   sauvegardé comme bénéficiaire, il n'était jamais trouvé.
//
//   CORRECTIF :
//   Nouvelle méthode qui cherche un utilisateur par numéro de téléphone
//   dans le même tenant (clientId), scopée à isActive=true uniquement.
//   Normalise l'entrée en gardant uniquement les chiffres, puis cherche
//   en base via une correspondance de fin de chaîne (suffix) pour gérer
//   les numéros avec/sans indicatif (+221, 00221, 221…).
//   Retourne uniquement les champs publics nécessaires au formulaire
//   d'envoi (id, firstName, lastName, phone, country, primaryCurrency).
//   Jamais l'email, le mot de passe, le KYC ou les wallets.
//
// ✅ v4.5 : 🚨 FIX SÉCURITÉ CRITIQUE — collision de téléphone
//   PROBLÈME RÉSOLU :
//   La stratégie de suffixe de v4.4 (contains 7 derniers chiffres +
//   endsWith en JS) est symétrique : si le numéro d'un compte A est
//   un suffixe strict du numéro d'un compte B (typiquement une
//   confusion "+33766736226" vs "0033766736226" — même numéro réel,
//   préfixe international différent), LES DEUX comptes matchent la
//   même recherche. Incident réel : un dépôt agent de 50 000 € a été
//   crédité sur le mauvais compte à cause de cette ambiguïté.
//
//   CORRECTIF :
//   findByPhoneInTenant() normalise maintenant l'entrée via
//   normalizePhoneE164() (source unique — voir
//   common/utils/phone.util.ts) et fait une correspondance EXACTE
//   sur le champ `phone`. create() et update() normalisent et
//   vérifient l'unicité du téléphone AVANT toute écriture, avec un
//   message d'erreur clair au lieu de laisser deux comptes partager
//   silencieusement le même numéro sous des formats différents.
//
// ✅ v4.6 : update() accepte maintenant un client Prisma transactionnel
//   optionnel (tx), pour pouvoir être appelé DEPUIS la transaction
//   d'un autre service (ex: AgenciesService.update() synchronisant le
//   téléphone du responsable d'agence) sans casser l'atomicité. Sans
//   ça, un appel à ce service depuis un autre `$transaction` utilise
//   une connexion Prisma différente : si l'étape suivante de la
//   transaction appelante échoue, la modification faite ici via
//   users.service ne serait PAS annulée avec le reste.
//   Comportement inchangé pour tous les appels existants (le
//   paramètre est optionnel, retombe sur `this.prisma` par défaut).
// =========================================================

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, KycLevel, Prisma, Role, User } from '@prisma/client';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneE164 } from '../common/utils/phone.util';

// =========================================================
// HELPERS (inchangés depuis v4.2)
// =========================================================

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, IT: CurrencyCode.EUR,
  ES: CurrencyCode.EUR, BE: CurrencyCode.EUR, PT: CurrencyCode.EUR,
  NL: CurrencyCode.EUR, AT: CurrencyCode.EUR, FI: CurrencyCode.EUR,
  IE: CurrencyCode.EUR, LU: CurrencyCode.EUR, GR: CurrencyCode.EUR,
  SI: CurrencyCode.EUR, SK: CurrencyCode.EUR, EE: CurrencyCode.EUR,
  LT: CurrencyCode.EUR, LV: CurrencyCode.EUR, MT: CurrencyCode.EUR, CY: CurrencyCode.EUR,
  GB: CurrencyCode.GBP, GG: CurrencyCode.GBP, JE: CurrencyCode.GBP, IM: CurrencyCode.GBP,
  US: CurrencyCode.USD, SV: CurrencyCode.USD, PA: CurrencyCode.USD, EC: CurrencyCode.USD,
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF, BF: CurrencyCode.XOF,
  BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF, NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
};

function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (!country) return CurrencyCode.XOF;
  const raw = country.trim();

  if (raw.length <= 3) {
    const found = COUNTRY_TO_CURRENCY[raw.toUpperCase()];
    if (found) return found;
  }

  const u = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (u.includes('GUIN') && !u.includes('BISS') && !u.includes('EQUAT')) return CurrencyCode.GNF;
  if (u.includes('GUIN') && u.includes('BISS')) return CurrencyCode.XOF;

  if (['FRANCE','ALLEMAGNE','BELGIQUE','PORTUGAL','ESPAGNE',
       'ITALIE','PAYS-BAS','LUXEMBOURG','AUTRICHE','FINLANDE',
       'IRLANDE','GRECE','SLOVENIE','SLOVAQUIE','ESTONIE',
       'LITUANIE','LETTONIE','MALTE','CHYPRE'].some((k) => u.includes(k)))
    return CurrencyCode.EUR;

  if (u.includes('ROYAUME') || u === 'UK' || u === 'ANGLETERRE') return CurrencyCode.GBP;
  if ((u.includes('ETATS') && u.includes('UNIS')) || u === 'USA') return CurrencyCode.USD;

  if (['SENEGAL','MALI','BENIN','TOGO','IVOIRE','BURKINA','BISSAU']
    .some((k) => u.includes(k))) return CurrencyCode.XOF;
  if (u.includes('NIGER') && !u.includes('NIGERIA') && !u.includes('NIGERI')) return CurrencyCode.XOF;

  const code = raw.toUpperCase().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? CurrencyCode.XOF;
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'U').slice(0, 1)}${(lastName ?? 'X').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// =========================================================
// TYPES (inchangés)
// =========================================================

type UserExtraFields = {
  firstName?: string;
  lastName?: string;
  phone?: string | null; // ✅ v4.5 : nullable pour permettre l'effacement explicite
  gender?: string;
  jobTitle?: string;
  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;
  mobileMoneyOperator?: string;
  mobileMoneyNumber?: string;
};

// ✅ v4.6 : client Prisma générique (PrismaService ou TransactionClient)
type Db = PrismaService | Prisma.TransactionClient;

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────
  // findAll (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  async findAll(whereClause: any) {
    return this.prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        country: true,
        city: true,
        primaryCurrency: true,
        kycLevel: true,
        complianceStatus: true,
        isActive: true,
        isSuspended: true,
        deletedAt: true,
        createdAt: true,
        client: { select: { name: true, code: true } },
        agency: { select: { name: true, id: true } },
        wallets: {
          where: { isActive: true },
          select: {
            id: true,
            currency: true,
            balance: true,
            reservedBalance: true,
            isDefault: true,
            isFrozen: true,
          },
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // findByEmail (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  // ──────────────────────────────────────────────────────
  // findById (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        client: true,
        agency: true,
        wallets: {
          where:   { isActive: true },
          orderBy: { currency: 'asc' },
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.5 — findByPhoneInTenant — SÉCURITÉ CRITIQUE
  //
  // 🚨 BUG CORRIGÉ (juillet 2026) :
  //   La v4.4 faisait un matching par SUFFIXE (contains 7 derniers
  //   chiffres + endsWith en JS) pour tolérer les formats +224 /
  //   00224 / etc. Problème : cette logique est symétrique et ne
  //   distingue pas "0033766736226" (Thierno, admin) de
  //   "33766736226" / "+33766736226" (Alpha, client) — le second est
  //   un suffixe strict du premier. Les DEUX comptes matchaient la
  //   recherche, et .find() renvoyait le premier candidat retourné
  //   par la requête (ordre non garanti, aucun ORDER BY) → un dépôt
  //   destiné à Alpha a crédité le wallet de Thierno.
  //
  // CORRECTIF :
  //   On normalise l'entrée avec normalizePhoneE164() (même fonction
  //   utilisée à l'écriture — voir users.create/update, auth.register)
  //   puis on fait une correspondance EXACTE sur le champ `phone`
  //   (colonne @unique). Plus aucune ambiguïté possible : soit le
  //   numéro normalisé correspond à un seul utilisateur, soit à
  //   aucun. Fini le "contains" + heuristique de suffixe.
  //
  // ⚠️ Cette méthode suppose que `phone` est stocké normalisé en
  // base pour tous les utilisateurs. Si des comptes plus anciens
  // n'ont pas encore été migrés, exécuter
  // scripts/backfill-phone-normalized.ts avant de déployer ce
  // correctif (voir ce script pour le détail).
  // ──────────────────────────────────────────────────────
  async findByPhoneInTenant(
    phone: string,
    clientId: number,
  ): Promise<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    country: string | null;
    primaryCurrency: string;
  } | null> {
    const normalized = normalizePhoneE164(phone);
    if (!normalized) return null;

    const match = await this.prisma.user.findFirst({
      where: {
        clientId,
        isActive:  true,
        deletedAt: null,
        phone:     normalized, // ✅ correspondance EXACTE, plus de contains/suffix
      },
      select: {
        id:              true,
        firstName:       true,
        lastName:        true,
        phone:           true,
        country:         true,
        primaryCurrency: true,
      },
    });

    if (!match) return null;

    return {
      id:              match.id,
      firstName:       match.firstName,
      lastName:        match.lastName,
      phone:           match.phone,
      country:         match.country,
      primaryCurrency: String(match.primaryCurrency ?? 'XOF'),
    };
  }

  // ──────────────────────────────────────────────────────
  // create — ✅ v4.5 : normalisation + vérification d'unicité du
  // téléphone AVANT création (en plus de la contrainte @unique en
  // base, qui reste le filet de sécurité final en cas de course
  // entre deux requêtes concurrentes).
  // ──────────────────────────────────────────────────────
  async create(
    email: string,
    passwordHash: string,
    role: Role,
    clientId: number,
    extra: UserExtraFields = {},
  ): Promise<User> {
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(extra.country);

    const rawPhone = extra.phone ? String(extra.phone).trim() : '';
    const normalizedPhone = rawPhone ? normalizePhoneE164(rawPhone) : null;

    if (rawPhone && !normalizedPhone) {
      throw new BadRequestException('Numéro de téléphone invalide.');
    }

    if (normalizedPhone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ConflictException(
          'Ce numéro de téléphone est déjà associé à un autre compte.',
        );
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: email.trim().toLowerCase(),
            password: passwordHash,
            role,
            clientId,
            primaryCurrency,
            kycLevel: KycLevel.LEVEL_0,
            referralCode: generateReferralCode(extra.firstName, extra.lastName),
            ...extra,
            phone: normalizedPhone, // ✅ toujours la version normalisée (ou null)
          },
        });

        await tx.wallet.create({
          data: {
            userId:    user.id,
            currency:  primaryCurrency,
            balance:   0,
            isDefault: true,
            isActive:  true,
          },
        });

        return user;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Cet email ou ce numéro de téléphone est déjà utilisé par un autre compte.',
        );
      }
      throw e;
    }
  }

  // ──────────────────────────────────────────────────────
  // update — ✅ v4.5 : normalisation + vérification d'unicité du
  // téléphone AVANT mise à jour (exclut le user courant de la
  // vérification de doublon), + filet de sécurité P2002.
  //
  // ✅ v4.6 : accepte un client transactionnel `tx` optionnel — voir
  // le bandeau de version en tête de fichier. Quand `tx` est fourni,
  // TOUTES les requêtes (vérification d'unicité + écriture) passent
  // par lui, pour rester atomique avec la transaction appelante.
  // ──────────────────────────────────────────────────────
  async update(
    id: string,
    data: Partial<UserExtraFields & { primaryCurrency?: CurrencyCode }>,
    tx?: Prisma.TransactionClient,
  ) {
    const db: Db = tx ?? this.prisma;

    if (data.country) {
      data.primaryCurrency = getCurrencyFromCountry(data.country);
    }

    if (data.phone !== undefined) {
      const trimmedPhone = data.phone ? String(data.phone).trim() : '';

      if (!trimmedPhone) {
        data.phone = null; // autorise l'effacement explicite du numéro
      } else {
        const normalizedPhone = normalizePhoneE164(trimmedPhone);
        if (!normalizedPhone) {
          throw new BadRequestException('Numéro de téléphone invalide.');
        }

        const existingPhone = await db.user.findFirst({
          where: { phone: normalizedPhone, id: { not: id } },
          select: { id: true },
        });
        if (existingPhone) {
          throw new ConflictException(
            'Ce numéro de téléphone est déjà associé à un autre compte.',
          );
        }

        data.phone = normalizedPhone;
      }
    }

    try {
      return await db.user.update({ where: { id }, data });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Cette valeur est déjà utilisée par un autre compte.',
        );
      }
      throw e;
    }
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — suspend (inchangé)
  // ──────────────────────────────────────────────────────
  async suspend(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.deletedAt) throw new NotFoundException('Ce compte a été supprimé');

    return this.prisma.user.update({
      where: { id },
      data: {
        isSuspended:     true,
        suspendedAt:     new Date(),
        suspendedReason: reason?.trim() || 'Suspendu par l\'administrateur',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedReason: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — reactivate (inchangé)
  // ──────────────────────────────────────────────────────
  async reactivate(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, isSuspended: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.deletedAt) throw new NotFoundException('Ce compte a été supprimé');

    return this.prisma.user.update({
      where: { id },
      data: {
        isSuspended:     false,
        suspendedAt:     null,
        suspendedReason: null,
        isActive:        true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuspended: true,
        isActive: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — softDelete (inchangé)
  // ──────────────────────────────────────────────────────
  async softDelete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.deletedAt) {
      return {
        id,
        deleted: true,
        deletedAt: user.deletedAt,
        message: 'Ce compte était déjà supprimé',
      };
    }

    const deleted = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt:   new Date(),
        isActive:    false,
        isSuspended: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        isActive: true,
      },
    });

    return {
      ...deleted,
      deleted: true,
      message: 'Compte supprimé avec succès (données conservées pour audit)',
    };
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — serializeForAdmin (inchangé)
  // ──────────────────────────────────────────────────────
  serializeForAdmin(user: any) {
    const {
      password, otpCode, otpExpiresAt, mfaSecret, mfaBackupCodes,
      ...safe
    } = user;

    return {
      ...safe,
      wallets: (user.wallets ?? []).map((w: any) => ({
        id:               w.id,
        currency:         w.currency,
        balance:          Number(w.balance ?? 0),
        reservedBalance:  Number(w.reservedBalance ?? 0),
        availableBalance: Number(w.balance ?? 0) - Number(w.reservedBalance ?? 0),
        isDefault:        w.isDefault,
        isActive:         w.isActive,
        isFrozen:         w.isFrozen ?? false,
        frozenReason:     w.frozenReason ?? null,
      })),
    };
  }
}