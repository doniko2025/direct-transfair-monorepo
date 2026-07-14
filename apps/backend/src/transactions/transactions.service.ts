// apps/backend/src/transactions/transactions.service.ts
// =========================================================
//  TRANSACTIONS SERVICE v4.20 — Direct Transf'air
// =========================================================
// ✅ v4.12 : FIX ForbiddenException dans $transaction → 500
// ✅ v4.13-A : FIX acquireAdvisoryLock int32 signé (| 0)
// ✅ v4.13-B : FIX P2002 référence en doublon → 409
// ✅ v4.13-C : Notifications in-app + emails sur tous les flux
// ✅ v4.14 : FUSION complète en un seul fichier
// ✅ v4.15 : FIX CRITIQUE acquireAdvisoryLock → ::int4 dans SQL
// ✅ v4.16 : 2 FIX dans create() (wallet agence + fee config)
// ✅ v4.17 : FIX recherche client dans deposit()
//
//   PROBLÈME RÉSOLU (v4.17) :
//   deposit() cherchait le client via
//     phone: { contains: cleanPhone }
//   où cleanPhone est le numéro complet envoyé par le frontend. Si le
//   format stocké en base diffère (avec/sans indicatif, avec/sans 0
//   initial — ex. stocké "0766736226" mais reçu "33766736226"), la
//   chaîne complète ne matche jamais, même si c'est le même numéro.
//
//   Pendant ce temps, UsersService.findByPhoneInTenant() (utilisé par
//   le lookup live GET /users/by-phone) utilise une stratégie plus
//   tolérante : contains sur les 7 derniers chiffres + vérification de
//   suffixe en JS. Résultat possible avant ce fix : le badge "CLIENT
//   TROUVÉ ✓" s'affiche correctement pendant la saisie, mais la
//   validation du dépôt échoue quand même avec "Client introuvable".
//
//   CORRECTIF : deposit() utilise maintenant exactement la même
//   stratégie de correspondance (suffixe sur 7 chiffres) que
//   findByPhoneInTenant(), pour un comportement cohérent entre le
//   lookup et la validation réelle.
//
// ✅ v4.18 : 🚨 FIX SÉCURITÉ CRITIQUE — collision de téléphone
//
//   PROBLÈME RÉSOLU (v4.18) :
//   Le v4.17 unifiait deposit() avec la stratégie de suffixe de
//   findByPhoneInTenant() — mais cette stratégie est elle-même
//   dangereuse : si deux comptes stockent LE MÊME numéro réel sous
//   deux formats différents ("+33766736226" et "0033766736226" —
//   confusion entre préfixe international "+" et "00"), l'un est un
//   suffixe strict de l'autre et LES DEUX comptes matchent la même
//   recherche. Incident réel : un dépôt agent de 50 000 € destiné à
//   un client a été crédité par erreur sur le wallet d'un compte
//   admin partageant le même numéro sous un format différent.
//
//   CORRECTIF : findClientByPhoneTolerant() normalise maintenant le
//   numéro reçu via normalizePhoneE164() (source unique — voir
//   common/utils/phone.util.ts) puis fait une correspondance EXACTE
//   sur le champ `phone` (colonne @unique, normalisée à l'écriture —
//   voir UsersService.create/update et AuthService.register). Un
//   numéro normalisé ne peut plus correspondre qu'à un seul compte,
//   ou à aucun.
//
// ✅ v4.19 : 🚨 4 correctifs regroupés dans create(), tous découverts en
//     confrontant ce fichier au schema.prisma complet et à send.tsx v2.10+
//
//   PROBLÈME 1 — beneficiaryId d'un User plateforme non enregistré rejeté
//     send.tsx v2.10 (mobile) détecte un utilisateur Direct Transf'air
//     déjà inscrit mais PAS encore enregistré comme contact (via
//     GET /users/by-phone). Son User.id est injecté tel quel dans
//     detectedBeneficiary.id, et envoyé comme dto.beneficiaryId. Ce
//     create() cherchait STRICTEMENT dans la table Beneficiary → un
//     User.id ne matche (quasiment) jamais un Beneficiary.id →
//     NotFoundException systématique. Impossible d'envoyer de l'argent
//     à un utilisateur détecté-mais-pas-enregistré, alors que c'est
//     précisément le cas d'usage que la fonctionnalité v2.10 devait
//     couvrir.
//     CORRECTIF : si aucun Beneficiary ne matche, on tente un User
//     direct (même clientId, actif, non supprimé) avant de rejeter.
//
//   PROBLÈME 2 — 🚨 Beneficiary non cloisonné (userId/clientId)
//     const beneficiary = await this.prisma.beneficiary.findFirst({
//       where: { id: dto.beneficiaryId },
//     });
//     Aucune vérification que ce Beneficiary appartient bien à
//     l'expéditeur, ni même à son tenant. N'importe quel beneficiaryId
//     valide — y compris celui d'un AUTRE utilisateur, potentiellement
//     d'une AUTRE société cliente — était accepté tel quel, exposant
//     nom/téléphone/pays d'un tiers et pouvant fausser la devise cible
//     ou l'association de la transaction.
//     CORRECTIF : la recherche est maintenant scopée à
//     { id, userId: senderId, clientId } — un beneficiaryId ne peut
//     plus matcher que les contacts appartenant à l'expéditeur, dans
//     son propre tenant.
//
//   PROBLÈME 3 — Beneficiary.expectedCurrency jamais utilisé
//     Le schéma a un champ dédié Beneficiary.expectedCurrency
//     (CurrencyCode explicite), jamais lu ici — la devise cible était
//     TOUJOURS redérivée depuis .country via un texte-matching moins
//     fiable (getCurrencyFromCountryOrText), même quand une valeur
//     explicite et fiable existait déjà en base.
//     CORRECTIF : priorité à expectedCurrency s'il est renseigné ;
//     .country reste le repli si absent, puis la devise du destinataire
//     direct (User.primaryCurrency, cf. PROBLÈME 1), puis en tout
//     dernier recours celle de l'expéditeur.
//
//   PROBLÈME 4 — Motif du transfert jamais persisté
//     send.tsx envoie note: motif dans le payload, et Transaction.note
//     existe bien dans le schéma — mais create() ne l'a jamais lu ni
//     écrit. Le motif choisi par l'utilisateur disparaissait purement
//     et simplement après l'envoi (le reçu immédiat l'affiche encore,
//     mais depuis l'état local du frontend, pas depuis la DB — donc
//     invisible dans l'historique/le détail de transaction ensuite).
//     CORRECTIF : note: dto.note ?? null ajouté à la création.
//     ✅ RÉSOLU en v4.20 : create-transaction.dto.ts confirmait
//     l'absence du champ note — DTO corrigé en v1.1 (voir ce fichier).
//     Les deux bouts (service + DTO) sont maintenant alignés.
//
// ✅ v4.20 : 🚨 FIX (préventif) — transactions "soft-deleted" auraient
//     été invisibles nulle part sauf dans la liste elle-même
//
//   CONTEXTE :
//   Transaction.deletedAt a été ajouté au schéma (v5.1), à l'origine
//   pour qu'AgenciesService.remove() puisse suppression-douce les
//   transactions d'une agence supprimée. Le design d'agencies.service.ts
//   a depuis été révisé (v4.5) : supprimer une agence désactive
//   désormais l'agence et ses agents SANS jamais toucher Transaction —
//   ce champ n'est donc plus renseigné par ce flux précis. Il reste
//   dans le schéma comme infrastructure générale pour un futur besoin.
//   Le filtrage ci-dessous reste en place par précaution — inoffensif
//   tant que le champ vaut toujours null, et évite le piège suivant
//   pour quiconque l'utiliserait un jour : ajouter un champ deletedAt
//   sans filtrer sa lecture ferait qu'une ligne "supprimée" continue
//   d'apparaître partout, ce qui est pire qu'une absence de soft-delete
//   (l'utilisateur croit la donnée fiable alors qu'elle est censée
//   être masquée).
//   CORRECTIF : buildUserTransactionFilter() (utilisé par
//   findForUser()/findOneForUser(), tous rôles) et
//   adminFindAllForAdmin() filtrent deletedAt: null.
//   ⚠️ Périmètre volontairement limité aux vues LISTE/DÉTAIL — les
//   méthodes qui font un findUnique() par id précis pour une MUTATION
//   ciblée (cancel, adminUpdateStatusForAdmin, declareBankTransfer,
//   validateBankTransfer, rejectBankTransfer) n'ont pas reçu de garde
//   deletedAt supplémentaire, jugé superflu tant que rien n'écrit ce
//   champ dans le code actuel.
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CurrencyCode,
  Prisma,
  ProviderStatus,
  Transaction,
  TransactionStatus,
  PayoutMethod,
  PaymentMethod,
  WithdrawalStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService }  from '../prisma/prisma.service';
