// apps/backend/src/transactions/agency-treasury.service.ts
// =========================================================
// AGENCY TREASURY SERVICE v1.0 — Direct Transf'air
// Fichier indépendant — AUCUNE ligne de transactions.service.ts,
// wallets.service.ts ou ailleurs n'est modifiée par ce fichier.
//
// Couvre 2 flux symétriques (même sens de mouvement : agence →
// société), qui ne diffèrent que par QUI les initie :
//
//  1) remitToAdmin()      — l'AGENT envoie des fonds de son agence
//     vers le compte de la société (remontée volontaire).
//  2) collectFromAgency() — l'ADMIN (COMPANY_ADMIN/SUPER_ADMIN)
//     retire des fonds d'une agence de sa société vers son propre
//     compte (retrait forcé — "c'est sa société, son argent").
//
// Les deux :
//  - débitent le wallet AGENCE et créditent le wallet CLIENT (même
//    wallet que celui utilisé par declareBankTransfer/refillAgency,
//    déjà en place) via WalletsService.transfer(), qui gère le
//    verrouillage advisory des deux wallets en une seule transaction
//    DB — pas de risque d'incohérence partielle.
//  - créent une Transaction PAID immédiatement (mouvement de
//    trésorerie interne, pas un transfert client en attente),
//    avec type AGENCY_REMITTANCE ou AGENCY_COLLECTION (voir
//    schema.prisma) — visibles dans l'historique existant
//    (findForUser/adminFindAllForAdmin) sans aucune modification de
//    ces méthodes.
//  - déclenchent une notification in-app + un email pour les DEUX
//    parties (celui qui agit ET celui qui est impacté).
//
// ⚠️ Le providerRef de ces transactions ne contient JAMAIS de "|"
// (contrairement à AGENCY_REFILL qui encode "|AGENCY:<id>") : la
// méthode enrichTransaction() de TransactionsService réinterprète
// tout providerRef contenant "|" comme un split "code|prénom" pour
// tout type AUTRE que AGENCY_REFILL. Utiliser "|" ici casserait
// l'affichage sans toucher à ce fichier — l'agence est donc
// simplement nommée en clair dans le champ `note`.
// =========================================================

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CurrencyCode,
  Prisma,
  PaymentMethod,
  PayoutMethod,
  ProviderStatus,
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { TreasuryMailService } from '../mail/channels/treasury-mail.service';
import { TreasuryNotifierService } from '../notifications/channels/treasury-notifier.service';
import { CreateAgencyRemittanceDto } from './dto/create-agency-remittance.dto';
import { CreateAgencyCollectionDto } from './dto/create-agency-collection.dto';

