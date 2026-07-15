// apps/backend/src/agencies/agencies.service.ts
// =========================================================
// AGENCIES SERVICE v4.7
// ✅ v4.2 : FIX CurrencyCode enum cast (migration v4.1)
//
// ✅ v4.3 : 🐛 FIX — modification du responsable sans effet
//
//   PROBLÈME RÉSOLU :
//   "Modifier l'Agence" → section RESPONSABLE (téléphone, prénom,
//   nom) mettait à jour uniquement la table Agency. Le compte User
//   de l'agent lié n'était JAMAIS synchronisé après la création
//   initiale (où les deux étaient bien écrits ensemble dans
//   create()). Résultat : un admin change le téléphone via l'écran
//   "Modifier l'Agence", ça a l'air de marcher (Agency.phone est bien
//   à jour), mais le compte réel de l'agent (login, profil affiché
//   dans l'app, etc.) garde son ancien numéro partout ailleurs.
//
//   CORRECTIF :
//   - Ajout de Agency.managerId (schema.prisma v5.1) : désigne
//     explicitement LE responsable, au lieu de deviner via le
//     "premier agent" d'une liste non triée (même famille de bug que
//     la collision de téléphone : une ambiguïté d'identité qui finit
//     par tromper une logique métier).
//   - update() résout maintenant explicitement ce responsable
//     (auto-résolution + auto-réparation pour les agences créées
//     avant l'introduction de managerId), puis répercute téléphone
//     et nom sur SON compte User via UsersService.update() — réutilise
//     la même normalisation + vérification d'unicité du téléphone que
//     partout ailleurs dans l'app, plutôt que de la dupliquer.
//   - Le tout dans LA MÊME transaction Prisma que la mise à jour de
//     l'agence : si le nouveau téléphone est déjà pris par un autre
//     compte, TOUT est annulé ensemble (rien n'est à moitié appliqué).
//   - Email : ciblait auparavant TOUS les agents (role: AGENT) via
//     updateMany — cassait dès qu'une agence avait 2+ agents, car
//     `email` est @unique sur User (impossible d'assigner la même
//     valeur à 2 lignes). Ciblé maintenant sur le seul responsable
//     résolu ci-dessus.
//
// ✅ v4.4 : 🚨 2 correctifs — mot de passe en dur + suppression définitive
//
//   PROBLÈME 1 RÉSOLU — mot de passe en dur '123456'
//     create() faisait : bcrypt.hash(dto.adminPassword || '123456', 10).
//     Toute agence créée sans mot de passe explicite recevait EXACTEMENT
//     le même mot de passe, connu de quiconque lit ce fichier — un
//     compte AGENT avec accès à un wallet et à des opérations
//     financières protégé par un secret partagé public.
//     CORRECTIF : generateSecurePassword() génère 24 caractères
//     hexadécimaux aléatoires (crypto.randomBytes, jamais prévisible,
//     jamais répété) quand dto.adminPassword est vide. Le mot de passe
//     généré est (a) envoyé par email au nouvel agent — même mécanisme
//     que le mail de bienvenue de AuthService.register() — et (b)
//     renvoyé UNE FOIS dans la réponse de create() (champ
//     generatedPassword, absent si l'admin avait fourni le sien), pour
//     que l'admin qui vient de créer l'agence puisse le communiquer
//     même si l'email n'arrive pas immédiatement.
//     ⚠️ Nécessite MailService disponible pour injection dans
//     AgenciesModule. Si Nest lève "Can't resolve dependencies of
//     AgenciesService (?, UsersService, MailService)" au démarrage,
//     importer MailModule (ou équivalent) dans agencies.module.ts —
//     très probablement déjà global vu son usage dans auth.service.ts
//     et transactions.service.ts, mais non vérifiable sans ce fichier.
//
//   PROBLÈME 2 RÉSOLU EN v4.4, COMPLÉTÉ EN v4.5 — suppression définitive
//
//     v4.4 avait ajouté Transaction.deletedAt et fait passer remove()
//     d'un tx.transaction.deleteMany() à un updateMany({ deletedAt }).
//     Mais cette version avait un bug non détecté sur le moment :
//     remove() continuait ensuite à faire tx.user.deleteMany() sur les
//     AGENTS eux-mêmes. Or Transaction.senderId/recipientId sont des
//     clés étrangères NON NULLABLES vers User, sans onDelete: Cascade
//     dans le schéma. Résultat concret si v4.4 avait été déployé tel
//     quel : dès qu'un agent avait ne serait-ce qu'UNE transaction
//     (le cas normal pour un agent qui a servi), la transaction
//     survivait (deletedAt) mais le DELETE de son compte User aurait
//     été rejeté par la contrainte de clé étrangère — remove() aurait
//     échoué (500) pour toute agence ayant un minimum d'historique.
//     v4.4 réglait un problème (perte de données) en introduisant une
//     régression fonctionnelle (suppression cassée).
//
//     v4.5 reprend le sujet dans son ensemble avec un principe simple,
//     standard pour une fintech réelle : SUPPRIMER UNE AGENCE NE DOIT
//     JAMAIS DÉTRUIRE DE DONNÉE FINANCIÈRE OU DE CONFORMITÉ — ça doit
//     être une DÉSACTIVATION. Concrètement :
//       • Transaction, Wallet, LedgerEntry, KycDocument, AmlFlag,
//         LoginHistory : plus touchés DU TOUT (ni supprimés, ni même
//         soft-deleted) — ils restent pleinement intacts et
//         interrogeables (audit, réconciliation, demande régulateur).
//         Transaction.deletedAt (v5.1) reste dans le schéma comme
//         infrastructure générale disponible pour un futur besoin,
//         mais n'est plus utilisé par CE flux — il n'y en a plus
//         besoin puisque les Users ne sont plus supprimés non plus.
//       • Wallet (agence + agents) : désactivé (isActive:false),
//         jamais supprimé — solde et historique de ledger conservés
//         tels quels.
//       • Sessions/appareils/OTP (otpLog, userDevice, userSession) :
//         seuls éléments encore supprimés DÉFINITIVEMENT — non
//         financiers, aucune valeur d'audit à long terme, et il faut
//         au contraire couper l'accès immédiatement (hygiène de
//         sécurité — un agent désactivé ne doit garder aucune session
//         active).
//       • User (agents) : suppression douce (deletedAt + isActive:
//         false) au lieu d'un DELETE — email (NOT NULL, @unique) est
//         préfixé "deleted_<timestamp>_<email original>" pour libérer
//         la valeur exacte en vue d'une réutilisation future tout en
//         conservant la traçabilité forensique ; phone (@unique,
//         nullable) est vidé.
//       • Agency elle-même : a un deletedAt depuis v5.1, jamais
//         utilisé jusqu'ici — remove() faisait un DELETE définitif
//         malgré ça. Corrigé : désormais désactivée en douceur
//         (deletedAt + isActive:false), code (nullable, @unique)
//         libéré pour réutilisation. managerId n'est plus détaché :
//         plus de risque de clé étrangère à éviter (le manager n'est
//         plus supprimé définitivement), et garder ce pointeur
//         historique est même utile pour l'audit ("cette agence
//         désactivée était gérée par cet agent désactivé").
//       • Soldes restants (agence ou agents) au moment de la
//         désactivation : signalés en avertissements NON BLOQUANTS
//         dans la réponse (jamais une exception) — un compte
//         compromis/frauduleux doit pouvoir être coupé immédiatement
//         même avec un solde non nul ; la réconciliation se fait
//         séparément, après coup.
//     ⚠️ findAllByClient/findAll filtrent désormais deletedAt: null
//     pour ne plus lister les agences désactivées. Un filtrage
//     équivalent était nécessaire côté UsersController (voir v4.6
//     ci-dessous — confirmé et corrigé depuis, users.controller.ts
//     ayant finalement été fourni).
//
// ✅ v4.6 : 🐛 FIX — findOne()/findOneAsSuperAdmin() trop stricts
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   Le filtre deletedAt: null ajouté en v4.5 avait été appliqué à
//   TOUTES les méthodes de lecture, y compris findOne()/
//   findOneAsSuperAdmin() — la consultation d'UNE agence précise par
//   son id. Or users.controller.ts (fourni depuis) illustre le bon
//   principe déjà appliqué là-bas : findAll() (liste) filtre
//   deletedAt, mais findOne() (fiche détail d'un id précis) ne le
//   fait délibérément pas, pour qu'un admin puisse toujours consulter
//   un compte désactivé lors d'un audit (ex. en cliquant depuis
//   l'historique d'une transaction). Appliquer le même filtre à
//   findOne()/findOneAsSuperAdmin() ici rendait une agence désactivée
//   introuvable même par consultation directe et délibérée de son id
//   — un accès plus restrictif que nécessaire, et incohérent avec le
//   reste de l'app.
//   CORRECTIF : deletedAt retiré du where de l'agence elle-même dans
//   findOne()/findOneAsSuperAdmin() (les LISTES — findAllByClient(),
//   findAll() — gardent le filtre, elles). Les agents INCLUS dans la
//   réponse restent filtrés deletedAt: null : la fiche affiche
//   l'agence même désactivée, mais pas une liste d'agents eux-mêmes
//   désactivés individuellement.
//
// ✅ v4.7 : 🐛 FIX — isSuspended jamais posé lors de la désactivation
//     d'un agent
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   remove() posait deletedAt + isActive:false sur les agents désactivés,
//   mais jamais isSuspended:true — contrairement à UsersService.
//   softDelete() qui le fait depuis le début. auth.service.ts (login/
//   loginByPhone) vérifie deletedAt (depuis sa v5.5) ET isSuspended ;
//   les deux mécanismes se recoupent en défense en profondeur, mais
//   laisser isSuspended à false ici cassait la cohérence entre les
//   deux voies de désactivation existantes dans l'app.
//   CORRECTIF : isSuspended:true ajouté à la même écriture.
// =========================================================

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CurrencyCode, KycLevel, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

