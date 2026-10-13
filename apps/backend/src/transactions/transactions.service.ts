// apps/backend/src/transactions/transactions.service.ts
// =========================================================
//  TRANSACTIONS SERVICE v4.27 — Direct Transf'air
// =========================================================
// ✅ v4.27 (phase 6) : ATOMICITÉ des mouvements d'argent. create(), deposit() et refillAgency() faisaient « débit »,
//    « crédit » puis « écriture de la transaction » en étapes séparées : une panne, une référence en doublon ou un
//    solde insuffisant au 2ᵉ pas laissait de l'argent débité sans trace ou crédité sans contrepartie. Chacune écrit
//    maintenant tout dans UNE transaction SQL (WalletsService.debitInTx / creditInTx) ; les lignes de ledger portent
//    le transactionId. create() re-contrôle en plus les plafonds sous le verrou du wallet (deux envois simultanés).
//    La commission plateforme d'un envoi direct fait partie de la transaction (avant : non bloquante, donc perdable).
// ✅ v4.26 (phase 6) : create() contrôle les plafonds d'envoi du client (par envoi / jour / mois / an selon son niveau
//    KYC et la devise, réglés par l'admin société — TransferLimitsService) AVANT tout débit. Refus : 403 LIMIT_EXCEEDED.
// ✅ v4.25 (phase 6) : le seuil de validation d'un envoi cash (500 000 codé en dur) est maintenant réglé
//    par l'admin de la société, par devise (ValidationThresholdsService). Sans réglage : 500 000, comme avant.
// ✅ v4.24 (phase 6) : INTÉGRITÉ FINANCIÈRE — annulations, B2B, références
//    (1) 🚨 cancel() : l'annulation créditait le wallet AVANT de changer le statut, sans verrou :
//        deux clics (ou un clic + l'agent qui paie le code au même moment) remboursaient deux fois.
//        Désormais le statut est « réservé » (updateMany avec condition sur le statut) et le
//        remboursement est écrit dans la MÊME transaction SQL (WalletsService.creditInTx).
//    (2) 🚨 cancel() acceptait n'importe quel type d'opération de l'expéditeur : une recharge
//        Orange Money en attente (créditée nulle part) ou une déclaration B2B pouvaient être
//        « annulées » et rembourser un montant jamais débité. Seuls TRANSFER et SCHEDULED
//        (expéditeur débité à la création) sont remboursables.
//    (3) Remboursement au bon wallet : la caisse de l'agence si l'envoi a été fait par un agent
//        (Transaction.agencyId + wallet de la devise), sinon le wallet du client. Avant, la caisse
//        de l'agence était remboursée sur le wallet personnel de l'agent.
//    (4) adminUpdateStatusForAdmin() : même correctif (statut réservé + remboursement atomique, type
//        contrôlé) ; un changement de statut simple est lui aussi conditionné à l'ancien statut.
//    (5) validateBankTransfer() : le crédit et le passage à PAID sont atomiques (double clic = un
//        seul crédit) ; refus si le Super Admin n'a pas de société (le wallet aurait été cherché
//        avec clientId = null, c'est-à-dire n'importe quel wallet sans société).
//    (6) rejectBankTransfer() : contrôle du type SERVICE_PAYMENT (comme validate) ; le remboursement
//        va au wallet de la SOCIÉTÉ (celui qui a été débité à la déclaration) et non au wallet
//        personnel de l'admin, que l'écran ne montre plus depuis wallets v5.3 ; atomique.
//    (7) Références : codes de retrait tirés avec crypto.randomInt (et non Math.random), vérifiés
//        uniques AVANT le débit ; suffixe aléatoire sur les références horodatées (BILL-, DEP-,
//        REFILL-) pour que deux opérations dans la même milliseconde ne se heurtent plus à la
//        contrainte d'unicité après le mouvement d'argent.
// ✅ v4.23 : (1) deposit() refuse un destinataire qui n'est pas un client wallet (rôle USER) ou qui est suspendu.
//    (2) La devise de réception d'un pays vient de fee-schedule/country-currency.ts (même table que le barème) :
//    « Guinée-Bissau », « Allemagne », « Italie », « Pays-Bas »… n'étaient pas reconnus par leur nom.
//    (3) deposit() crédite depuis la caisse par défaut de l'agence (et non la première trouvée, sans ordre).
// ✅ v4.22 : (1) Transaction.agencyId renseigné à la création des mouvements qui touchent la caisse
//    d'une agence (recharge, dépôt client par un agent, envoi par un agent) et inclus dans les listes
//    (relation `agency`) ; la vue agent des recharges filtre sur agencyId (providerRef en repli).
//    (2) Les frais d'un envoi viennent de FeeScheduleService.quote() : barème de la société par
//    montant / pays / mode, frais fixe converti dans la devise de l'envoi, puis tarif plat du mode
//    (comportement antérieur), puis 1,5 %.
//    ⚠️ Migration requise : 20261012120000_add_transaction_agency_and_fee_rules
//
// ✅ v4.21 : 🔎 2 points mineurs vérifiés suite à l'audit du système
//    de commissions (voir commissions.service.ts v5.0) — 1 confirmé
//    et corrigé, 1 confirmé SANS IMPACT sur le flux réellement
//    utilisé, corrigé quand même par prudence.
//
//   POINT 1 — CONFIRMÉ : deposit() ne renseignait jamais `type`
//     Transaction.type retombait donc sur le défaut Prisma (TRANSFER)
//     pour tous les Dépôts Client, alors que TransactionType.DEPOSIT
//     existe dans l'enum depuis le début. Aucune requête actuelle ne
//     filtre encore sur ce champ (la page Commissions v6.0 utilise
//     LedgerEntry, pas Transaction.type), donc pas de bug visible
//     aujourd'hui — mais un futur filtre "vraie transaction vs dépôt"
//     par type serait resté impossible à écrire correctement.
//     CORRECTIF : type: TransactionType.DEPOSIT ajouté dans deposit().
//
//   POINT 2 — VÉRIFIÉ, PAS D'IMPACT SUR send-cash.tsx : hypothèse
//     initiale — une transaction CASH_PICKUP dont le beneficiaryId
//     résout directement un User (cas "utilisateur plateforme non
//     enregistré", PROBLÈME 1 du fix v4.19) passerait en PAID
//     immédiatement, avec des frais débités du sender mais jamais
//     crédités nulle part (aucun code à retirer ⇒ agentProcessPayment()
//     ne s'exécute jamais pour cette transaction).
//     Vérification faite sur send-cash.tsx (guichet agent — seul flux
//     CASH_PICKUP fourni à ce jour) : ce fichier appelle TOUJOURS
//     api.createBeneficiary() avant createTransaction(), donc
//     dto.beneficiaryId y est TOUJOURS un vrai Beneficiary.id, jamais
//     un User.id brut. directRecipientUser ne peut donc jamais se
//     déclencher depuis cet écran, et recipientUser reste toujours
//     null pour CASH_PICKUP via ce flux (la condition qui résout
//     recipientUser par téléphone n'est atteinte que si
//     isWalletTransfer === true, faux ici) ⇒ status ne peut être que
//     VALIDATED/PENDING, jamais PAID à la création. Le risque décrit
//     dans le fix v4.19 (send.tsx, non fourni) reste théoriquement
//     ouvert pour CE fichier-là si jamais il permet la combinaison
//     "bénéficiaire détecté sur la plateforme" + payoutMethod non-WALLET
//     — à vérifier séparément si besoin.
//     CORRECTIF DÉFENSIF ajouté quand même dans create() : si jamais
//     une transaction se retrouve PAID dès la création (recipientUser
//     résolu, par N'IMPORTE QUELLE voie actuelle ou future) ET que des
//     frais ont été calculés, ces frais sont crédités en commission
//     plateforme (wallet clientId) au lieu de rester débités du sender
//     sans jamais être crédités nulle part. Aucun impact sur le
//     comportement existant pour les flux qui produisent déjà fees:0
//     dans ce cas (WALLET/MOBILE_MONEY) — le if ne se déclenche que si
//     fees > 0. Traçable dans la nouvelle page Commissions (v6.0) car
//     tagué "Commission…" comme les crédits de agentProcessPayment().
//
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
//     existe dans le schéma — mais create() ne l'a jamais lu ni
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
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
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
import { FeeScheduleService } from '../fee-schedule/fee-schedule.service';
import { toIso2 }         from '../fee-schedule/countries';
import { currencyOfCountry } from '../fee-schedule/country-currency';
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
import { ValidationThresholdsService } from '../validation-thresholds/validation-thresholds.service';
import { TransferLimitsService } from '../transfer-limits/transfer-limits.service';