function fmtAmount(amount: number, currency: string): string {
  const d = currency === 'GNF' || currency === 'XOF' ? 0 : 2;
  try {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(amount)} ${currency}`;
  } catch {
    return `${amount} ${currency}`;
  }
}

@Injectable()
export class AgencyTreasuryService {
  private readonly logger = new Logger(AgencyTreasuryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly treasuryMail: TreasuryMailService,
    private readonly treasuryNotifier: TreasuryNotifierService,
  ) {}

  // ========================================================
  // Résout la devise unique d'une agence (wallet par défaut
  // s'il existe déjà, sinon Agency.primaryCurrency) — même
  // logique que CompanyDashboard.tsx / refillAgency().
  // ========================================================

  private async resolveAgencyCurrency(agency: {
    id: string;
    primaryCurrency: CurrencyCode;
  }): Promise<CurrencyCode> {
    const wallets = await this.prisma.wallet.findMany({
      where: { agencyId: agency.id, isActive: true },
    });
    const primary = wallets.find((w) => w.isDefault) ?? wallets[0];
    return (primary?.currency as CurrencyCode | undefined) ?? agency.primaryCurrency ?? CurrencyCode.XOF;
  }

  // ========================================================
  // Exécute le mouvement wallet agence → wallet société +
  // crée la Transaction PAID correspondante. Partagé par les
  // deux flux publics ci-dessous.
  // ========================================================

  private async executeAgencyToCompanyTransfer(params: {
    agencyId: string;
    agencyName: string;
    clientId: number;
    amount: number;
    currency: CurrencyCode;
    note?: string;
    type: TransactionType;
    senderId: string;
  }): Promise<Transaction> {
    const { agencyId, agencyName, clientId, amount, currency, note, type, senderId } = params;

    const agencyWalletRef = await this.walletsService.getOrCreateWallet({ agencyId, currency });
    const companyWalletRef = await this.walletsService.getOrCreateWallet({ clientId, currency });

    // Vérification préalable pour un message d'erreur clair — le
    // transfer() ci-dessous revérifie de toute façon (défense en
    // profondeur, pas de doublon de logique métier).
    const agencyWallet = await this.prisma.wallet.findUnique({ where: { id: agencyWalletRef.id } });
    if (!agencyWallet) throw new NotFoundException('Wallet agence introuvable');

    const available = Number(agencyWallet.balance) - Number(agencyWallet.reservedBalance ?? 0);
    if (available < amount) {
      throw new ForbiddenException(
        `Solde agence ${currency} insuffisant. ` +
        `Disponible : ${available.toLocaleString('fr-FR')} ${currency} — Demandé : ${amount.toLocaleString('fr-FR')} ${currency}.`,
      );
    }

    const reference =
      type === TransactionType.AGENCY_REMITTANCE ? `REMIT-${Date.now()}` : `COLL-${Date.now()}`;

    const description =
      note?.trim() ||
      (type === TransactionType.AGENCY_REMITTANCE
        ? `Remontée de fonds — ${agencyName}`
        : `Retrait forcé — ${agencyName}`);

    // ✅ Débit agence + crédit société en une seule transaction DB
    // verrouillée (voir WalletsService.transfer) — pas d'état
    // intermédiaire incohérent possible.
    await this.walletsService.transfer({
      fromWalletId: agencyWalletRef.id,
      toWalletId: companyWalletRef.id,
      amount,
      description,
    });

    const noteWithAgency = [note?.trim(), `Agence : ${agencyName}`].filter(Boolean).join(' — ');

    const transaction = await this.prisma.transaction.create({
      data: {
        reference,
        type,
        direction: TransactionDirection.INTERNAL,
        amount: new Prisma.Decimal(amount),
        fees: new Prisma.Decimal(0),
        total: new Prisma.Decimal(amount),
        currency,
        status: TransactionStatus.PAID,
        payoutMethod: PayoutMethod.WALLET,
        paymentMethod: PaymentMethod.WALLET,
        senderId,
        clientId,
        paidAt: new Date(),
        providerStatus: ProviderStatus.SUCCESS,
        providerRef: reference, // jamais de "|" ici, voir note en tête de fichier
        note: noteWithAgency,
      },
    });

    return transaction;
  }

  // ========================================================
  // FLUX 1 — Agent → Admin (remontée de fonds)
  // ========================================================

  async remitToAdmin(agentId: string, dto: CreateAgencyRemittanceDto): Promise<Transaction> {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) throw new BadRequestException('Montant invalide');

    const agent = await this.prisma.user.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent introuvable');
    if (!agent.agencyId) throw new ForbiddenException("Cet utilisateur n'est rattaché à aucune agence.");
    if (!agent.clientId) throw new ForbiddenException('Agent sans société associée.');

    const agency = await this.prisma.agency.findUnique({ where: { id: agent.agencyId } });
    if (!agency) throw new NotFoundException('Agence introuvable');

    const currency = await this.resolveAgencyCurrency(agency);

    const transaction = await this.executeAgencyToCompanyTransfer({
      agencyId: agency.id,
      agencyName: agency.name,
      clientId: agent.clientId,
      amount,
      currency,
      note: dto.note,
      type: TransactionType.AGENCY_REMITTANCE,
      senderId: agentId,
    });

    // Notifications + emails — fire and forget, ne bloquent jamais
    // la réponse HTTP et n'annulent jamais la transaction en cas
    // d'échec (même philosophie que le reste du module transactions).
    this.notifyRemittance(agent, agency, transaction, amount, currency).catch((err) =>
      this.logger.warn(`Notification remittance non envoyée : ${err?.message}`),
    );

    return transaction;
  }

  private async notifyRemittance(
    agent: { id: string; email: string; firstName: string | null; lastName: string | null },
    agency: { id: string; name: string; clientId: number },
    transaction: Transaction,
    amount: number,
    currency: CurrencyCode,
  ): Promise<void> {
    const amountLabel = fmtAmount(amount, currency);
    const agentName = `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim() || 'Agent';

    // Confirmation à l'agent
    this.treasuryNotifier.notifyRemittanceSent(agent.id, amountLabel, agency.name).catch(() => {});
    if (agent.email) {
      this.treasuryMail
        .sendRemittanceSent({
          email: agent.email,
          agentName,
          agencyName: agency.name,
          amount,
          currency,
          note: transaction.note ?? undefined,
          reference: transaction.reference,
          userId: agent.id,
        })
        .catch((err) => this.logger.warn(`Email remittance agent non envoyé : ${err?.message}`));
    }

    // Notification aux admins de la société
    const admins = await this.prisma.user.findMany({
      where: { clientId: agency.clientId, role: 'COMPANY_ADMIN', deletedAt: null, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    for (const admin of admins) {
      const adminName = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || 'Admin';
      this.treasuryNotifier
        .notifyRemittanceReceived(admin.id, amountLabel, agency.name, agentName)
        .catch(() => {});
      if (admin.email) {
        this.treasuryMail
          .sendRemittanceReceived({
            email: admin.email,
            adminName,
            agentName,
            agencyName: agency.name,
            amount,
            currency,
            note: transaction.note ?? undefined,
            reference: transaction.reference,
            userId: admin.id,
          })
          .catch((err) => this.logger.warn(`Email remittance admin non envoyé : ${err?.message}`));
      }
    }
  }

  // ========================================================
  // FLUX 2 — Admin → Agence (retrait forcé)
  // ========================================================

  async collectFromAgency(adminId: string, dto: CreateAgencyCollectionDto): Promise<Transaction> {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) throw new BadRequestException('Montant invalide');
    if (!dto.note || !dto.note.trim()) throw new BadRequestException('Le libellé est requis.');

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Administrateur introuvable');

    const agency = await this.prisma.agency.findUnique({ where: { id: dto.agencyId } });
    if (!agency) throw new NotFoundException('Agence introuvable');

    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      if (!admin.clientId) throw new ForbiddenException('Administrateur sans société associée.');
      if (agency.clientId !== admin.clientId) {
        throw new ForbiddenException('Cette agence ne vous appartient pas.');
      }
    }

    const clientId = isSuperAdmin ? agency.clientId : admin.clientId!;
    const currency = await this.resolveAgencyCurrency(agency);

    const transaction = await this.executeAgencyToCompanyTransfer({
      agencyId: agency.id,
      agencyName: agency.name,
      clientId,
      amount,
      currency,
      note: dto.note,
      type: TransactionType.AGENCY_COLLECTION,
      senderId: adminId,
    });

    this.notifyCollection(admin, agency, transaction, amount, currency).catch((err) =>
      this.logger.warn(`Notification collection non envoyée : ${err?.message}`),
    );

    return transaction;
  }

  private async notifyCollection(
    admin: { id: string; email: string; firstName: string | null; lastName: string | null },
    agency: { id: string; name: string },
    transaction: Transaction,
    amount: number,
    currency: CurrencyCode,
  ): Promise<void> {
    const amountLabel = fmtAmount(amount, currency);
    const adminName = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || 'Administrateur';

    // Confirmation à l'admin
    this.treasuryNotifier.notifyCollectionDone(admin.id, amountLabel, agency.name).catch(() => {});
    if (admin.email) {
      this.treasuryMail
        .sendCollectionConfirmation({
          email: admin.email,
          adminName,
          agencyName: agency.name,
          amount,
          currency,
          note: transaction.note ?? undefined,
          reference: transaction.reference,
          userId: admin.id,
        })
        .catch((err) => this.logger.warn(`Email collection admin non envoyé : ${err?.message}`));
    }

    // Notification aux agents de l'agence concernée
    const agents = await this.prisma.user.findMany({
      where: { agencyId: agency.id, role: 'AGENT', deletedAt: null, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    for (const agent of agents) {
      const agentName = `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim() || 'Agent';
      this.treasuryNotifier
        .notifyCollectionToAgent(agent.id, amountLabel, adminName, agency.name)
        .catch(() => {});
      if (agent.email) {
        this.treasuryMail
          .sendCollectionToAgent({
            email: agent.email,
            agentName,
            adminName,
            agencyName: agency.name,
            amount,
            currency,
            note: transaction.note ?? undefined,
            reference: transaction.reference,
            userId: agent.id,
          })
          .catch((err) => this.logger.warn(`Email collection agent non envoyé : ${err?.message}`));
      }
    }
  }
}