// =========================================================
// HELPERS
// =========================================================

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

function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (!country) return CurrencyCode.XOF;
  const code = country.toUpperCase().trim().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? CurrencyCode.XOF;
}

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function generateReferralCode(firstName?: string, lastName?: string): string {
  const prefix = `${(firstName ?? 'A').slice(0, 1)}${(lastName ?? 'G').slice(0, 1)}`.toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
}

// ✅ v4.4 — remplace le fallback en dur '123456'. 12 octets aléatoires
// (crypto, pas Math.random) → 24 caractères hexadécimaux, jamais
// prévisible, jamais répété d'un compte à l'autre.
function generateSecurePassword(): string {
  return crypto.randomBytes(12).toString('hex');
}

// ✅ v4.3 — même règle de résolution "responsable" que le frontend
// (edit.tsx / details.tsx) : premier agent AGENT/COMPANY_ADMIN par
// ordre de création, à défaut le tout premier agent restant. Utilisée
// uniquement en filet de secours quand managerId n'est pas encore
// renseigné (agences créées avant l'introduction de ce champ).
function resolveManagerFallback<T extends { role: Role }>(agents: T[]): T | null {
  return (
    agents.find((a) => a.role === Role.COMPANY_ADMIN || a.role === Role.AGENT) ??
    agents[0] ??
    null
  );
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class AgenciesService {
  private readonly logger = new Logger(AgenciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mail: MailService, // ✅ v4.4
  ) {}

  // ========================================================
  // CRÉATION
  // ========================================================

  async create(clientId: number, dto: CreateAgencyDto) {
    if (!clientId || !Number.isFinite(clientId)) {
      throw new BadRequestException('clientId invalide');
    }

    const email = safeTrim(dto.email).toLowerCase();
    if (!email) throw new BadRequestException('Email requis');

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new ConflictException(`L'email "${email}" est déjà utilisé.`);

    if (dto.code) {
      const existingCode = await this.prisma.agency.findUnique({ where: { code: dto.code } });
      if (existingCode)
        throw new ConflictException(`Le code "${dto.code}" est déjà utilisé.`);
    }

    // ✅ v4.4 — FIX : plus de mot de passe en dur '123456'. Voir
    // changelog en tête de fichier, PROBLÈME 1.
    const providedPassword  = safeTrim(dto.adminPassword);
    const generatedPassword = providedPassword ? null : generateSecurePassword();
    const hashedPassword    = await bcrypt.hash(providedPassword || (generatedPassword as string), 10);

    // ✅ FIX: CurrencyCode
    const primaryCurrency: CurrencyCode = getCurrencyFromCountry(dto.country);

    const { agency: createdAgency, agent } = await this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: safeTrim(dto.name),
          city: safeTrim(dto.city),
          address: safeTrim(dto.address),
          phone: safeTrim(dto.phone) || null,
          code: dto.code || null,
          email,
          country: dto.country || null,
          primaryCurrency,
          isActive: true,
          clientId,
          // ✅ FIX: type agence persisté
          type: (dto.type === 'PARTNER' ? 'PARTNER' : 'SUBSIDIARY') as any,
        },
      });

      await tx.wallet.create({
        data: {
          agencyId: agency.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

      const agentUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: safeTrim(dto.adminFirstName) || 'Agent',
          lastName: safeTrim(dto.adminLastName) || 'Agence',
          role: Role.AGENT,
          clientId,
          agencyId: agency.id,
          phone: safeTrim(dto.phone) || null,
          city: safeTrim(dto.city) || null,
          country: dto.country || null,
          primaryCurrency,
          jobTitle: 'Responsable Agence',
          kycLevel: KycLevel.LEVEL_1,
          isEmailVerified: true,
          referralCode: generateReferralCode(dto.adminFirstName, dto.adminLastName),
        },
      });

      await tx.wallet.create({
        data: {
          userId: agentUser.id,
          currency: primaryCurrency,
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      });

      // ✅ v4.3 — Désigne explicitement cet agent comme responsable de
      // l'agence (Agency.managerId). Ordre obligatoire : l'agence doit
      // déjà exister pour créer l'agent (agencyId), et l'agent doit
      // déjà exister pour pointer managerId dessus — d'où cette mise
      // à jour en 3ᵉ étape plutôt qu'un champ direct à la création.
      const updatedAgency = await tx.agency.update({
        where: { id: agency.id },
        data: { managerId: agentUser.id },
      });

      return {
        agency: this.serializeAgency(updatedAgency),
        agent: this.serializeUser(agentUser),
      };
    });

    // ✅ v4.4 — email du mot de passe temporaire, UNIQUEMENT s'il a été
    // généré automatiquement. Jamais envoyé si l'admin avait fourni le
    // sien (il le connaît déjà). Non-bloquant, même pattern que le
    // reste du service (auth.service.ts, transactions.service.ts).
    if (generatedPassword && agent.email) {
      this.mail.sendEmail(
        agent.email,
        "Votre compte agence Direct Transf'air",
        `<p>Bonjour ${agent.firstName ?? ''},</p>
         <p>Votre compte responsable d'agence a été créé sur Direct Transf'air.</p>
         <p>Mot de passe temporaire :</p>
         <p style="font-size:22px;font-weight:700;letter-spacing:3px;font-family:monospace;background:#F0FDF4;color:#059669;padding:14px;border-radius:8px;text-align:center;">${generatedPassword}</p>
         <p>Nous vous recommandons de le changer dès votre première connexion.</p>`,
      ).catch((err) => {
        this.logger.warn(`Email mot de passe temporaire non envoyé : ${err?.message}`);
      });
    }

    return {
      agency: createdAgency,
      agent,
      // ✅ v4.4 — présent uniquement si généré automatiquement (undefined
      // sinon, donc absent du JSON de réponse). Permet à l'admin qui
      // vient de créer l'agence de le communiquer même si l'email
      // n'arrive pas tout de suite.
      generatedPassword: generatedPassword ?? undefined,
    };
  }

  // ========================================================
  // MISE À JOUR
  // ========================================================

  async update(id: string, clientId: number, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, clientId, deletedAt: null },
      include: {
        manager: true,
        agents: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        name: dto.name,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
        code: dto.code,
        // ✅ FIX: type agence mis à jour
        ...(dto.type !== undefined && {
          type: dto.type === 'PARTNER' ? 'PARTNER' : 'SUBSIDIARY',
        }),
      };

      if (dto.country) {
        updateData.country = dto.country;
        // ✅ FIX: CurrencyCode
        updateData.primaryCurrency = getCurrencyFromCountry(dto.country);
      }

      if ('isActive' in dto) {
        updateData.isActive = (dto as any).isActive;
      }

      // ✅ v4.3 — Résolution du responsable de l'agence.
      // Si managerId n'est pas encore renseigné (agence créée avant
      // l'introduction de ce champ), on retombe sur la même règle que
      // le frontend utilise déjà pour pré-remplir le formulaire, et on
      // fixe managerId dès maintenant pour ne plus jamais avoir à
      // deviner la prochaine fois (auto-réparation, une seule fois).
      let manager = agency.manager;
      if (!manager) {
        manager = resolveManagerFallback(agency.agents);
        if (manager) {
          updateData.managerId = manager.id;
        }
      }

      Object.keys(updateData).forEach((k) => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      const updatedAgency = await tx.agency.update({ where: { id }, data: updateData });

      // ✅ v4.3 — Synchronisation téléphone + nom du responsable vers
      // son compte User. Réutilise UsersService.update() — même
      // normalisation + vérification d'unicité du téléphone que
      // partout ailleurs (voir le correctif de collision de
      // téléphone) — en lui passant `tx` pour rester dans LA MÊME
      // transaction : si le numéro est déjà pris par un autre compte,
      // tout (y compris les changements sur l'agence) est annulé
      // ensemble plutôt que de laisser un état à moitié appliqué.
      if (manager) {
        const managerUpdate: Record<string, unknown> = {};

        if (dto.phone !== undefined) {
          managerUpdate.phone = dto.phone;
        }

        if (dto.managerName !== undefined) {
          const parts = safeTrim(dto.managerName).split(' ').filter(Boolean);
          if (parts.length > 0) {
            managerUpdate.firstName = parts[0];
            managerUpdate.lastName = parts.slice(1).join(' ') || manager.lastName;
          }
        }

        if (Object.keys(managerUpdate).length > 0) {
          await this.usersService.update(manager.id, managerUpdate, tx);
        }
      }

      // ── Email : login du responsable ────────────────────────
      // ✅ FIX v4.3 : ciblait auparavant TOUS les agents (role: AGENT)
      // via updateMany — cassait dès qu'une agence avait 2+ agents,
      // `email` étant @unique sur User (impossible d'assigner la même
      // valeur à 2 lignes en une seule requête). Ciblé maintenant sur
      // le seul responsable résolu ci-dessus.
      if (dto.email && dto.email !== agency.email && manager) {
        const newEmail = safeTrim(dto.email).toLowerCase();
        const exists = await tx.user.findFirst({
          where: { email: newEmail, id: { not: manager.id } },
        });
        if (exists) throw new ConflictException('Cet email est déjà pris.');

        await tx.user.update({ where: { id: manager.id }, data: { email: newEmail } });
        await tx.agency.update({ where: { id }, data: { email: newEmail } });
      }

      return this.serializeAgency(updatedAgency);
    });
  }

  // ========================================================
  // SUPPRESSION (désactivation douce — voir changelog v4.5)
  // ========================================================

  async remove(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, clientId, deletedAt: null },
      include: {
        agents:  { where: { deletedAt: null }, select: { id: true } },
        wallets: { where: { isActive: true } },
      },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');

    const agentIds = agency.agents.map((a) => a.id);

    // ✅ v4.5 — Avertissements NON BLOQUANTS sur les soldes restants.
    // Ne bloquent jamais la désactivation : un agent/une agence
    // compromis(e) doit pouvoir être coupé(e) immédiatement même avec
    // un solde non nul ; la réconciliation se fait séparément.
    const warnings: string[] = [];

    const agencyBalance = agency.wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    if (agencyBalance !== 0) {
      warnings.push(
        `Le wallet de l'agence conservait un solde de ${agencyBalance} au moment de la désactivation — à réconcilier séparément.`,
      );
    }

    if (agentIds.length > 0) {
      const agentWallets = await this.prisma.wallet.findMany({
        where: { userId: { in: agentIds }, isActive: true },
        select: { balance: true },
      });
      const agentsBalance = agentWallets.reduce((sum, w) => sum + Number(w.balance), 0);
      if (agentsBalance !== 0) {
        warnings.push(
          `Les wallets personnels des agents conservaient un solde total de ${agentsBalance} — à réconcilier séparément.`,
        );
      }
    }

    const updatedAgency = await this.prisma.$transaction(async (tx) => {
      if (agentIds.length > 0) {
        // Sessions/appareils/OTP : seuls éléments encore supprimés
        // DÉFINITIVEMENT — non financiers, aucune valeur d'audit à
        // long terme, et il faut au contraire couper l'accès
        // immédiatement (un agent désactivé ne doit garder aucune
        // session active).
        try { await tx.otpLog.deleteMany({ where: { userId: { in: agentIds } } }); } catch (_) {}
        try { await tx.userDevice.deleteMany({ where: { userId: { in: agentIds } } }); } catch (_) {}
        try { await tx.userSession.deleteMany({ where: { userId: { in: agentIds } } }); } catch (_) {}

        // Wallets personnels : désactivés, JAMAIS supprimés — solde
        // et historique de ledger conservés intacts.
        await tx.wallet.updateMany({
          where: { userId: { in: agentIds }, isActive: true },
          data:  { isActive: false },
        });

        // ✅ v4.5 — FIX (voir changelog en tête de fichier) : agents
        // désactivés en douceur (deletedAt + isActive:false) au lieu
        // d'un DELETE définitif. Transactions, KYC, AML, historique
        // de connexion : tout reste intact, rien n'est touché — plus
        // aucun risque de violation de clé étrangère (Transaction.
        // senderId/recipientId restent valides puisque le User existe
        // toujours).
        // ✅ v4.7 — FIX : isSuspended:true ajouté, cohérent avec
        // UsersService.softDelete() qui le fait déjà. auth.service.ts
        // (login/loginByPhone) bloque sur isSuspended ET deletedAt —
        // les deux doivent être posés pour une double protection.
        await tx.user.updateMany({
          where: { id: { in: agentIds }, deletedAt: null },
          data:  { deletedAt: new Date(), isActive: false, isSuspended: true },
        });

        // email (NOT NULL, @unique) et phone (@unique, nullable)
        // doivent être libérés individuellement pour permettre leur
        // réutilisation future par un nouveau compte — impossible via
        // un seul updateMany() avec la même valeur pour toutes les
        // lignes. email est préfixé (pas vidé) pour conserver la
        // traçabilité forensique de qui était ce compte.
        const agentsToFree = await tx.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, email: true },
        });
        for (const a of agentsToFree) {
          await tx.user.update({
            where: { id: a.id },
            data: {
              email: `deleted_${Date.now()}_${a.email}`,
              phone: null,
            },
          });
        }
      }

      // Wallet de l'agence elle-même : désactivé, jamais supprimé.
      await tx.wallet.updateMany({
        where: { agencyId: id, isActive: true },
        data:  { isActive: false },
      });

      // ✅ v4.5 — FIX : Agency a un deletedAt depuis v5.1, jamais
      // utilisé jusqu'ici — remove() faisait un DELETE définitif
      // malgré ça. Désormais désactivée en douceur ; code (nullable,
      // @unique) libéré pour réutilisation par une future agence.
      // managerId n'est plus détaché : le manager n'étant plus
      // supprimé définitivement, il n'y a plus de risque de clé
      // étrangère à éviter, et garder ce pointeur historique est même
      // utile pour l'audit.
      return tx.agency.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, code: null },
      });
    });

    return { ...this.serializeAgency(updatedAgency), warnings };
  }

  // ========================================================
  // LECTURE — CompanyAdmin
  // ========================================================

  async findAllByClient(clientId: number) {
    const agencies = await this.prisma.agency.findMany({
      where: { clientId, deletedAt: null },
      include: {
        agents: {
          where: { deletedAt: null },
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return agencies.map(this.serializeAgency.bind(this));
  }

  // ========================================================
  // LECTURE — SuperAdmin (toutes agences)
  // ========================================================

  async findAll() {
    const agencies = await this.prisma.agency.findMany({
      where: { deletedAt: null },
      include: {
        agents: {
          where: { deletedAt: null },
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
        client: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return agencies.map(this.serializeAgency.bind(this));
  }

  // ✅ v4.6 — FIX : plus de filtre deletedAt sur l'agence elle-même
  // ici (contrairement à findAllByClient/findAll). Une consultation
  // PONCTUELLE et DÉLIBÉRÉE (clic depuis l'historique d'une
  // transaction, par exemple) doit pouvoir afficher une agence
  // désactivée pour l'audit — seules les LISTES doivent la masquer.
  // Les agents inclus restent filtrés deletedAt: null : la fiche
  // affiche l'agence même désactivée, mais pas une liste d'agents
  // eux-mêmes désactivés individuellement.
  async findOne(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, clientId },
      include: {
        agents: {
          where: { deletedAt: null },
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
      },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.serializeAgency(agency);
  }

  // ✅ v4.6 — même correctif que findOne() ci-dessus.
  async findOneAsSuperAdmin(id: string) {
    const agency = await this.prisma.agency.findFirst({
      where: { id },
      include: {
        agents: {
          where: { deletedAt: null },
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, role: true,
          },
        },
        wallets: { where: { isActive: true } },
        client: { select: { id: true, name: true, code: true } },
      },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.serializeAgency(agency);
  }

  async updateAsSuperAdmin(id: string, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.update(id, agency.clientId, dto);
  }

  async removeAsSuperAdmin(id: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return this.remove(id, agency.clientId);
  }

  // ========================================================
  // SÉRIALISATION
  // ========================================================

  private serializeAgency(a: any) {
    return {
      id: a.id,
      name: a.name,
      city: a.city,
      address: a.address,
      phone: a.phone,
      email: a.email,
      code: a.code,
      country: a.country,
      primaryCurrency: a.primaryCurrency,
      isActive: a.isActive,
      isCertified: a.isCertified ?? false,
      clientId: a.clientId,
      clientName: a.client?.name ?? null,
      clientCode: a.client?.code ?? null,
      type: a.type,
      // ✅ v4.3 — expose managerId : source de vérité pour "qui est le
      // responsable", à préférer côté frontend à une déduction locale
      // (premier agent d'une liste non triée).
      managerId: a.managerId ?? null,
      wallets: Array.isArray(a.wallets)
        ? a.wallets.map((w: any) => ({
            id: w.id,
            currency: w.currency,
            balance: Number(w.balance),
            reservedBalance: Number(w.reservedBalance ?? 0),
            availableBalance: Number(w.balance) - Number(w.reservedBalance ?? 0),
            isDefault: w.isDefault,
          }))
        : undefined,
      agents: a.agents ?? undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private serializeUser(u: any) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      primaryCurrency: u.primaryCurrency,
      clientId: u.clientId,
      agencyId: u.agencyId,
    };
  }
}