// apps/backend/src/compliance/compliance.core.ts
// =========================================================
// CONFORMITÉ — fonctions « cœur » (lot 17), appelées par TransactionsService SANS changer ses dépendances
// (mêmes règles que growth.core.ts) :
//   • loadComplianceSettings : réglages de la société, avec valeurs par défaut ;
//   • screenTransaction      : filtre les noms (expéditeur, destinataire, bénéficiaire, client de passage) contre les listes
//                              de surveillance ; ouvre un dossier + une alerte, et bloque l'envoi seulement si la société l'a voulu ;
//   • openAmlCase            : ouvre un dossier pour un envoi signalé par le score AML (le signalement devient examinable) ;
//   • countNearThreshold / otherSendersToRecipient : contexte des règles AML étendues.
// Aucune de ces fonctions ne lève : un problème de conformité ne doit jamais faire échouer un envoi déjà enregistré.
// =========================================================

import { Logger } from '@nestjs/common';
import { AlertSeverity, Prisma, Role, TransactionStatus } from '@prisma/client';

import { normalizeCountry, type AmlSettingsLike } from './aml-rules';
import { findMatches, NameIndex, type NameMatch, type NameSubject } from './name-matching';
import { matchOfficial } from './official-index';

type Db = Prisma.TransactionClient;
const logger = new Logger('ComplianceCore');

export const CASE_KIND = { SANCTION: 'SANCTION_MATCH', AML: 'AML_RULE', MANUAL: 'MANUAL' } as const;
export const HELD_FROM = [TransactionStatus.PENDING, TransactionStatus.VALIDATED] as const;

export interface ComplianceSettingsView extends AmlSettingsLike {
  sanctionsEnabled: boolean;
  matchThreshold: number;
  strongMatchThreshold: number;
  holdOnStrongMatch: boolean;
  /** Listes officielles activées par la société : UN | OFAC | EU (lot 17b). */
  officialLists: string[];
  /** Une ligne est enregistrée pour cette société. Sinon ce sont les valeurs par défaut. */
  configured: boolean;
}

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettingsView = {
  sanctionsEnabled: true,
  matchThreshold: 88,
  strongMatchThreshold: 96,
  holdOnStrongMatch: false,
  officialLists: [],
  amlThresholdXof: null,
  amlFlagScore: null,
  highRiskCountries: [],
  structuringCount: 3,
  fanInSenders: 3,
  configured: false,
};

export async function loadComplianceSettings(db: Db, clientId: number): Promise<ComplianceSettingsView> {
  try {
    const row = await db.complianceSettings.findUnique({ where: { clientId } });
    if (!row) return { ...DEFAULT_COMPLIANCE_SETTINGS };
    return {
      sanctionsEnabled: row.sanctionsEnabled,
      matchThreshold: row.matchThreshold,
      strongMatchThreshold: Math.max(row.strongMatchThreshold, row.matchThreshold),
      holdOnStrongMatch: row.holdOnStrongMatch,
      officialLists: row.officialLists ?? [],
      amlThresholdXof: row.amlThresholdXof ?? null,
      amlFlagScore: row.amlFlagScore ?? null,
      highRiskCountries: row.highRiskCountries ?? [],
      structuringCount: row.structuringCount,
      fanInSenders: row.fanInSenders,
      configured: true,
    };
  } catch (err) {
    logger.warn(`Réglages de conformité illisibles (société ${clientId}) : ${(err as Error).message}`);
    return { ...DEFAULT_COMPLIANCE_SETTINGS };
  }
}

export function severityForScore(score: number, strong: number): AlertSeverity {
  if (score >= strong) return AlertSeverity.CRITICAL;
  if (score >= 92) return AlertSeverity.HIGH;
  return AlertSeverity.MEDIUM;
}

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';