import { RatesService }   from '../rates/rates.service';
import { WalletsService } from '../wallets/wallets.service';
import { normalizePhoneE164 } from '../common/utils/phone.util';
import {
  CreateTransactionDto,
  CreateDepositDto,
} from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ── Mail channels ─────────────────────────────────────────
import { WalletMailService }  from '../mail/channels/wallet-mail.service';
import { AgentMailService }   from '../mail/channels/agent-mail.service';
import { CompanyMailService } from '../mail/channels/company-mail.service';
import { AdminMailService }   from '../mail/channels/admin-mail.service';
import { PushService }        from '../push/push.service';
import { SmsService }         from '../sms/sms.service';

// ── Notifiers in-app ──────────────────────────────────────
import { NotificationsService }   from '../notifications/notifications.service';
import { WalletNotifierService }  from '../notifications/channels/wallet-notifier.service';
import { AgentNotifierService }   from '../notifications/channels/agent-notifier.service';
import { CompanyNotifierService } from '../notifications/channels/company-notifier.service';
import { AdminNotifierService }   from '../notifications/channels/admin-notifier.service';

// ── Constantes ────────────────────────────────────────────

const TERMINAL_TX: TransactionStatus[] = [
  TransactionStatus.PAID,
  TransactionStatus.CANCELLED,
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
];

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF,
  BF: CurrencyCode.XOF, BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF,
  NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, BE: CurrencyCode.EUR,
  PT: CurrencyCode.EUR, ES: CurrencyCode.EUR,
  GB: CurrencyCode.GBP,
  US: CurrencyCode.USD,
};

function getCurrencyFromCountryOrText(raw?: string | null): CurrencyCode {
  if (!raw) return CurrencyCode.XOF;
  const upper = raw.toUpperCase().trim();
  if (COUNTRY_TO_CURRENCY[upper]) return COUNTRY_TO_CURRENCY[upper];
  if (upper.includes('GUIN')) return CurrencyCode.GNF;
  if (['SENEGAL', 'MALI', 'BENIN', 'TOGO', "COTE D'IVOIRE"].some(c => upper.includes(c))) return CurrencyCode.XOF;
  if (upper.includes('FRANC') || upper === 'FR') return CurrencyCode.EUR;
  if (upper.includes('UK') || upper === 'GB') return CurrencyCode.GBP;
  if (upper.includes('USA') || upper === 'US') return CurrencyCode.USD;
  return CurrencyCode.XOF;
}

