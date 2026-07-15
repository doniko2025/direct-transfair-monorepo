// apps/backend/src/clients/clients.service.ts
// =========================================================
// CLIENTS SERVICE v4.10
// ✅ v4.5 conservé intégralement
// ✅ v4.6 : Email de bienvenue automatique après création
//   → sendWelcomeCompanyAdmin() déclenché après la transaction
//   → Non-bloquant : un échec mail ne casse jamais la création
//   → Logger NestJS pour traçabilité des erreurs mail
//   → Logger + CompanyMailService injectés
//
// ✅ v4.7 : Ajout updateOwnName() — self-service COMPANY_ADMIN
//   PROBLÈME RÉSOLU :
//   Le champ "Société" du profil admin était verrouillé en dur côté
//   frontend (editable={false}), sans aucun moyen pour un
//   COMPANY_ADMIN de corriger le nom de sa propre société.
//
//   CORRECTIF :
//   Nouvelle méthode dédiée, volontairement DISTINCTE de update()
//   (qui reste réservée à SUPER_ADMIN et accepte n'importe quel champ
//   Client sans restriction). updateOwnName() ne touche QUE `name`,
//   et le clientId vient du token JWT de l'appelant (jamais d'un
//   paramètre d'URL) — voir clients.controller.ts : impossible pour
//   un COMPANY_ADMIN de modifier une société autre que la sienne,
//   et impossible de toucher subscriptionStatus, devise, branding, etc.
//
// ✅ v4.8 : 🚨 3 correctifs — suppression définitive, téléphone admin
//   non normalisé, findByCode() sans garde isActive
//
//   PROBLÈME 1 — remove() supprimait définitivement TOUT
//     tx.user.deleteMany({ clientId }) + tx.wallet.deleteMany({ clientId })
//     + tx.client.delete() : même défaut que l'ancien
//     agencies.service.ts (voir son changelog v4.4/v4.5), mais à
//     l'échelle d'une société ENTIÈRE — potentiellement des milliers
//     de transactions, tous les KYC, tout l'AML, tout l'historique de
//     connexion perdus sans trace pour toute la société. Pire encore :
//     Agency.clientId est une clé étrangère OBLIGATOIRE (non
//     nullable) sans onDelete: Cascade dans le schéma — supprimer un
//     Client possédant ne serait-ce qu'UNE agence aurait déjà fait
//     échouer tx.client.delete() avec une violation de contrainte.
//     Cette méthode était donc très probablement déjà cassée en
//     pratique pour tout client réel (avec agences et/ou historique).
//     CORRECTIF : même principe que agencies.service.ts v4.5/v4.6 —
//     désactivation en cascade (Client + toutes ses Agency + tous ses
//     User), jamais de destruction. Transaction, Wallet, LedgerEntry,
//     KYC, AML : jamais touchés. Détail complet dans remove() ci-dessous.
//
//   PROBLÈME 2 — téléphone admin non normalisé
//     dto.contactPhone était écrit tel quel sur admin.phone (colonne
//     @unique), sans passer par normalizePhoneE164() ni vérification
//     d'unicité préalable — la même classe de bug que celle
//     documentée en détail dans auth.service.ts/users.service.ts
//     (incident réel : dépôt de 50 000 € crédité sur le mauvais
//     compte à cause d'une confusion de format "+33..." / "0033...").
//     CORRECTIF : normalizePhoneE164() + vérification d'unicité AVANT
//     création, avec message d'erreur clair (ConflictException) au
//     lieu d'un P2002 brut non rattrapé.
//
//   PROBLÈME 3 — findByCode() sans garde isActive
//     findPublicByCode()/findPublicByHost() filtrent déjà isActive:
//     true — mais findByCode() (utilisée par TenantService.
//     getCurrentClient() pour résoudre le tenant de CHAQUE requête
//     passant par TenantGuard) ne le faisait pas. Un client désactivé
//     via remove() (voir PROBLÈME 1) restait donc résolvable comme
//     tenant valide pour les routes protégées par TenantGuard
//     (beneficiaries, withdrawals...).
//     CORRECTIF : isActive: true ajouté au filtre.
//     ✅ RÉSOLU en v4.9 (ci-dessous) et en auth.service.ts v5.6 :
//     AuthService.login()/loginByPhone()/register()/refreshTokens()
//     vérifient désormais explicitement client.isActive — le trou
//     signalé ici est fermé.
//
// ✅ v4.9 : 🐛 FIX — isSuspended jamais posé lors de la désactivation
//     d'un utilisateur
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   remove() posait deletedAt + isActive:false + phone:null sur les
//   utilisateurs désactivés, mais jamais isSuspended:true —
//   contrairement à UsersService.softDelete() qui le fait depuis le
//   début, et au même écart corrigé dans agencies.service.ts v4.7.
//   auth.service.ts vérifie les deux (deletedAt depuis sa v5.5,
//   client.isActive depuis sa v5.6) en défense en profondeur —
//   laisser isSuspended à false ici cassait la cohérence entre les
//   trois voies de désactivation désormais existantes dans l'app
//   (UsersService.softDelete, AgenciesService.remove,
//   ClientsService.remove).
//   CORRECTIF : isSuspended:true ajouté à la même écriture.
//
// ✅ v4.10 : 🐛 FIX — erreur de compilation TS2322 sur remove()
//
//   PROBLÈME RÉSOLU (juillet 2026, signalé par erreur VS Code/tsc) :
//   remove() faisait code: null sur tx.client.update(), en supposant
//   Client.code nullable par analogie avec Agency.code. Mais dans le
//   schéma, Agency.code est `String? @unique` (nullable) alors que
//   Client.code est `String @unique` (NON nullable, requis) — deux
//   modèles différents, deux nullabilités différentes. Résultat :
//   erreur de type Prisma/TypeScript, code ne compilait plus.
//   CORRECTIF : code préfixé (`DELETED_<timestamp>_<code original>`)
//   au lieu d'être vidé — même mécanisme que l'email plus haut dans
//   cette même méthode : la valeur exacte est libérée pour
//   réutilisation future par un nouveau client, tout en restant une
//   chaîne non nulle et en conservant la traçabilité forensique.
//   subdomain/customDomain restent inchangés (null) : ces deux champs
//   sont bien nullable sur Client.
// =========================================================

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { CurrencyCode, KycLevel, Role, SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';

import { CompanyMailService } from '../mail/channels/company-mail.service';
import { normalizePhoneE164 } from '../common/utils/phone.util';

// ─── Constantes ──────────────────────────────────────────
const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  CurrencyCode.XOF,
  CurrencyCode.EUR,
  CurrencyCode.USD,
  CurrencyCode.GNF,
  CurrencyCode.GBP,
];

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, IT: CurrencyCode.EUR,
  ES: CurrencyCode.EUR, BE: CurrencyCode.EUR, PT: CurrencyCode.EUR,
  NL: CurrencyCode.EUR, AT: CurrencyCode.EUR, FI: CurrencyCode.EUR,
  IE: CurrencyCode.EUR, LU: CurrencyCode.EUR, GR: CurrencyCode.EUR,
  GB: CurrencyCode.GBP, GG: CurrencyCode.GBP, JE: CurrencyCode.GBP, IM: CurrencyCode.GBP,
  US: CurrencyCode.USD, SV: CurrencyCode.USD, PA: CurrencyCode.USD, EC: CurrencyCode.USD,
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF, BF: CurrencyCode.XOF,
  BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF, NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
};