// ── Constantes ────────────────────────────────────────────

const TERMINAL_TX: TransactionStatus[] = [
  TransactionStatus.PAID,
  TransactionStatus.CANCELLED,
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
];

/** Statuts depuis lesquels une opération peut encore être annulée (aucun argent n'a quitté le circuit). */
const CANCELLABLE_TX: TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.VALIDATED,
  TransactionStatus.PROCESSING,
];

/** Types dont l'expéditeur a été débité de `total` à la création : seuls ceux-là se remboursent. */
const REFUNDABLE_TYPES: TransactionType[] = [TransactionType.TRANSFER, TransactionType.SCHEDULED];

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
  // ✅ v4.23 — pays reconnu (code ou nom) : table unique du barème. Corrige « Guinée-Bissau » (lu comme Guinée → GNF),
  // « Allemagne », « Italie », « Pays-Bas »… (retombaient sur XOF). Le reste garde l'ancien repli ci-dessous.
  const known = currencyOfCountry(raw);
  if (known) return CurrencyCode[known];
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
    private readonly feeSchedule:          FeeScheduleService,
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
    private readonly thresholds:           ValidationThresholdsService,
    private readonly transferLimits:       TransferLimitsService,
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

        const reference = this.stampedReference('BILL');

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

    // ✅ v4.24 — sans société, getOrCreateWallet({ clientId: null }) trouverait n'importe quel wallet sans société.
    if (!superAdmin.clientId) {
      throw new ConflictException(
        "Le Super Admin n'est rattaché à aucune société : impossible de créditer le wallet de réception.",
      );
    }

    const walletRef = await this.walletsService.getOrCreateWallet({
      clientId: superAdmin.clientId,
      currency: tx.currency,
    });

    // ✅ v4.24 — statut réservé + crédit dans la MÊME transaction SQL : un double clic ne crédite qu'une fois.
    const result = await this.prisma.$transaction(async (prismaTx) => {
      const claimed = await prismaTx.transaction.updateMany({
        where: { id: transactionId, type: TransactionType.SERVICE_PAYMENT, status: TransactionStatus.PENDING },
        data: {
          status:         TransactionStatus.PAID,
          paidAt:         new Date(),
          providerStatus: ProviderStatus.SUCCESS,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Transaction déjà traitée');

      await this.walletsService.creditInTx(
        prismaTx,
        walletRef.id,
        Number(tx.amount),
        `Validation B2B ${transactionId}`,
        transactionId,
      );

      return prismaTx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
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
    if (!tx || tx.type !== TransactionType.SERVICE_PAYMENT || tx.status !== TransactionStatus.PENDING) {
      throw new ConflictException('Impossible à rejeter');
    }

    // ✅ v4.24 — la déclaration B2B a débité le wallet de la SOCIÉTÉ (clientId) : c'est lui qu'on rembourse.
    const walletRef = await this.walletsService.getOrCreateWallet({
      clientId: tx.clientId,
      currency: tx.currency,
    });

    const result = await this.prisma.$transaction(async (prismaTx) => {
      const claimed = await prismaTx.transaction.updateMany({
        where: { id: transactionId, type: TransactionType.SERVICE_PAYMENT, status: TransactionStatus.PENDING },
        data: {
          status:         TransactionStatus.CANCELLED,
          cancelledAt:    new Date(),
          providerStatus: ProviderStatus.FAILED,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Impossible à rejeter');

      await this.walletsService.creditInTx(
        prismaTx,
        walletRef.id,
        Number(tx.amount),
        `Remboursement B2B rejeté`,
        transactionId,
      );

      return prismaTx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
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
    // ✅ v4.24 — seuls les envois (TRANSFER / SCHEDULED) ont débité l'expéditeur : le reste n'est pas remboursable.
    if (!REFUNDABLE_TYPES.includes(tx.type) || !CANCELLABLE_TX.includes(tx.status)) {
      throw new ConflictException('Cette opération ne peut pas être annulée.');
    }

    return this.cancelWithRefund(tx);
  }

  // ========================================================
  // Annulation + remboursement ATOMIQUES (v4.24)
  //   1. le statut est « réservé » par un updateMany conditionné à l'ancien statut :
  //      si un autre appel (double clic, agent qui paie le code) est passé avant, count = 0 ;
  //   2. le remboursement est écrit dans la même transaction SQL.
  // ========================================================

  private async cancelWithRefund(tx: Transaction): Promise<Transaction> {
    const refund = await this.refundTargetFor(tx);

    return this.prisma.$transaction(async (prismaTx) => {
      const claimed = await prismaTx.transaction.updateMany({
        where: { id: tx.id, status: { in: CANCELLABLE_TX } },
        data: {
          status:         TransactionStatus.CANCELLED,
          cancelledAt:    new Date(),
          providerStatus: ProviderStatus.CANCELLED,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Transaction déjà traitée ou annulée.');
      }

      if (refund) {
        await this.walletsService.creditInTx(
          prismaTx,
          refund.walletId,
          refund.amount,
          `${refund.label} ${tx.reference}`,
          tx.id,
        );
      }

      await prismaTx.withdrawal.updateMany({
        where: { transactionId: tx.id },
        data:  { status: WithdrawalStatus.CANCELLED },
      });

      return prismaTx.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    });
  }

  /**
   * Où et combien rembourser pour annuler `tx`, ou null s'il n'y a rien à rembourser.
   *   - TRANSFER / SCHEDULED : `total` sur le wallet qui a été débité à la création (caisse de l'agence
   *     si l'envoi vient d'un agent, sinon wallet du client) ;
   *   - SERVICE_PAYMENT (B2B) : `amount` sur le wallet de la société (celui de la déclaration) ;
   *   - tout le reste (recharge en attente, mouvements de caisse…) : rien n'a été débité.
   */
  private async refundTargetFor(
    tx: Pick<Transaction, 'type' | 'senderId' | 'agencyId' | 'clientId' | 'currency' | 'total' | 'amount'>,
  ): Promise<{ walletId: string; amount: number; label: string } | null> {
    if (REFUNDABLE_TYPES.includes(tx.type)) {
      if (tx.agencyId) {
        const agencyWallet = await this.prisma.wallet.findFirst({
          where: { agencyId: tx.agencyId, currency: tx.currency, isActive: true },
          select: { id: true },
        });
        if (agencyWallet) {
          return { walletId: agencyWallet.id, amount: Number(tx.total), label: 'Remboursement annulation' };
        }
      }
      const userWallet = await this.walletsService.getOrCreateWallet({ userId: tx.senderId, currency: tx.currency });
      return { walletId: userWallet.id, amount: Number(tx.total), label: 'Remboursement annulation' };
    }

    if (tx.type === TransactionType.SERVICE_PAYMENT) {
      const companyWallet = await this.walletsService.getOrCreateWallet({ clientId: tx.clientId, currency: tx.currency });
      return { walletId: companyWallet.id, amount: Number(tx.amount), label: 'Remboursement annulation B2B' };
    }

    return null;
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

    // ✅ v4.22 — les frais viennent maintenant du barème de la société (FeeScheduleService) :
    //   mode gratuit → 0 ; sinon règle de barème la plus spécifique (montant, pays d'envoi et de
    //   réception, mode) ; sinon tarif plat du mode de retrait (ancien comportement v4.16-B, isActive
    //   volontairement ignoré) ; sinon 1,5 %. Le frais fixe d'une règle est converti dans la devise
    //   de l'envoi. Voir fee-schedule/fee-schedule.service.ts.
    const amount = new Prisma.Decimal(dto.amount);

    // v4.26 — plafonds du client (sans effet pour un agent : l'expéditeur de passage n'a pas de niveau KYC).
    await this.transferLimits.assertWithinLimits(this.prisma, { clientId, userId: senderId, currency, amount: Number(amount) });

    const feeQuote = await this.feeSchedule.quote({
      clientId,
      senderId,
      payoutMethod:   isWalletTransfer ? 'WALLET' : (dto.payoutMethod ?? PayoutMethod.CASH_PICKUP),
      amount:         Number(amount),
      currency,
      receiveCountry: toIso2(beneficiary?.country ?? directRecipientUser?.country ?? null),
    });
    const fees   = new Prisma.Decimal(feeQuote.fees);
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

    const transactionRef = await this.uniqueReference();
    let status: TransactionStatus = TransactionStatus.PENDING;
    let paidAt: Date | null = null;
    let storedRef: string | null = transactionRef;

    if (recipientUser) {
      status = TransactionStatus.PAID;
      paidAt = new Date();
    } else {
      // Seuil réglé par l'admin de la société pour cette devise (500 000 tant qu'il n'a rien réglé).
      const threshold = new Prisma.Decimal(await this.thresholds.thresholdFor(clientId, currency));
      status = amount.lte(threshold) ? TransactionStatus.VALIDATED : TransactionStatus.PENDING;
      if (dto.senderFirstName) {
        storedRef = `${transactionRef}|${dto.senderFirstName} ${dto.senderLastName ?? ''}`;
      }
    }

    // ✅ v4.27 (phase 6) — ATOMICITÉ. Les wallets annexes sont retrouvés/créés AVANT la transaction SQL
    // (création idempotente) ; ensuite la ligne Transaction, le débit de l'expéditeur, le crédit du
    // destinataire, la commission plateforme et le contrôle des plafonds sont écrits dans UNE SEULE
    // transaction SQL : si une étape échoue (solde, plafond, référence en doublon, coupure), rien n'a bougé.
    const recipientWalletRef = recipientUser
      ? await this.walletsService.getOrCreateWallet({ userId: recipientUser.id, currency: targetCurrency })
      : null;

    // ✅ v4.21 — filet de sécurité commission plateforme : un envoi PAID dès sa création (destinataire wallet
    // résolu) avec des frais > 0 n'aura jamais de paiement en agence pour distribuer ces frais ; ils sont
    // donc crédités à la société ici. (Avant v4.27 : hors transaction et non bloquant, d'où des frais
    // débités de l'expéditeur mais crédités nulle part si ce crédit échouait.)
    const feeWalletRef = recipientUser && Number(fees) > 0
      ? await this.walletsService.getOrCreateWallet({ clientId, currency })
      : null;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
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
          agencyId:       user.agencyId ?? null, // ✅ v4.22 — agence de l'agent qui encaisse
          providerRef:    storedRef,
          providerStatus: recipientUser ? ProviderStatus.SUCCESS : ProviderStatus.PENDING,
          paidAt,
          // ✅ v4.19 — FIX (PROBLÈME 4) : motif du transfert enfin persisté.
          note:           (dto as any).note ?? null,
        },
      });

      // ✅ FIX v4.16-A : débit sur walletToDebit (wallet agence si agent). Le débit prend le verrou du wallet :
      // deux envois simultanés du même client sont donc traités l'un après l'autre.
      await this.walletsService.debitInTx(tx, walletToDebit.id, Number(total), `Envoi ${transactionRef}`, created.id);

      // v4.27 — plafonds re-contrôlés SOUS le verrou du wallet (le contrôle d'avant le calcul des frais ne
      // protège pas de deux envois simultanés). Cet envoi lui-même est exclu du cumul.
      await this.transferLimits.assertWithinLimits(tx, {
        clientId, userId: senderId, currency, amount: Number(amount), excludeTransactionId: created.id,
      });

      if (recipientUser && recipientWalletRef) {
        await this.walletsService.creditInTx(
          tx,
          recipientWalletRef.id,
          convertedAmount,
          `Réception de ${user.firstName} ${user.lastName}`,
          created.id,
        );
      }

      if (feeWalletRef) {
        await this.walletsService.creditInTx(
          tx,
          feeWalletRef.id,
          Number(fees),
          `Commission plateforme (envoi direct ${transactionRef})`,
          created.id,
        );
      }

      return created;
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
    // v4.23 — la caisse par défaut (comme la remise et l'aperçu d'envoi), plus « la première trouvée » :
    // sans orderBy, une agence à deux devises créditait le client dans une devise au hasard.
    const agencyWallet = agencyWallets.find((w) => w.isDefault) ?? agencyWallets[0];
    if (!agencyWallet) throw new ForbiddenException('Wallet agence introuvable');

    const amountDec = new Prisma.Decimal(dto.amount);
    const available = Number(agencyWallet.balance) - Number(agencyWallet.reservedBalance);
    if (available < Number(amountDec)) throw new ForbiddenException('Solde agence insuffisant');

    // ✅ FIX v4.17 — recherche tolérante au format (mêmes règles que
    // findByPhoneInTenant, utilisé par le lookup live côté frontend).
    // Avant : phone: { contains: cleanPhone } sur la chaîne complète,
    // qui échouait si le format stocké différait du format envoyé.
    const clientUser = await this.findClientByPhoneTolerant(dto.userPhone ?? '', agent.clientId);
    // ✅ v4.23 — un dépôt ne crédite qu'un client wallet (rôle USER) : jamais un administrateur ou un agent
    // dont le numéro serait saisi, ni un compte suspendu.
    if (!clientUser || clientUser.role !== 'USER') throw new NotFoundException(`Client introuvable : ${dto.userPhone}`);
    if (clientUser.isSuspended) throw new ForbiddenException('Ce compte client est suspendu : dépôt impossible.');

    const currency        = agencyWallet.currency as CurrencyCode;
    const clientWalletRef = await this.walletsService.getOrCreateWallet({ userId: clientUser.id, currency });
    const depositRef      = await this.uniqueReference(); // ✅ v4.24 : choisie AVANT de bouger l'argent

    // ✅ v4.27 — transaction + débit de la caisse + crédit du client : une seule transaction SQL.
    const depositClientId = agent.clientId;
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          reference:      depositRef,
          // ✅ v4.21 — FIX (POINT 1, voir changelog en tête de fichier) :
          // sans ce champ, la transaction retombait sur le défaut Prisma
          // TransactionType.TRANSFER, indiscernable d'un vrai transfert
          // client dans toute future requête filtrant par type.
          type:           TransactionType.DEPOSIT,
          amount:         amountDec,
          fees:           new Prisma.Decimal(0),
          total:          amountDec,
          currency,
          status:         TransactionStatus.PAID,
          payoutMethod:   PayoutMethod.WALLET,
          paymentMethod:  PaymentMethod.CASH,
          senderId:       agent.id,
          recipientId:    clientUser.id,
          clientId:       depositClientId,
          agencyId:       agent.agencyId, // ✅ v4.22 — caisse mouvementée
          paidAt:         new Date(),
          providerStatus: ProviderStatus.SUCCESS,
          providerRef:    this.stampedReference('DEP'),
        },
      });

      await this.walletsService.debitInTx(tx, agencyWallet.id, Number(amountDec), `Dépôt → ${clientUser.phone}`, created.id);
      await this.walletsService.creditInTx(tx, clientWalletRef.id, Number(amountDec), `Dépôt agent`, created.id);
      return created;
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

    const txRef = this.stampedReference('REFILL');

    // ✅ v4.27 — transaction + débit de la société + crédit de la caisse : une seule transaction SQL.
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
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
          agencyId,                        // ✅ v4.22 — plus besoin de relire providerRef
          paidAt:         new Date(),
          providerStatus: ProviderStatus.SUCCESS,
          providerRef:    `${txRef}|AGENCY:${agencyId}`,
        },
      });

      await this.walletsService.debitInTx(tx, adminWallet.id, amount, `Recharge agence ${agency.name} (${agencyId})`, created.id);
      await this.walletsService.creditInTx(tx, agencyWalletRef.id, amount, `Recharge admin → ${agency.name}`, created.id);
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
        // ✅ v4.22 — agencyId d'abord ; providerRef conservé pour d'éventuelles lignes non rattrapées.
        orClauses.push({
          type: TransactionType.AGENCY_REFILL,
          OR:   [{ agencyId: user.agencyId }, { providerRef: { contains: user.agencyId } }],
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
        agency:      { select: { id: true, name: true, city: true } }, // ✅ v4.22
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
        agency:      { select: { id: true, name: true, city: true } }, // ✅ v4.22
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
        include: { sender: true, beneficiary: true, client: true, withdrawal: true, agency: { select: { id: true, name: true, city: true } } }, // ✅ v4.22
      });
    } else if (admin?.clientId) {
      transactions = await this.prisma.transaction.findMany({
        where:   { clientId: admin.clientId, deletedAt: null }, // ✅ v4.20
        orderBy: { createdAt: 'desc' },
        include: { sender: true, beneficiary: true, client: true, withdrawal: true, agency: { select: { id: true, name: true, city: true } } }, // ✅ v4.22
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
      // ✅ v4.24 — statut réservé + remboursement atomique, type contrôlé (voir cancelWithRefund).
      return this.cancelWithRefund(tx);
    }

    const data: Prisma.TransactionUpdateManyMutationInput =
      dto.status === TransactionStatus.PAID
        ? { status: TransactionStatus.PAID, paidAt: new Date(), providerStatus: ProviderStatus.SUCCESS }
        : { status: dto.status };

    // ✅ v4.24 — conditionné à l'ancien statut : deux admins (ou un admin et un agent) ne s'écrasent plus.
    const updated = await this.prisma.transaction.updateMany({
      where: { id, status: tx.status },
      data,
    });
    if (updated.count !== 1) {
      throw new ConflictException('Cette transaction vient d\'être modifiée : rechargez la page.');
    }
    return this.prisma.transaction.findUniqueOrThrow({ where: { id } });
  }

  /** Code à 9 chiffres (aussi code de retrait en agence) — CSPRNG, pas Math.random(). */
  private generateReference(): string {
    return crypto.randomInt(100_000_000, 1_000_000_000).toString();
  }

  /**
   * Référence libre : vérifiée AVANT tout mouvement d'argent. Reference et providerRef sont uniques :
   * une collision après le débit ferait perdre l'argent (débit sans Transaction).
   */
  private async uniqueReference(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const ref = this.generateReference();
      const clash = await this.prisma.transaction.findFirst({
        where: {
          OR: [{ reference: ref }, { providerRef: ref }, { providerRef: { startsWith: `${ref}|` } }],
        },
        select: { id: true },
      });
      if (!clash) return ref;
    }
    throw new ServiceUnavailableException('Impossible de générer une référence unique, réessayez.');
  }

  /** `PREFIX-<horodatage>-<6 hex>` : deux opérations dans la même milliseconde ne se heurtent plus. */
  private stampedReference(prefix: string): string {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  }
}