export async function notifyAdmins(db: Db, clientId: number, title: string, message: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    const admins = await db.user.findMany({ where: { clientId, role: Role.COMPANY_ADMIN, isActive: true, deletedAt: null }, select: { id: true } });
    await Promise.all(admins.map((a) => db.notification.create({
      data: { userId: a.id, title, message, type: 'WARNING', metadata: metadata as Prisma.InputJsonValue },
    }).catch(() => undefined)));
  } catch (err) {
    logger.warn(`Administrateurs non prévenus : ${(err as Error).message}`);
  }
}

const personName = (p?: { firstName?: string | null; lastName?: string | null } | null): string => `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

export interface ScreenOutcome {
  matches: number;
  caseId: string | null;
  held: boolean;
}

/** Filtre un envoi contre les listes de surveillance de sa société. Ne lève jamais. */
export async function screenTransaction(db: Db, transactionId: string): Promise<ScreenOutcome> {
  const none: ScreenOutcome = { matches: 0, caseId: null, held: false };
  try {
    const tx = await db.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true, reference: true, clientId: true, amount: true, currency: true, status: true, senderId: true, isFlagged: true, riskScore: true,
        sender:          { select: { firstName: true, lastName: true } },
        recipient:       { select: { firstName: true, lastName: true } },
        beneficiary:     { select: { fullName: true } },
        counterCustomer: { select: { firstName: true, lastName: true } },
      },
    });
    if (!tx) return none;

    const settings = await loadComplianceSettings(db, tx.clientId);
    if (!settings.sanctionsEnabled) return none;
    const entries = await db.watchlistEntry.findMany({ where: { clientId: tx.clientId, isActive: true } });
    if (!entries.length && !settings.officialLists.length) return none;

    const subjects: NameSubject[] = [
      { role: 'SENDER', name: personName(tx.sender) },
      { role: 'RECIPIENT', name: personName(tx.recipient) },
      { role: 'BENEFICIARY', name: tx.beneficiary?.fullName ?? '' },
      { role: 'COUNTER_CUSTOMER', name: personName(tx.counterCustomer) },
    ].filter((s) => s.name);
    const matches = [
      ...findMatches(subjects, entries, settings.matchThreshold),
      ...(await matchOfficial(db, settings.officialLists, subjects, settings.matchThreshold)),
    ].sort((a, b) => b.score - a.score);
    if (!matches.length) return none;

    const best = matches[0] as NameMatch;
    const severity = severityForScore(best.score, settings.strongMatchThreshold);
    const strong = best.score >= settings.strongMatchThreshold;
    const canHold = settings.holdOnStrongMatch && strong && (HELD_FROM as readonly TransactionStatus[]).includes(tx.status);

    let heldFrom: TransactionStatus | null = null;
    if (canHold) {
      const held = await db.transaction.updateMany({
        where: { id: tx.id, status: tx.status },
        data: { status: TransactionStatus.ON_HOLD, isFlagged: true, riskScore: Math.max(tx.riskScore, 90) },
      });
      if (held.count === 1) heldFrom = tx.status;
    }
    if (!heldFrom) {
      await db.transaction.update({ where: { id: tx.id }, data: { isFlagged: true, riskScore: Math.max(tx.riskScore, 90) } }).catch(() => undefined);
    }

    const who = `${personName(tx.sender) || 'Expéditeur'} → ${tx.beneficiary?.fullName ?? (personName(tx.recipient) || personName(tx.counterCustomer) || 'bénéficiaire')}`;
    const reason = `Correspondance avec ${best.source ? `la liste officielle ${best.source}` : 'une liste de surveillance'} : « ${best.subjectName} » ≈ « ${best.entryName} » (${best.score} %) — ${who}`;
    let caseId: string | null = null;
    try {
      const created = await db.complianceCase.create({
        data: {
          userId: tx.senderId, transactionId: tx.id, clientId: tx.clientId,
          reason, kind: CASE_KIND.SANCTION, severity, dedupeKey: `SANCTION:${tx.id}`,
          details: {
            matches: matches.slice(0, 10), held: !!heldFrom, heldFrom, reference: tx.reference,
            amount: Number(tx.amount), currency: String(tx.currency),
            thresholds: { match: settings.matchThreshold, strong: settings.strongMatchThreshold },
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      caseId = created.id;
    } catch (e) {
      if (isUniqueViolation(e)) return { matches: matches.length, caseId: null, held: !!heldFrom }; // déjà traité
      throw e;
    }

    await db.alert.create({
      data: {
        clientId: tx.clientId, userId: tx.senderId, type: 'SANCTION_MATCH', severity,
        title: heldFrom ? 'Envoi bloqué : liste de surveillance' : 'Correspondance avec une liste de surveillance',
        message: `${tx.reference} — ${reason}`,
        metadata: { caseId, transactionId: tx.id, score: best.score, held: !!heldFrom } as Prisma.InputJsonValue,
      },
    }).catch((e: Error) => logger.warn(`Alerte non créée : ${e.message}`));

    await notifyAdmins(db, tx.clientId,
      heldFrom ? '🚫 Envoi bloqué par la conformité' : '⚠️ Correspondance de surveillance',
      `${tx.reference} : ${best.subjectName} ≈ ${best.entryName} (${best.score} %).${heldFrom ? ' L’envoi est en attente de votre décision.' : ''}`,
      { kind: 'SANCTION_MATCH', caseId, transactionId: tx.id },
    );
    logger.warn(`🚩 Liste de surveillance — ${tx.reference} : ${best.subjectName} ≈ ${best.entryName} (${best.score} %)${heldFrom ? ' — BLOQUÉ' : ''}`);
    return { matches: matches.length, caseId, held: !!heldFrom };
  } catch (err) {
    logger.error(`Filtrage impossible (transaction ${transactionId}) : ${(err as Error).message}`);
    return none;
  }
}

// ─── Contrôle AVANT débit (audit argent I2) ──────────────
export const PRESEND_BLOCK_MESSAGE =
  "Cette opération ne peut pas être traitée pour le moment. Aucun montant n'a été débité. Contactez le service client si besoin.";

export interface PreSendOutcome { blocked: boolean; caseId: string | null }

/**
 * Un envoi vers un portefeuille est crédité tout de suite : il est PAID dès sa création, donc le filtrage « après coup »
 * ne peut plus le retenir. Quand la société a choisi de bloquer sur correspondance forte (holdOnStrongMatch), on filtre
 * donc les noms AVANT tout débit : refus neutre (le client n'apprend pas qu'il est sur une liste), aucun mouvement d'argent,
 * dossier de conformité + alerte pour l'équipe. Sans ce choix, rien ne change : le filtrage a posteriori signale seulement.
 * Ne lève jamais : une panne du filtrage ne doit pas paralyser les envois (elle est journalisée).
 */
export async function preScreenSend(
  db: Db,
  p: {
    clientId: number; senderId: string; amount: number; currency: string;
    sender?: { firstName?: string | null; lastName?: string | null } | null;
    recipient?: { firstName?: string | null; lastName?: string | null } | null;
    beneficiaryName?: string | null;
  },
): Promise<PreSendOutcome> {
  const ok: PreSendOutcome = { blocked: false, caseId: null };
  try {
    const settings = await loadComplianceSettings(db, p.clientId);
    if (!settings.sanctionsEnabled || !settings.holdOnStrongMatch) return ok;
    const entries = await db.watchlistEntry.findMany({ where: { clientId: p.clientId, isActive: true } });
    if (!entries.length && !settings.officialLists.length) return ok;

    const subjects: NameSubject[] = [
      { role: 'SENDER', name: personName(p.sender) },
      { role: 'RECIPIENT', name: personName(p.recipient) },
      { role: 'BENEFICIARY', name: p.beneficiaryName ?? '' },
    ].filter((x) => x.name);
    const matches = [
      ...findMatches(subjects, entries, settings.matchThreshold),
      ...(await matchOfficial(db, settings.officialLists, subjects, settings.matchThreshold)),
    ].sort((a, b) => b.score - a.score);
    const best = matches[0] as NameMatch | undefined;
    if (!best || best.score < settings.strongMatchThreshold) return ok;

    const severity = severityForScore(best.score, settings.strongMatchThreshold);
    const reason = `Envoi refusé avant débit — correspondance avec ${best.source ? `la liste officielle ${best.source}` : 'une liste de surveillance'} : « ${best.subjectName} » ≈ « ${best.entryName} » (${best.score} %)`;
    // Un dossier par expéditeur, correspondance et jour : un client qui réessaie dix fois ne noie pas l'équipe.
    const day = new Date().toISOString().slice(0, 10);
    let caseId: string | null = null;
    try {
      const created = await db.complianceCase.create({
        data: {
          userId: p.senderId, clientId: p.clientId, reason, kind: CASE_KIND.SANCTION, severity,
          dedupeKey: `SANCTION_PRESEND:${p.senderId}:${best.entryId}:${day}`,
          details: {
            matches: matches.slice(0, 10), preSend: true, amount: p.amount, currency: p.currency,
            thresholds: { match: settings.matchThreshold, strong: settings.strongMatchThreshold },
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      caseId = created.id;
      await db.alert.create({
        data: {
          clientId: p.clientId, userId: p.senderId, type: 'SANCTION_MATCH', severity,
          title: 'Envoi refusé avant débit : liste de surveillance',
          message: reason,
          metadata: { caseId, score: best.score, preSend: true } as Prisma.InputJsonValue,
        },
      }).catch((e: Error) => logger.warn(`Alerte non créée : ${e.message}`));
      await notifyAdmins(db, p.clientId, '🚫 Envoi refusé par la conformité', `${best.subjectName} ≈ ${best.entryName} (${best.score} %). Aucun montant débité.`, { kind: 'SANCTION_MATCH', caseId, preSend: true });
    } catch (e) {
      if (!isUniqueViolation(e)) logger.warn(`Dossier d'envoi refusé non créé : ${(e as Error).message}`);
    }
    logger.warn(`🚫 Envoi refusé avant débit (${best.subjectName} ≈ ${best.entryName}, ${best.score} %)`);
    return { blocked: true, caseId };
  } catch (err) {
    logger.error(`Contrôle avant débit impossible : ${(err as Error).message}`);
    return ok;
  }
}