function assertTxTransition(from: TransactionStatus, to: TransactionStatus) {
  if (from === to) return;
  if (TERMINAL_TX.includes(from)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
  const allowed: Partial<Record<TransactionStatus, TransactionStatus[]>> = {
    PENDING:    [TransactionStatus.VALIDATED, TransactionStatus.CANCELLED, TransactionStatus.FAILED],
    VALIDATED:  [TransactionStatus.PAID,      TransactionStatus.CANCELLED, TransactionStatus.FAILED],
    PROCESSING: [TransactionStatus.PAID,      TransactionStatus.CANCELLED, TransactionStatus.FAILED],
  };
  if (!allowed[from]?.includes(to)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
}

const TX_ERROR = {
  WALLET_NOT_FOUND:            'TX_ERR_WALLET_NOT_FOUND',
  INSUFFICIENT_BALANCE_PREFIX: 'TX_ERR_INSUFFICIENT_BALANCE:',
} as const;

// ── Service ───────────────────────────────────────────────

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma:               PrismaService,
    private readonly ratesService:         RatesService,
    private readonly walletsService:       WalletsService,
    private readonly push:                 PushService,
    private readonly sms:                  SmsService,
    private readonly walletMail:           WalletMailService,
    private readonly agentMail:            AgentMailService,
    private readonly companyMail:          CompanyMailService,
    private readonly adminMail:            AdminMailService,
    private readonly notificationsService: NotificationsService,
    private readonly walletNotifier:       WalletNotifierService,
    private readonly agentNotifier:        AgentNotifierService,
    private readonly companyNotifier:      CompanyNotifierService,
    private readonly adminNotifier:        AdminNotifierService,
  ) {}

  // ── Enrichissement ────────────────────────────────────

  private enrichTransaction(tx: any): any {
    if (!tx) return tx;
    const cloned: any = { ...tx, sender: tx.sender ? { ...tx.sender } : tx.sender };
    const ref = cloned.providerRef;
    if (cloned.type === 'AGENCY_REFILL') return cloned;
    if (ref && typeof ref === 'string' && ref.includes('|')) {
      const parts = ref.split('|');
      if (parts.length >= 2) {
        cloned.sender = {
          ...cloned.sender,
          firstName: parts[1],
          lastName:  '(Client)',
          agency:    cloned.sender?.agency,
        };
        cloned.providerRef = parts[0];
      }
    }
    return cloned;
  }

  // ── Recherche client par téléphone — ✅ v4.18 SÉCURITÉ CRITIQUE ──
  //
  // 🚨 BUG CORRIGÉ (juillet 2026) : la v4.17 introduisait volontairement
  // la MÊME logique de suffixe que findByPhoneInTenant() pour unifier
  // le comportement du lookup live et de la validation. Sauf que cette
  // logique de suffixe est elle-même dangereuse : deux comptes dont les
  // numéros stockés sont l'un le suffixe de l'autre (typiquement
  // "0033766736226" vs "+33766736226"/"33766736226", confusion 00/+)
  // matchent TOUS LES DEUX la même recherche. Résultat vécu en prod :
  // un dépôt agent de 50 000 EUR destiné à un client (Alpha DIALLO,
  // wallet à 0) a été crédité sur le wallet d'un compte ADMIN
  // (Thierno DIALLO) qui partageait "le même" numéro sous un format
  // différent. Aucune erreur, aucun avertissement — juste le mauvais
  // compte crédité.
  //
  // CORRECTIF DÉFINITIF : on normalise le numéro reçu avec
  // normalizePhoneE164() (source unique — voir
  // common/utils/phone.util.ts) et on fait une correspondance EXACTE
  // sur le champ `phone`, qui est @unique en base et normalisé à
  // l'écriture (voir UsersService.create/update, AuthService.register).
  // Un numéro normalisé ne peut matcher qu'UN SEUL compte, ou aucun.
  //
  // (Le nom de la méthode reste "Tolerant" — elle tolère toujours les
  // différents FORMATS de saisie en entrée grâce à normalizePhoneE164,
  // ce qui a changé c'est qu'elle ne tolère plus l'AMBIGUÏTÉ.)
  // ──────────────────────────────────────────────────────────────
  private async findClientByPhoneTolerant(
    rawPhone: string,
    clientId: number,
  ) {
    const normalized = normalizePhoneE164(rawPhone);
    if (!normalized) return null;

    return this.prisma.user.findFirst({
      where: {
        clientId,
        isActive: true,
        deletedAt: null,
        phone: normalized, // ✅ correspondance EXACTE, plus de contains/suffix
      },
      include: { wallets: { where: { isActive: true } } },
    });
  }

  // ── Advisory lock key ─────────────────────────────────

  private walletLockKey(id: string): bigint {
    let hash = 0n;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31n + BigInt(id.charCodeAt(i))) & 0x7FFFFFFFFFFFFFFFn;
    }
    return hash;
  }

  // ── Advisory lock ─────────────────────────────────────
  // ✅ FIX v4.15 : ::int4 dans le SQL
  private async acquireAdvisoryLock(
    prismaTx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<void> {
    const lockKey  = this.walletLockKey(walletId);
    const lockHigh = (Number((lockKey >> 32n) & 0xFFFFFFFFn)) | 0;
    const lockLow  = (Number(lockKey & 0xFFFFFFFFn)) | 0;
    await prismaTx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock($1::int4, $2::int4)',
      lockHigh,
      lockLow,
    );
  }

  // ========================================================
  // B2B — Déclaration virement société → SuperAdmin
  // ========================================================

  async declareBankTransfer(
    adminId: string,
    amount: number,
    proofReference: string,
    currency: string = 'XOF',
  ) {
    const currencyCode = currency.toUpperCase() as CurrencyCode;

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || !admin.clientId) throw new ForbiddenException('Admin société introuvable');

    const walletRef = await this.walletsService.getOrCreateWallet({
      clientId: admin.clientId,
      currency: currencyCode,
    });

    const preCheckWallet = await this.prisma.wallet.findUnique({
      where: { id: walletRef.id },
    });

    if (!preCheckWallet) throw new NotFoundException('Wallet société introuvable');

    const preAvailable =
      Number(preCheckWallet.balance) - Number(preCheckWallet.reservedBalance ?? 0);

    if (preAvailable < amount) {
      throw new ForbiddenException(
        `Solde ${currencyCode} insuffisant. ` +
        `Disponible : ${preAvailable.toLocaleString('fr-FR')} ${currencyCode}. ` +
        `Alimentez d'abord votre compte via Trésorerie > Alimenter en ${currencyCode}.`,
      );
    }

    let newTx: Transaction;
    try {
      newTx = await this.prisma.$transaction(async (prismaTx) => {
        await this.acquireAdvisoryLock(prismaTx, walletRef.id);

        const wallet = await prismaTx.wallet.findUnique({ where: { id: walletRef.id } });
        if (!wallet) throw new Error(TX_ERROR.WALLET_NOT_FOUND);

        const available =
          Number(wallet.balance) - Number(wallet.reservedBalance ?? 0);

        if (available < amount) {
          throw new Error(
            `${TX_ERROR.INSUFFICIENT_BALANCE_PREFIX}${available}:${currencyCode}`,
          );
        }

        const reference = `BILL-${Date.now()}`;

        const created = await prismaTx.transaction.create({
          data: {
            reference,
            type:          TransactionType.SERVICE_PAYMENT,
            amount:        new Prisma.Decimal(amount),
            fees:          new Prisma.Decimal(0),
            total:         new Prisma.Decimal(amount),
            currency:      currencyCode,
            status:        TransactionStatus.PENDING,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            payoutMethod:  PayoutMethod.WALLET,
            senderId:      adminId,
            clientId:      admin.clientId!,
            providerRef:   proofReference,
          },
        });

        const updatedWallet = await prismaTx.wallet.update({
          where: { id: walletRef.id },
          data:  { balance: { decrement: new Prisma.Decimal(amount) } },
        });

        await prismaTx.ledgerEntry.create({
          data: {
            walletId:      walletRef.id,
            type:          'DEBIT',
            amount:        new Prisma.Decimal(amount),
            currency:      currencyCode,
            description:   `Virement B2B ${proofReference}`,
            transactionId: created.id,
            balanceAfter:  updatedWallet.balance,
          },
        });

        return created;
      });

    } catch (e: any) {
      const msg: string = e?.message ?? '';

      if (msg === TX_ERROR.WALLET_NOT_FOUND) {
        throw new NotFoundException('Wallet société introuvable');
      }
      if (msg.startsWith(TX_ERROR.INSUFFICIENT_BALANCE_PREFIX)) {
        const parts = msg.replace(TX_ERROR.INSUFFICIENT_BALANCE_PREFIX, '').split(':');
        const avail = Number(parts[0]);
        const cur   = parts[1] ?? currencyCode;
        throw new ForbiddenException(
          `Solde insuffisant (concurrence détectée). ` +
          `Disponible : ${avail.toLocaleString('fr-FR')} ${cur}.`,
        );
      }
      if (e?.code === 'P2002' || msg.toLowerCase().includes('unique constraint')) {
        throw new ConflictException(
          `La référence "${proofReference}" est déjà utilisée. ` +
          `Veuillez saisir une référence bancaire différente.`,
        );
      }
      throw e;
    }

    if (admin.email) {
      this.companyMail.sendB2BRequestSent({
        email:       admin.email,
        companyName: `${admin.firstName} ${admin.lastName}`,
        amount,
        currency:    currencyCode,
        ref:         proofReference,
      }).catch((err) => {
        this.logger.warn(`Email B2B declare non envoyé : ${err?.message}`);
      });
    }

    this.companyNotifier.notifyB2BTransferSent(
      adminId,
      `${amount.toLocaleString('fr-FR')} ${currencyCode}`,
    ).catch(() => {});

    this.prisma.user.findFirst({
      where:  { role: 'SUPER_ADMIN' },
      select: { id: true },
    }).then((superAdmin) => {
      if (superAdmin) {
        this.adminNotifier.notifyNewB2BRequest(
          superAdmin.id,
          `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim(),
          `${amount.toLocaleString('fr-FR')} ${currencyCode}`,
          newTx.id,
        ).catch(() => {});
      }
    }).catch(() => {});

    return newTx;
  }

  // ========================================================
  // B2B — Validation par Super Admin
  // ========================================================

  async validateBankTransfer(superAdminId: string, transactionId: string) {
    const superAdmin = await this.prisma.user.findUnique({ where: { id: superAdminId } });
    if (superAdmin?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Seul le Super Admin peut valider.');

    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.type !== TransactionType.SERVICE_PAYMENT) throw new NotFoundException('Facture introuvable');
    if (tx.status !== TransactionStatus.PENDING) throw new ConflictException('Transaction déjà traitée');

    const walletRef = await this.walletsService.getOrCreateWallet({
      clientId: superAdmin.clientId!,
      currency: tx.currency,
    });
    await this.walletsService.credit(
      walletRef.id,
      Number(tx.amount),
      `Validation B2B ${transactionId}`,
      transactionId,
    );

    const result = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status:         TransactionStatus.PAID,
        paidAt:         new Date(),
        providerStatus: ProviderStatus.SUCCESS,
      },
    });

    this.prisma.user.findUnique({ where: { id: tx.senderId } })
      .then((sender) => {
        if (sender?.email) {
          this.companyMail.sendB2BValidated({
            email:       sender.email,
            companyName: `${sender.firstName} ${sender.lastName}`,
            amount:      Number(tx.amount),
            currency:    tx.currency,
            ref:         tx.providerRef ?? transactionId,
          }).catch((err) => {
            this.logger.warn(`Email B2B validé non envoyé : ${err?.message}`);
          });
        }
      })
      .catch(() => {});

    this.push.notifyTransferReceived(
      tx.senderId, 'Plateforme', `${tx.amount}`, tx.currency,
    ).catch(() => {});

    this.companyNotifier.notifyB2BTransferValidated(
      tx.senderId,
      `${Number(tx.amount).toLocaleString('fr-FR')} ${tx.currency}`,
    ).catch(() => {});

    return result;
  }

  // ========================================================
  // B2B — Rejet par Super Admin
  // ========================================================

  async rejectBankTransfer(superAdminId: string, transactionId: string) {
    const superAdmin = await this.prisma.user.findUnique({ where: { id: superAdminId } });
    if (superAdmin?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Accès refusé');

    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.status !== TransactionStatus.PENDING) throw new ConflictException('Impossible à rejeter');

    const walletRef = await this.walletsService.getOrCreateWallet({
      userId:   tx.senderId,
      currency: tx.currency,
    });
    await this.walletsService.credit(
      walletRef.id,
      Number(tx.amount),
      `Remboursement B2B rejeté`,
      transactionId,
    );

    const result = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status:         TransactionStatus.CANCELLED,
        cancelledAt:    new Date(),
        providerStatus: ProviderStatus.FAILED,
      },
    });

    this.push.notifyTransferReceived(
      tx.senderId, 'Plateforme', `${tx.amount}`, tx.currency,
    ).catch(() => {});

    this.companyNotifier.notifyB2BRejected(
      tx.senderId,
      `${Number(tx.amount).toLocaleString('fr-FR')} ${tx.currency}`,
    ).catch(() => {});

    this.prisma.user.findUnique({ where: { id: tx.senderId } })
      .then((sender) => {
        if (sender?.email) {
          this.companyMail.sendB2BRejected({
            email:       sender.email,
            companyName: `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim(),
            amount:      Number(tx.amount),
            currency:    tx.currency,
            ref:         tx.providerRef ?? transactionId,
            userId:      sender.id,
          }).catch((err) => {
            this.logger.warn(`Email B2B rejeté non envoyé : ${err?.message}`);
          });
        }
      })
      .catch(() => {});

    return result;
  }

  // ========================================================
  // Annulation client
  // ========================================================

  async cancel(userId: string, transactionId: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { sender: true },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');
    if (tx.senderId !== userId) throw new ForbiddenException('Vous ne pouvez annuler que vos propres transactions');
    if (tx.status === TransactionStatus.PAID) throw new ConflictException("Impossible : le client a déjà retiré l'argent");
    if (tx.status === TransactionStatus.CANCELLED) throw new ConflictException('Déjà annulée');

    const walletRef = await this.walletsService.getOrCreateWallet({ userId, currency: tx.currency });
    await this.walletsService.credit(walletRef.id, Number(tx.total), `Remboursement annulation ${tx.reference}`, transactionId);

    return this.prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.transaction.update({
        where: { id: transactionId },
        data:  {
          status:         TransactionStatus.CANCELLED,
          cancelledAt:    new Date(),
          providerStatus: ProviderStatus.CANCELLED,
        },
      });
      await prismaTx.withdrawal.updateMany({
        where: { transactionId },
        data:  { status: WithdrawalStatus.CANCELLED },
      });
      return updated;
    });
  }

  // ========================================================
  // Création transfert (client / agent → bénéficiaire)
  // ========================================================

  async create(senderId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.prisma.user.findUnique({
      where:   { id: senderId },
      include: { wallets: { where: { isActive: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.clientId) throw new ForbiddenException('User must belong to a client');

    const clientId = user.clientId;

    // ✅ v4.19 — FIX (PROBLÈME 2, sécurité) : le Beneficiary est
    // maintenant cherché scopé au sender ET à son tenant, plus par id
    // brut seul. Voir changelog en tête de fichier.
    const beneficiary = dto.beneficiaryId
      ? await this.prisma.beneficiary.findFirst({
          where: { id: dto.beneficiaryId, userId: senderId, clientId },
        })
      : null;

    // ✅ v4.19 — FIX (PROBLÈME 1) : dto.beneficiaryId peut être un
    // User.id direct (détection "utilisateur plateforme non enregistré"
    // de send.tsx v2.10). Si aucun Beneficiary scopé ne matche, on
    // tente un User (même client, actif, non supprimé) avant de rejeter.
    let directRecipientUser: any = null;
    if (dto.beneficiaryId && !beneficiary) {
      directRecipientUser = await this.prisma.user.findFirst({
        where: {
          id: dto.beneficiaryId,
          clientId,
          isActive: true,
          deletedAt: null,
        },
        include: { wallets: { where: { isActive: true } } },
      });
      if (!directRecipientUser) throw new NotFoundException('Beneficiary not found');
    }

    const currency = dto.currency.toUpperCase() as CurrencyCode;

    // ✅ FIX v4.16-A : pour les agents, priorité au wallet AGENCE
    //
    // PROBLÈME : un agent a un wallet personnel XOF créé automatiquement
    // (balance = 0). La recherche user.wallets.find() le trouve en premier
    // → disponible = 0 → ForbiddenException "Solde insuffisant".
    // Son vrai solde est dans le wallet agence (agencyId).
    //
    // CORRECTIF : si user.agencyId est défini → on cherche le wallet
    // agence en priorité et on l'utilise pour le débit.
    let walletToDebit = user.wallets.find((w) => w.currency === currency) ?? null;

    if (user.agencyId) {
      // Agent → cherche le wallet agence (ignore le wallet personnel à 0)
      const agencyWallet = await this.prisma.wallet.findFirst({
        where: { agencyId: user.agencyId, currency, isActive: true },
      });
      if (agencyWallet) {
        walletToDebit = agencyWallet;
      }
    }

    if (!walletToDebit) {
      throw new ForbiddenException(
        `Vous n'avez pas de wallet ${currency}. Créez-en un d'abord.`,
      );
    }

    const isWalletTransfer =
      dto.payoutMethod === PayoutMethod.MOBILE_MONEY ||
      dto.payoutMethod === PayoutMethod.WALLET;

    // ✅ FIX v4.16-B : taux dynamique — isActive retiré du filtre
    //
    // AVANT : findFirst({ isActive: true }) → jamais trouvé car
    // upsertFeeConfig() ne persistait pas isActive=true → fallback 1,5%.
    // APRÈS : filtre sans isActive → trouve la config admin correctement.
    let feeRatePct  = 0;
    let fixedFeeAmt = 0;

    if (!isWalletTransfer) {
      try {
        const feeConfig = await this.prisma.commissionConfig.findFirst({
          where: {
            clientId,
            payoutMethod: dto.payoutMethod ?? 'CASH_PICKUP',
            // ✅ isActive retiré — robuste même si isActive=false en DB
          },
        });
        if (feeConfig) {
          feeRatePct  = (feeConfig as any).feeRate  ?? 1.5;
          fixedFeeAmt = (feeConfig as any).fixedFee ?? 0;
        } else {
          feeRatePct = 1.5; // fallback si l'admin n'a pas encore configuré
        }
      } catch {
        feeRatePct = 1.5; // fallback si la migration n'est pas encore appliquée
      }
    }

    const amount = new Prisma.Decimal(dto.amount);
    const fees   = amount
      .mul(new Prisma.Decimal(feeRatePct / 100))
      .plus(new Prisma.Decimal(fixedFeeAmt));
    const total  = amount.plus(fees);

    // ✅ FIX v4.16-A : vérification solde sur walletToDebit (agence ou personnel)
    const available =
      Number(walletToDebit.balance) - Number((walletToDebit as any).reservedBalance ?? 0);

    if (available < Number(total)) {
      throw new ForbiddenException(
        `Solde ${currency} insuffisant. Disponible : ${available}`,
      );
    }

    // ✅ v4.19 — priorité au destinataire déjà résolu directement
    // (User.id connu avec certitude) ; sinon, stratégie phone existante.
    let recipientUser: any = directRecipientUser ?? null;
    if (!recipientUser && isWalletTransfer && beneficiary?.phone) {
      // ✅ v4.17 — même stratégie tolérante que findByPhoneInTenant()
      recipientUser = await this.findClientByPhoneTolerant(beneficiary.phone, clientId);
    }

    // ✅ v4.19 — FIX (PROBLÈME 3) : priorité à Beneficiary.expectedCurrency
    // (champ dédié du schéma, jamais lu jusqu'ici) sur la déduction
    // texte-vers-devise depuis .country, qui reste le repli si absent.
    // Puis la devise du destinataire direct (User.primaryCurrency, cf.
    // PROBLÈME 1), puis en tout dernier recours celle de l'expéditeur.
    const targetCurrency: CurrencyCode =
      beneficiary?.expectedCurrency
      ?? (beneficiary?.country ? getCurrencyFromCountryOrText(beneficiary.country) : null)
      ?? (directRecipientUser?.primaryCurrency as CurrencyCode | undefined)
      ?? currency;

    const convertedAmount = await this.ratesService.convert(Number(amount), currency, targetCurrency);
    const receivedAmount  = new Prisma.Decimal(convertedAmount);
    const exchangeRate    = Number(amount) > 0 ? convertedAmount / Number(amount) : 1;

    const transactionRef = this.generateReference();
    let status: TransactionStatus = TransactionStatus.PENDING;
    let paidAt: Date | null = null;
    let storedRef: string | null = transactionRef;

    if (recipientUser) {
      status = TransactionStatus.PAID;
      paidAt = new Date();
    } else {
      const threshold = new Prisma.Decimal(500000);
      status = amount.lte(threshold) ? TransactionStatus.VALIDATED : TransactionStatus.PENDING;
      if (dto.senderFirstName) {
        storedRef = `${transactionRef}|${dto.senderFirstName} ${dto.senderLastName ?? ''}`;
      }
    }

    // ✅ FIX v4.16-A : débit sur walletToDebit (wallet agence si agent)
    await this.walletsService.debit(walletToDebit.id, Number(total), `Envoi ${transactionRef}`);

    if (recipientUser) {
      const recipientWalletRef = await this.walletsService.getOrCreateWallet({
        userId:   recipientUser.id,
        currency: targetCurrency,
      });
      await this.walletsService.credit(
        recipientWalletRef.id,
        convertedAmount,
        `Réception de ${user.firstName} ${user.lastName}`,
      );
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        reference:      transactionRef,
        amount, fees, total,
        currency,
        targetCurrency,
        receivedAmount,
        exchangeRate,
        payoutMethod:   dto.payoutMethod ?? PayoutMethod.CASH_PICKUP,
        status,
        senderId,
        beneficiaryId:  beneficiary?.id ?? null,
        recipientId:    recipientUser?.id ?? null,
        clientId,
        providerRef:    storedRef,
        providerStatus: recipientUser ? ProviderStatus.SUCCESS : ProviderStatus.PENDING,
        paidAt,
        // ✅ v4.19 — FIX (PROBLÈME 4) : motif du transfert enfin persisté.
        // Transaction.note existe dans le schéma ; dto.note n'était
        // jamais lu ni écrit ici auparavant.
        note:           (dto as any).note ?? null,
      },
    });

    // ✅ v4.19 — nom du destinataire direct en repli si pas de Beneficiary
    const earlyRecipientLabel = beneficiary?.fullName
      ?? (recipientUser ? `${recipientUser.firstName ?? ''} ${recipientUser.lastName ?? ''}`.trim() : 'Bénéficiaire');

    await this.push.notifyTransferSent(senderId, earlyRecipientLabel, `${amount}`, currency);
    if (recipientUser?.id) {
      await this.push.notifyTransferReceived(
        recipientUser.id,
        `${user.firstName} ${user.lastName}`,
        `${receivedAmount}`,
        targetCurrency,
      );
    }

    const recipientDisplayName = beneficiary?.fullName ??
      (recipientUser
        ? `${recipientUser.firstName ?? ''} ${recipientUser.lastName ?? ''}`.trim()
        : 'Bénéficiaire');

    this.walletNotifier.notifyTransferSent(
      senderId,
      recipientDisplayName,
      `${Number(amount).toLocaleString('fr-FR')} ${currency}`,
    ).catch(() => {});

    if (recipientUser?.id) {
      this.walletNotifier.notifyTransferReceived(
        recipientUser.id,
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        `${Number(receivedAmount).toLocaleString('fr-FR')} ${targetCurrency}`,
      ).catch(() => {});
    }

    if (user.email) {
      this.walletMail.sendTransferConfirmation({
        email:           user.email,
        senderFirstName: user.firstName ?? '',
        recipientName:   recipientDisplayName,
        amount:          Number(amount),
        currency,
        fees:            Number(fees),
        txRef:           transactionRef,
        pickupCode:      recipientUser ? undefined : transactionRef,
        userId:          senderId,
        transactionId:   transaction.id,
      }).catch((err) => {
        this.logger.warn(`Email transfert non envoyé : ${err?.message}`);
      });
    }

    if (recipientUser?.email) {
      this.walletMail.sendMoneyReceived({
        email:              recipientUser.email,
        recipientFirstName: recipientUser.firstName ?? '',
        senderName:         `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        amount:             Number(receivedAmount),
        currency:           targetCurrency,
        txRef:              transactionRef,
        userId:             recipientUser.id,
        transactionId:      transaction.id,
      }).catch((err) => {
        this.logger.warn(`Email réception non envoyé : ${err?.message}`);
      });
    }

    return transaction;
  }

  // ========================================================
  // Dépôt agent → client
  // ========================================================

  async deposit(agentId: string, dto: CreateDepositDto): Promise<Transaction> {
    const agent = await this.prisma.user.findUnique({
      where:   { id: agentId },
      include: { wallets: { where: { isActive: true } } },
    });

    if (!agent || !agent.agencyId) throw new ForbiddenException('Agent ou Agence invalide');
    if (!agent.clientId)           throw new ForbiddenException('Agence sans client associé');

    const agencyWallets = await this.prisma.wallet.findMany({
      where: { agencyId: agent.agencyId, isActive: true },
    });
    const agencyWallet = agencyWallets[0];
    if (!agencyWallet) throw new ForbiddenException('Wallet agence introuvable');

    const amountDec = new Prisma.Decimal(dto.amount);
    const available = Number(agencyWallet.balance) - Number(agencyWallet.reservedBalance);
    if (available < Number(amountDec)) throw new ForbiddenException('Solde agence insuffisant');

    // ✅ FIX v4.17 — recherche tolérante au format (mêmes règles que
    // findByPhoneInTenant, utilisé par le lookup live côté frontend).
    // Avant : phone: { contains: cleanPhone } sur la chaîne complète,
    // qui échouait si le format stocké différait du format envoyé.
    const clientUser = await this.findClientByPhoneTolerant(dto.userPhone ?? '', agent.clientId);
    if (!clientUser) throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);

    const currency        = agencyWallet.currency as CurrencyCode;
    const clientWalletRef = await this.walletsService.getOrCreateWallet({ userId: clientUser.id, currency });

    await this.walletsService.debit(agencyWallet.id, Number(amountDec), `Dépôt → ${clientUser.phone}`);
    await this.walletsService.credit(clientWalletRef.id, Number(amountDec), `Dépôt agent`);

    const result = await this.prisma.transaction.create({
      data: {
        reference:      this.generateReference(),
        amount:         amountDec,
        fees:           new Prisma.Decimal(0),
        total:          amountDec,
        currency,
        status:         TransactionStatus.PAID,
        payoutMethod:   PayoutMethod.WALLET,
        paymentMethod:  PaymentMethod.CASH,
        senderId:       agent.id,
        recipientId:    clientUser.id,
        clientId:       agent.clientId,
        paidAt:         new Date(),
        providerStatus: ProviderStatus.SUCCESS,
        providerRef:    `DEP-${Date.now()}`,
      },
    });

    await this.push.notifyTransferReceived(clientUser.id, 'Agence', `${dto.amount}`, currency);

    const updatedAgencyWallet = await this.prisma.wallet.findUnique({ where: { id: agencyWallet.id } });
    if (updatedAgencyWallet && Number(updatedAgencyWallet.balance) < 50000) {
      await this.push.notifyLowBalance(agentId, currency, `${updatedAgencyWallet.balance}`);
      this.agentNotifier.notifyLowBalance(agentId, Number(updatedAgencyWallet.balance)).catch(() => {});
    }

    this.walletNotifier.notifyDepositReceived(
      clientUser.id,
      `${Number(dto.amount).toLocaleString('fr-FR')} ${currency}`,
    ).catch(() => {});

    this.agentNotifier.notifyDepositProcessed(
      agentId,
      `${Number(dto.amount).toLocaleString('fr-FR')} ${currency}`,
      `${clientUser.firstName ?? ''} ${clientUser.lastName ?? ''}`.trim(),
    ).catch(() => {});

    if (clientUser.email) {
      this.walletMail.sendMoneyReceived({
        email:              clientUser.email,
        recipientFirstName: clientUser.firstName ?? '',
        senderName:         'Agence',
        amount:             Number(dto.amount),
        currency,
        txRef:              result.reference,
        userId:             clientUser.id,
        transactionId:      result.id,
      }).catch((err) => {
        this.logger.warn(`Email dépôt client non envoyé : ${err?.message}`);
      });
    }

    if (agent.email) {
      this.agentMail.sendDepositSummary({
        email:       agent.email,
        agentName:   `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim(),
        clientName:  `${clientUser.firstName ?? ''} ${clientUser.lastName ?? ''}`.trim(),
        amount:      Number(dto.amount),
        currency,
        newBalance:  Number(updatedAgencyWallet?.balance ?? agencyWallet.balance),
        userId:      agentId,
      }).catch((err) => {
        this.logger.warn(`Email dépôt agent non envoyé : ${err?.message}`);
      });
    }

    return result;
  }

  // ========================================================
  // Trésorerie Admin
  // ========================================================

  async adminFundSelf(user: AuthUserPayload, amount: number | string) {
    if (!user?.id) throw new BadRequestException('Utilisateur invalide');
    return this.fundAdminWallet(user.id, amount);
  }

  async fundAdminWallet(adminId: string, amount: number | string, currency: string = 'XOF') {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new BadRequestException('Montant invalide');
    const currencyCode = currency.toUpperCase() as CurrencyCode;
    const walletRef    = await this.walletsService.getOrCreateWallet({ userId: adminId, currency: currencyCode });
    return this.walletsService.credit(walletRef.id, amt, `Auto-alimentation admin`);
  }

  // ========================================================
  // Recharge agence
  // ========================================================

  async refillAgency(adminId: string, agencyId: string, amount: number, currency: string = 'XOF') {
    this.logger.debug(`refillAgency START | adminId=${adminId} agencyId=${agencyId} amount=${amount} currency=${currency}`);

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin)          throw new NotFoundException('Admin introuvable');
    if (!admin.clientId) throw new ForbiddenException('Admin sans société associée');

    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException(`Agence ${agencyId} introuvable`);

    if (admin.role !== 'SUPER_ADMIN' && agency.clientId !== admin.clientId) {
      throw new ForbiddenException('Cette agence ne vous appartient pas');
    }

    const currencyCode   = currency.toUpperCase() as CurrencyCode;
    const adminWalletRef = await this.walletsService.getOrCreateWallet({
      clientId: admin.clientId,
      currency: currencyCode,
    });

    const adminWallet = await this.prisma.wallet.findUnique({ where: { id: adminWalletRef.id } });
    if (!adminWallet) {
      throw new NotFoundException(`Wallet société (clientId=${admin.clientId}, ${currencyCode}) introuvable`);
    }

    const available = Number(adminWallet.balance) - Number(adminWallet.reservedBalance ?? 0);

    if (available < amount) {
      throw new ForbiddenException(
        `Solde ${currencyCode} insuffisant. ` +
        `Disponible : ${available.toLocaleString('fr-FR')} ${currencyCode} — ` +
        `Demandé : ${amount.toLocaleString('fr-FR')} ${currencyCode}. ` +
        `Rechargez d'abord votre compte via Trésorerie > Recharger.`,
      );
    }

    const agencyWalletRef = await this.walletsService.getOrCreateWallet({ agencyId, currency: currencyCode });

    await this.walletsService.debit(adminWallet.id, amount, `Recharge agence ${agency.name} (${agencyId})`);
    await this.walletsService.credit(agencyWalletRef.id, amount, `Recharge admin → ${agency.name}`);

    const txRef = `REFILL-${Date.now()}`;

    await this.prisma.transaction.create({
      data: {
        reference:      txRef,
        type:           TransactionType.AGENCY_REFILL,
        amount:         new Prisma.Decimal(amount),
        fees:           new Prisma.Decimal(0),
        total:          new Prisma.Decimal(amount),
        currency:       currencyCode,
        status:         TransactionStatus.PAID,
        payoutMethod:   PayoutMethod.BANK_DEPOSIT,
        paymentMethod:  PaymentMethod.WALLET,
        senderId:       adminId,
        clientId:       admin.clientId!,
        paidAt:         new Date(),
        providerStatus: ProviderStatus.SUCCESS,
        providerRef:    `${txRef}|AGENCY:${agencyId}`,
      },
    });

    const successResult = {
      status: 'SUCCESS', sent: amount, currency: currencyCode, agencyId, txRef,
      agencyWalletId: agencyWalletRef.id,
    };

    this.prisma.user.findMany({
      where:  { agencyId, role: 'AGENT' },
      select: { id: true, email: true, firstName: true, lastName: true },
    }).then(async (agents) => {
      const agencyWalletUpdated = await this.prisma.wallet.findUnique({
        where: { id: agencyWalletRef.id },
      }).catch(() => null);

      for (const agent of agents) {
        this.notificationsService.create(
          agent.id,
          'Rechargement reçu 🔋',
          `Votre agence a été rechargée de ${amount.toLocaleString('fr-FR')} ${currencyCode}.`,
          'SUCCESS',
        ).catch(() => {});

        if (agent.email) {
          this.agentMail.sendAgencyRefilled({
            email:      agent.email,
            agentName:  `${agent.firstName ?? ''} ${agent.lastName ?? ''}`.trim(),
            agencyName: agency.name,
            amount,
            currency:   currencyCode,
            newBalance: Number(agencyWalletUpdated?.balance ?? amount),
            userId:     agent.id,
          }).catch(() => {});
        }
      }
    }).catch(() => {});

    return successResult;
  }

  // ========================================================
  // Lecture
  // ========================================================

  private async buildUserTransactionFilter(userId: string): Promise<{
    where: Prisma.TransactionWhereInput;
    user: { id: string; role: string; clientId: number | null; agencyId: string | null };
  }> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, role: true, clientId: true, agencyId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // ✅ v4.20 — FIX : exclut les transactions soft-supprimées
    // (Transaction.deletedAt, voir changelog en tête de fichier) de
    // TOUTES les vues liste/détail, quel que soit le rôle.
    const notDeleted: Prisma.TransactionWhereInput = { deletedAt: null };

    if (user.role === 'SUPER_ADMIN') return { where: notDeleted, user };

    if (user.role === 'COMPANY_ADMIN') {
      return { where: { ...notDeleted, clientId: user.clientId ?? -1 }, user };
    }

    if (user.role === 'AGENT') {
      const processedWithdrawals = await this.prisma.withdrawal.findMany({
        where:  { processedById: userId },
        select: { transactionId: true },
      });
      const processedTxIds = processedWithdrawals
        .filter((w) => w.transactionId != null)
        .map((w)  => w.transactionId as string);

      const orClauses: Prisma.TransactionWhereInput[] = [
        { senderId:    userId },
        { recipientId: userId },
      ];

      if (user.agencyId) {
        orClauses.push({
          type:        TransactionType.AGENCY_REFILL,
          providerRef: { contains: user.agencyId },
        });
      }

      if (processedTxIds.length > 0) {
        orClauses.push({ id: { in: processedTxIds } });
      }

      return { where: { ...notDeleted, clientId: user.clientId ?? -1, OR: orClauses }, user };
    }

    return {
      where: {
        ...notDeleted,
        clientId: user.clientId ?? -1,
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      user,
    };
  }

  async findForUser(userId: string): Promise<any[]> {
    const { where } = await this.buildUserTransactionFilter(userId);
    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        withdrawal:  true,
        sender:      { select: { id: true, firstName: true, lastName: true, phone: true } },
        beneficiary: true,
      },
    });
    return transactions.map((t) => this.enrichTransaction(t));
  }

  async findOneForUser(id: string, userId: string): Promise<any> {
    const { where } = await this.buildUserTransactionFilter(userId);
    const tx = await this.prisma.transaction.findFirst({
      where: { ...where, id },
      include: {
        withdrawal:  true,
        sender:      { select: { id: true, firstName: true, lastName: true, phone: true } },
        beneficiary: true,
      },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.enrichTransaction(tx);
  }

  async adminFindAllForAdmin(adminId: string): Promise<any[]> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    let transactions: any[] = [];

    if (admin?.role === 'SUPER_ADMIN') {
      transactions = await this.prisma.transaction.findMany({
        where:   { deletedAt: null }, // ✅ v4.20
        orderBy: { createdAt: 'desc' },
        include: { sender: true, beneficiary: true, client: true, withdrawal: true },
      });
    } else if (admin?.clientId) {
      transactions = await this.prisma.transaction.findMany({
        where:   { clientId: admin.clientId, deletedAt: null }, // ✅ v4.20
        orderBy: { createdAt: 'desc' },
        include: { sender: true, beneficiary: true, client: true, withdrawal: true },
      });
    }

    return transactions.map((t) => this.enrichTransaction(t));
  }

  async adminUpdateStatusForAdmin(
    adminId: string,
    id: string,
    dto: UpdateTransactionStatusDto,
  ): Promise<Transaction> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new ForbiddenException('Utilisateur inconnu');

    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (admin.role !== 'SUPER_ADMIN' && tx.clientId !== admin.clientId) {
      throw new ForbiddenException('Accès refusé à cette transaction.');
    }

    assertTxTransition(tx.status, dto.status);

    if (dto.status === TransactionStatus.CANCELLED) {
      const walletRef = await this.walletsService.getOrCreateWallet({
        userId:   tx.senderId,
        currency: tx.currency,
      });
      await this.walletsService.credit(
        walletRef.id,
        Number(tx.total),
        `Remboursement annulation admin ${tx.reference}`,
        id,
      );

      return this.prisma.$transaction(async (prismaTx) => {
        const updated = await prismaTx.transaction.update({
          where: { id },
          data: {
            status:         TransactionStatus.CANCELLED,
            cancelledAt:    new Date(),
            providerStatus: ProviderStatus.CANCELLED,
          },
        });
        await prismaTx.withdrawal.updateMany({
          where: { transactionId: id },
          data:  { status: WithdrawalStatus.CANCELLED },
        }); 
        return updated;
      });
    }

    const data: Prisma.TransactionUpdateInput =
      dto.status === TransactionStatus.PAID
        ? { status: TransactionStatus.PAID, paidAt: new Date(), providerStatus: ProviderStatus.SUCCESS }
        : { status: dto.status };

    return this.prisma.transaction.update({ where: { id }, data });
  }

  private generateReference(): string {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
  }
}