// ─── Helpers ─────────────────────────────────────────────
function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (!country) return CurrencyCode.XOF;
  const code = country.toUpperCase().trim().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? CurrencyCode.XOF;
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'U').slice(0, 1)}${(lastName ?? 'X').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// ─── Type retour branding public ─────────────────────────
type PublicBranding = {
  code:           string;
  name:           string;
  logoUrl:        string | null;
  primaryColor:   string;
  secondaryColor: string;
  tagline:        string | null;
  fontFamily:     string | null;
  splashBgColor:  string | null;
  welcomeMessage: string | null;
  subdomain:      string | null;
  customDomain:   string | null;
  isActive:       boolean;
};

// ─── Sélection Prisma partagée ────────────────────────────
const PUBLIC_BRANDING_SELECT = {
  code:           true,
  name:           true,
  logoUrl:        true,
  primaryColor:   true,
  secondaryColor: true,
  tagline:        true,
  fontFamily:     true,
  splashBgColor:  true,
  welcomeMessage: true,
  subdomain:      true,
  customDomain:   true,
  isActive:       true,
} as const;

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly companyMailService: CompanyMailService,
  ) {}

  // ========================================================
  // HELPER PRIVÉ — mapping branding public
  // ========================================================

  private mapPublicBranding(client: any): PublicBranding {
    return {
      code:           client.code,
      name:           client.name,
      logoUrl:        client.logoUrl        ?? null,
      primaryColor:   client.primaryColor   ?? '#059669',
      secondaryColor: client.secondaryColor ?? '#10B981',
      tagline:        client.tagline        ?? null,
      fontFamily:     client.fontFamily     ?? null,
      splashBgColor:  client.splashBgColor  ?? null,
      welcomeMessage: client.welcomeMessage ?? null,
      subdomain:      client.subdomain      ?? null,
      customDomain:   client.customDomain   ?? null,
      isActive:       client.isActive,
    };
  }

  // ========================================================
  // CRÉATION
  // ✅ v4.6 : email de bienvenue envoyé après la transaction
  // ✅ v4.8 : téléphone admin normalisé + vérifié (voir changelog)
  // ========================================================

  async create(dto: CreateClientDto) {
    if (!dto.adminEmail?.trim())     throw new BadRequestException('adminEmail requis');
    if (!dto.adminPassword?.trim())  throw new BadRequestException('adminPassword requis');
    if (!dto.adminFirstName?.trim()) throw new BadRequestException('adminFirstName requis');
    if (!dto.adminLastName?.trim())  throw new BadRequestException('adminLastName requis');

    const existingCode = await this.prisma.client.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existingCode)
      throw new ConflictException(`Le code "${dto.code}" est déjà pris.`);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingUser)
      throw new ConflictException(`L'email "${dto.adminEmail}" est déjà utilisé.`);

    // ✅ v4.8 — FIX (PROBLÈME 2) : normalisation + vérification
    // d'unicité du téléphone admin AVANT création. Voir changelog en
    // tête de fichier.
    let normalizedAdminPhone: string | null = null;
    if (dto.contactPhone) {
      normalizedAdminPhone = normalizePhoneE164(dto.contactPhone);
      if (!normalizedAdminPhone) {
        throw new BadRequestException('Numéro de téléphone invalide.');
      }
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: normalizedAdminPhone },
      });
      if (existingPhone) {
        throw new ConflictException(
          'Ce numéro de téléphone est déjà utilisé par un autre compte.',
        );
      }
    }

    if (dto.subdomain) {
      const existingSub = await this.prisma.client.findUnique({
        where: { subdomain: dto.subdomain.toLowerCase().trim() },
      });
      if (existingSub)
        throw new ConflictException(`Le sous-domaine "${dto.subdomain}" est déjà utilisé.`);
    }

    if (dto.customDomain) {
      const existingDomain = await this.prisma.client.findUnique({
        where: { customDomain: dto.customDomain.toLowerCase().trim() },
      });
      if (existingDomain)
        throw new ConflictException(`Le domaine "${dto.customDomain}" est déjà utilisé.`);
    }

    // ✅ v4.6 : on garde le mot de passe en clair AVANT le hachage
    // pour pouvoir l'inclure dans l'email de bienvenue
    const plainPassword   = String(dto.adminPassword);
    const hashedPassword  = await bcrypt.hash(plainPassword, 10);
    const ownerCountryCode = dto.ownerCountry?.toUpperCase().substring(0, 2);
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(ownerCountryCode);

    // ─── Transaction Prisma ─────────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          code:               dto.code.toUpperCase(),
          name:               dto.name,

          // ─── Branding ──────────────────────────────────
          primaryColor:       dto.primaryColor   ?? '#059669',
          secondaryColor:     dto.secondaryColor ?? '#10B981',
          logoUrl:            dto.logoUrl        ?? null,
          tagline:            dto.tagline        ?? null,
          fontFamily:         dto.fontFamily     ?? null,
          splashBgColor:      dto.splashBgColor  ?? null,
          welcomeMessage:     dto.welcomeMessage ?? null,

          // ─── Portail web dédié ─────────────────────────
          subdomain:    dto.subdomain?.toLowerCase().trim()    ?? null,
          customDomain: dto.customDomain?.toLowerCase().trim() ?? null,

          // ─── Abonnement ────────────────────────────────
          subscriptionType:   dto.subscriptionType ?? 'RENTAL',
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          defaultCurrency:    primaryCurrency,

          // ─── Coordonnées ───────────────────────────────
          country:            ownerCountryCode   ?? null,
          email:              String(dto.adminEmail),
          phone:              dto.contactPhone   ?? null,
          address:            dto.ownerAddress   ?? null,

          // ─── Propriétaire légal ────────────────────────
          ownerFirstName:     String(dto.adminFirstName),
          ownerLastName:      String(dto.adminLastName),
          ownerBirthDate:     dto.ownerBirthDate  ?? null,
          ownerBirthPlace:    dto.ownerBirthPlace ?? null,
          ownerCountry:       dto.ownerCountry    ?? null,
          ownerAddress:       dto.ownerAddress    ?? null,

          // ─── Contact opérationnel ──────────────────────
          contactEmail:       dto.contactEmail   ?? dto.adminEmail,
          contactPhone:       dto.contactPhone   ?? null,
          activitySector:     dto.activitySector ?? null,

          // ─── Devises & features ────────────────────────
          allowedCurrencies:         SUPPORTED_CURRENCIES,
          featureScheduledTransfers: true,
          featureRateAlerts:         true,
          featureLoyaltyPoints:      false,
        },
      });

      // Wallets société (un par devise supportée)
      for (const currency of SUPPORTED_CURRENCIES) {
        await tx.wallet.create({
          data: {
            clientId:  client.id,
            currency,
            balance:   0,
            isDefault: currency === primaryCurrency,
            isActive:  true,
          },
        });
      }

      // Admin COMPANY_ADMIN
      const admin = await tx.user.create({
        data: {
          email:           String(dto.adminEmail),
          password:        hashedPassword,
          firstName:       String(dto.adminFirstName),
          lastName:        String(dto.adminLastName),
          role:            Role.COMPANY_ADMIN,
          clientId:        client.id,
          country:         ownerCountryCode    ?? null,
          primaryCurrency,
          // ✅ v4.8 — FIX (PROBLÈME 2) : version normalisée, plus dto.contactPhone brut
          phone:           normalizedAdminPhone,
          addressStreet:   dto.ownerAddress    ?? null,
          kycLevel:        KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode:    generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

      // Wallet personnel de l'admin
      await tx.wallet.create({
        data: {
          userId:    admin.id,
          currency:  primaryCurrency,
          balance:   0,
          isDefault: true,
          isActive:  true,
        },
      });

      return { client, admin };
    });

    // ─── Email de bienvenue ─────────────────────────────
    // ✅ v4.6 : exécuté APRÈS la transaction, non-bloquant.
    // Un échec d'envoi ne rollback jamais la création.
    void this.companyMailService
      .sendWelcomeCompanyAdmin({
        email:             String(dto.adminEmail),
        firstName:         String(dto.adminFirstName),
        lastName:          String(dto.adminLastName),
        companyName:       dto.name,
        companyCode:       dto.code.toUpperCase(),
        temporaryPassword: plainPassword,
        userId:            result.admin.id,
      })
      .catch((err) => {
        this.logger.warn(
          `⚠️  Email de bienvenue non envoyé à ${dto.adminEmail} — société ${dto.code}`,
          err?.message ?? err,
        );
      });

    return result;
  }

  // ========================================================
  // LECTURE — Liste
  // ✅ v4.8 — FIX : deletedAt: null ajouté. Une société désactivée
  // (voir remove() plus bas) ne doit plus apparaître dans la liste
  // globale du Super Admin — même principe que agencies.service.ts
  // v4.5/v4.6 (les LISTES filtrent, les vues DÉTAIL non, voir findOne
  // ci-dessous, volontairement inchangé).
  // ========================================================

  async findAll() {
    return this.prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count:  { select: { users: true, agencies: true } },
        wallets: { where: { isActive: true } },
      },
    });
  }

  // ⚠️ Volontairement SANS filtre deletedAt — consultation ponctuelle
  // et délibérée d'une société précise (ex. depuis l'historique d'une
  // transaction) toujours possible pour l'audit, même désactivée.
  async findOne(id: number) {
    return this.prisma.client.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
    });
  }

  // ✅ v4.8 — FIX (PROBLÈME 3) : isActive: true ajouté — voir
  // changelog en tête de fichier. Utilisée par TenantService.
  // getCurrentClient() pour résoudre le tenant de chaque requête
  // passant par TenantGuard.
  async findByCode(code: string) {
    return this.prisma.client.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
    });
  }

  // ========================================================
  // BRANDING PUBLIC PAR CODE
  // ========================================================

  async findPublicByCode(code: string): Promise<PublicBranding | null> {
    const client = await this.prisma.client.findFirst({
      where: { code: code.toUpperCase(), isActive: true },
      select: PUBLIC_BRANDING_SELECT,
    });

    if (!client) return null;
    return this.mapPublicBranding(client);
  }

  // ========================================================
  // BRANDING PUBLIC PAR HOSTNAME
  // ========================================================

  async findPublicByHost(host: string): Promise<PublicBranding | null> {
    const normalizedHost = host.toLowerCase().trim();

    const parts = normalizedHost.split('.');
    const extractedSub =
      parts.length >= 3 && parts[0] !== 'www' ? parts[0] : null;

    const orConditions: any[] = [
      { customDomain: normalizedHost },
    ];

    if (extractedSub) {
      orConditions.push({ subdomain: extractedSub });
      orConditions.push({ code: extractedSub.toUpperCase() });
    }

    const client = await this.prisma.client.findFirst({
      where: {
        isActive: true,
        OR: orConditions,
      },
      orderBy: { createdAt: 'asc' },
      select: PUBLIC_BRANDING_SELECT,
    });

    if (!client) return null;
    return this.mapPublicBranding(client);
  }

  // ========================================================
  // MISE À JOUR — SUPER_ADMIN (tous champs, sans restriction)
  // ========================================================

  async update(id: number, data: any) {
    const updateData: any = { ...data };
    delete updateData.adminEmail;
    delete updateData.adminFirstName;
    delete updateData.adminLastName;
    delete updateData.adminPassword;
    delete updateData.id;

    if (updateData.status) {
      updateData.subscriptionStatus = updateData.status;
      delete updateData.status;
    }

    if (updateData.country || updateData.ownerCountry) {
      const countryCode = (updateData.country ?? updateData.ownerCountry)
        ?.toUpperCase()
        .substring(0, 2);
      updateData.defaultCurrency = getCurrencyFromCountry(countryCode);
    }

    if (updateData.subdomain) {
      updateData.subdomain = String(updateData.subdomain).toLowerCase().trim() || null;
    }
    if (updateData.customDomain) {
      updateData.customDomain = String(updateData.customDomain).toLowerCase().trim() || null;
    }

    return this.prisma.client.update({ where: { id }, data: updateData });
  }

  // ========================================================
  // ✅ v4.7 — MISE À JOUR SELF-SERVICE — COMPANY_ADMIN
  //
  // Volontairement séparée de update() ci-dessus : celle-ci ne
  // touche QUE `name`, jamais subscriptionStatus, devise, branding,
  // etc. Le clientId doit venir du token JWT de l'appelant (voir
  // clients.controller.ts) — jamais d'un paramètre d'URL — pour qu'un
  // COMPANY_ADMIN ne puisse structurellement modifier que sa PROPRE
  // société, sans avoir besoin de vérification de propriété ici.
  // ========================================================

  async updateOwnName(clientId: number, name: string) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Le nom de la société est requis.');
    }
    if (trimmed.length > 120) {
      throw new BadRequestException('Le nom de la société est trop long (120 caractères max).');
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Société introuvable');

    return this.prisma.client.update({
      where: { id: clientId },
      data:  { name: trimmed },
    });
  }

  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({
      where: { id },
      data:  { subscriptionStatus: status },
    });
  }

  // ========================================================
  // SUPPRESSION (désactivation en cascade — voir changelog v4.8,
  // PROBLÈME 1)
  //
  // Principe : supprimer une société ne doit JAMAIS détruire de
  // donnée financière ou de conformité — ça doit être une
  // DÉSACTIVATION. Même philosophie qu'agencies.service.ts v4.5/v4.6,
  // étendue à l'échelle de toute la société :
  //   • Transaction, Wallet (solde), LedgerEntry, KycDocument,
  //     AmlFlag, LoginHistory, AuditLog : jamais touchés — ni
  //     supprimés, ni même soft-deleted. Entièrement intacts et
  //     interrogeables (audit, réconciliation, demande régulateur).
  //   • Wallet.isActive → false partout (société, agences, users) —
  //     désactivés, jamais supprimés. Solde et historique de ledger
  //     conservés tels quels.
  //   • otpLog/userDevice/userSession de tous les users de la société :
  //     seuls éléments encore supprimés DÉFINITIVEMENT — hygiène de
  //     sécurité, aucune valeur d'audit à long terme.
  //   • Tous les User de la société : désactivés en douceur (deletedAt
  //     + isActive:false), email préfixé (NOT NULL → libère la valeur
  //     tout en gardant la traçabilité), phone vidé (libère la valeur).
  //   • Toutes les Agency de la société : désactivées en douceur, code
  //     libéré (nullable, @unique).
  //   • La Client elle-même : désactivée en douceur, code/subdomain/
  //     customDomain libérés (tous nullable, @unique).
  //   • Solde restant (société, users ou agences) au moment de la
  //     désactivation : signalé en avertissements NON BLOQUANTS dans
  //     la réponse — jamais une exception. Une société frauduleuse
  //     doit pouvoir être coupée immédiatement ; la réconciliation se
  //     fait séparément.
  // ========================================================

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!client) throw new NotFoundException('Société introuvable');
    if (client.deletedAt) throw new NotFoundException('Société déjà supprimée');
    if (client.code === 'DONIKO') {
      throw new ConflictException(
        'Impossible de supprimer la société système DONIKO.',
      );
    }

    const users = await this.prisma.user.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true, email: true },
    });
    const userIds = users.map((u) => u.id);

    const agencies = await this.prisma.agency.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true },
    });
    const agencyIds = agencies.map((a) => a.id);

    // ── Avertissements non bloquants sur les soldes restants ──
    const warnings: string[] = [];

    const clientBalance = client.wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    if (clientBalance !== 0) {
      warnings.push(
        `Le wallet de la société conservait un solde de ${clientBalance} au moment de la désactivation — à réconcilier séparément.`,
      );
    }

    if (userIds.length > 0) {
      const userWallets = await this.prisma.wallet.findMany({
        where: { userId: { in: userIds }, isActive: true },
        select: { balance: true },
      });
      const usersBalance = userWallets.reduce((sum, w) => sum + Number(w.balance), 0);
      if (usersBalance !== 0) {
        warnings.push(
          `Les wallets des ${userIds.length} utilisateur(s) conservaient un solde total de ${usersBalance} — à réconcilier séparément.`,
        );
      }
    }

    if (agencyIds.length > 0) {
      const agencyWallets = await this.prisma.wallet.findMany({
        where: { agencyId: { in: agencyIds }, isActive: true },
        select: { balance: true },
      });
      const agenciesBalance = agencyWallets.reduce((sum, w) => sum + Number(w.balance), 0);
      if (agenciesBalance !== 0) {
        warnings.push(
          `Les wallets des ${agencyIds.length} agence(s) conservaient un solde total de ${agenciesBalance} — à réconcilier séparément.`,
        );
      }
    }

    const updatedClient = await this.prisma.$transaction(async (tx) => {
      if (userIds.length > 0) {
        // Sessions/appareils/OTP : seuls éléments encore supprimés
        // DÉFINITIVEMENT — non financiers, aucune valeur d'audit à
        // long terme, et il faut couper l'accès immédiatement.
        try { await tx.otpLog.deleteMany({ where: { userId: { in: userIds } } }); } catch (_) {}
        try { await tx.userDevice.deleteMany({ where: { userId: { in: userIds } } }); } catch (_) {}
        try { await tx.userSession.deleteMany({ where: { userId: { in: userIds } } }); } catch (_) {}

        // Wallets utilisateurs : désactivés, jamais supprimés.
        await tx.wallet.updateMany({
          where: { userId: { in: userIds }, isActive: true },
          data:  { isActive: false },
        });

        // deletedAt/isActive/isSuspended/phone : même valeur pour tous
        // → un seul updateMany. isSuspended:true ajouté pour cohérence
        // avec UsersService.softDelete() et agencies.service.ts v4.7 —
        // auth.service.ts (login/loginByPhone) vérifie les deux.
        await tx.user.updateMany({
          where: { id: { in: userIds }, deletedAt: null },
          data:  { deletedAt: new Date(), isActive: false, isSuspended: true, phone: null },
        });
        // email (NOT NULL, @unique) : valeur distincte par ligne → boucle,
        // seul champ qui ne peut pas passer par updateMany.
        for (const u of users) {
          await tx.user.update({
            where: { id: u.id },
            data:  { email: `deleted_${Date.now()}_${u.email}` },
          });
        }
      }

      if (agencyIds.length > 0) {
        // Wallets d'agences : désactivés, jamais supprimés.
        await tx.wallet.updateMany({
          where: { agencyId: { in: agencyIds }, isActive: true },
          data:  { isActive: false },
        });

        // Agences : désactivées en douceur, code libéré (null n'entre
        // jamais en collision avec la contrainte @unique — un seul
        // updateMany suffit ici, contrairement à email sur User).
        // managerId n'a pas besoin d'être détaché : les users
        // référencés ne sont plus supprimés définitivement.
        await tx.agency.updateMany({
          where: { id: { in: agencyIds }, deletedAt: null },
          data:  { deletedAt: new Date(), isActive: false, code: null },
        });
      }

      // Wallets de la société elle-même : désactivés, jamais supprimés.
      await tx.wallet.updateMany({
        where: { clientId: id, isActive: true },
        data:  { isActive: false },
      });

      // ✅ FIX : Client.code est `String @unique` — NON nullable,
      // contrairement à Agency.code (`String? @unique`). L'hypothèse
      // initiale (le vider comme sur Agency) provoquait une erreur de
      // type Prisma/TS (ts2322) : null n'est pas assignable à un champ
      // string requis. Corrigé en le préfixant plutôt que de le vider —
      // même mécanisme que l'email plus haut : la valeur exacte est
      // libérée pour réutilisation, tout en restant une chaîne non
      // nulle et en conservant la traçabilité forensique. subdomain et
      // customDomain restent nullable, donc null reste correct pour eux.
      return tx.client.update({
        where: { id },
        data: {
          deletedAt:    new Date(),
          isActive:     false,
          code:         `DELETED_${Date.now()}_${client.code}`,
          subdomain:    null,
          customDomain: null,
        },
      });
    });

    return { ...updatedClient, warnings };
  }
}