/** Ouvre un dossier pour un envoi signalé par le score AML. Idempotent (un dossier par envoi). Ne lève jamais. */
export async function openAmlCase(
  db: Db,
  p: { transactionId: string; clientId: number; userId: string; reference?: string | null; score: number; reasons: string[]; rules: string[]; amount: number; currency: string },
): Promise<string | null> {
  try {
    const severity = p.score >= 90 ? AlertSeverity.CRITICAL : p.score >= 75 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;
    const created = await db.complianceCase.create({
      data: {
        userId: p.userId, transactionId: p.transactionId, clientId: p.clientId,
        reason: `Score de risque ${p.score}/100 — ${p.reasons.join(' ; ')}`,
        kind: CASE_KIND.AML, severity, dedupeKey: `AML:${p.transactionId}`,
        details: { score: p.score, reasons: p.reasons, rules: p.rules, reference: p.reference ?? null, amount: p.amount, currency: p.currency } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    if (p.score >= 75) {
      await db.alert.create({
        data: {
          clientId: p.clientId, userId: p.userId, type: 'AML_RULE', severity,
          title: 'Envoi à risque élevé',
          message: `${p.reference ?? p.transactionId} — score ${p.score}/100 : ${p.reasons.join(' ; ')}`,
          metadata: { caseId: created.id, transactionId: p.transactionId, score: p.score, rules: p.rules } as Prisma.InputJsonValue,
        },
      }).catch(() => undefined);
    }
    return created.id;
  } catch (e) {
    if (!isUniqueViolation(e)) logger.warn(`Dossier AML non ouvert (${p.transactionId}) : ${(e as Error).message}`);
    return null;
  }
}

/** Combien d'envois récents sont « juste sous le seuil » (80 % à 100 %). `toXof` renvoie null quand le taux manque : l'envoi est alors ignoré. */
export async function countNearThreshold(
  rows: Array<{ amount: unknown; currency: unknown }>,
  threshold: number,
  toXof: (value: number, currency: string) => Promise<number | null>,
): Promise<number> {
  let n = 0;
  for (const r of rows) {
    const x = await toXof(Number(r.amount), String(r.currency));
    if (x !== null && x < threshold && x >= threshold * 0.8) n++;
  }
  return n;
}

/** Expéditeurs distincts (autres que celui-ci) qui ont envoyé au même bénéficiaire dans les dernières 24 h. */
export async function otherSendersToRecipient(db: Db, tx: { id: string; clientId: number; senderId: string; recipientId: string | null; beneficiaryPhone: string | null }, since: Date): Promise<number> {
  try {
    const target = tx.recipientId
      ? { recipientId: tx.recipientId }
      : tx.beneficiaryPhone ? { beneficiary: { phone: tx.beneficiaryPhone } } : null;
    if (!target) return 0;
    const rows = await db.transaction.findMany({
      where: { ...target, clientId: tx.clientId, id: { not: tx.id }, senderId: { not: tx.senderId }, createdAt: { gte: since }, status: { not: TransactionStatus.CANCELLED } },
      select: { senderId: true },
      take: 200,
    });
    return new Set(rows.map((r) => r.senderId)).size;
  } catch (err) {
    logger.warn(`Regroupement de fonds non évalué : ${(err as Error).message}`);
    return 0;
  }
}

export interface CustomerScreening { checked: number; cases: number }

/**
 * Confronte toute la clientèle d'une société à ses listes (saisies + officielles activées).
 * Un dossier par client et par fiche (dedupeKey) : relancer la fonction ne recrée jamais un dossier déjà traité.
 * Ne lève jamais.
 */
export async function screenCustomerBase(db: Db, clientId: number, settings?: ComplianceSettingsView): Promise<CustomerScreening> {
  try {
    const cfg = settings ?? (await loadComplianceSettings(db, clientId));
    const entries = await db.watchlistEntry.findMany({ where: { clientId, isActive: true } });
    if (!entries.length && !cfg.officialLists.length) return { checked: 0, cases: 0 };
    const own = new NameIndex(entries);
    const users = await db.user.findMany({
      where: { clientId, role: Role.USER, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      take: 50_000,
    });
    let cases = 0;
    for (const u of users) {
      const name = personName(u);
      if (!name) continue;
      const subjects: NameSubject[] = [{ role: 'CUSTOMER', name }];
      const matches = [
        ...own.query(subjects, cfg.matchThreshold),
        ...(await matchOfficial(db, cfg.officialLists, subjects, cfg.matchThreshold)),
      ].sort((a, b) => b.score - a.score);
      for (const m of matches.slice(0, 3)) {
        try {
          await db.complianceCase.create({
            data: {
              userId: u.id, clientId, kind: CASE_KIND.SANCTION, severity: severityForScore(m.score, cfg.strongMatchThreshold),
              dedupeKey: `SANCTION_USER:${u.id}:${m.entryId}`,
              reason: `Client en correspondance avec ${m.source ? `la liste officielle ${m.source}` : 'une liste de surveillance'} : « ${name} » ≈ « ${m.entryName} » (${m.score} %)`,
              details: { matches: [m], customer: true } as unknown as Prisma.InputJsonValue,
            },
          });
          cases++;
        } catch (e) {
          if (!isUniqueViolation(e)) logger.warn(`Dossier client non créé : ${(e as Error).message}`);
        }
      }
    }
    return { checked: users.length, cases };
  } catch (err) {
    logger.error(`Contrôle de la clientèle impossible (société ${clientId}) : ${(err as Error).message}`);
    return { checked: 0, cases: 0 };
  }
}

export { normalizeCountry };
