// apps/backend/src/compliance/compliance.service.ts
// =========================================================
// CONFORMITÉ — API administrateur de société (lot 17)
//   vue d'ensemble · dossiers (prendre, escalader, clore, débloquer / rejeter un envoi bloqué) ·
//   listes de surveillance (CRUD, import en masse, test d'un nom, contrôle de la clientèle) · réglages
// Tout est cloisonné par société. Chaque décision est tracée au journal d'audit.
// =========================================================

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ComplianceCaseStatus, Prisma, TransactionStatus, WatchlistKind } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CASE_KIND, DEFAULT_COMPLIANCE_SETTINGS, HELD_FROM, loadComplianceSettings, notifyAdmins, screenCustomerBase } from './compliance.core';
import { findMatches } from './name-matching';
import { isProvider, matchOfficial } from './official-index';
import { MANUAL_COOLDOWN_MS, OfficialListsService, isConfigured } from './official-lists.service';
import { OFFICIAL_PROVIDERS } from './official-parsers';
import { parseWatchlistLines } from './watchlist-import';
import type { CaseActionDto, ImportWatchlistDto, UpdateComplianceSettingsDto, UpdateWatchlistEntryDto, WatchlistEntryDto } from './dto/compliance.dto';

const OPEN_STATUSES: ComplianceCaseStatus[] = [ComplianceCaseStatus.OPEN, ComplianceCaseStatus.UNDER_REVIEW, ComplianceCaseStatus.ESCALATED];
const cleanList = (xs?: string[]): string[] => Array.from(new Set((xs ?? []).map((x) => x.trim()).filter(Boolean)));

type AuditAct = 'WATCHLIST_CHANGE' | 'COMPLIANCE_CASE' | 'COMPLIANCE_SETTINGS';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly official: OfficialListsService,
  ) {}

  private companyOf(user: AuthUserPayload): number {
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private async audit(user: AuthUserPayload, clientId: number, action: AuditAct, entity: string, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({ data: { userId: user.id, clientId, action, entity, entityId, details: details as Prisma.InputJsonValue, successful: true } });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${action}, ${entityId}) : ${(err as Error).message}`);
    }
  }

  // ── Vue d'ensemble ──────────────────────────────────────

  async overview(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [byStatus, openBySeverity, held, sanctions30, aml30, entries, settings, recentOpen] = await Promise.all([
      this.prisma.complianceCase.groupBy({ by: ['status'], where: { clientId }, _count: { _all: true } }),
      this.prisma.complianceCase.groupBy({ by: ['severity'], where: { clientId, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
      this.prisma.transaction.count({ where: { clientId, status: TransactionStatus.ON_HOLD, deletedAt: null } }),
      this.prisma.complianceCase.count({ where: { clientId, kind: CASE_KIND.SANCTION, createdAt: { gte: since30 } } }),
      this.prisma.complianceCase.count({ where: { clientId, kind: CASE_KIND.AML, createdAt: { gte: since30 } } }),
      this.prisma.watchlistEntry.groupBy({ by: ['kind'], where: { clientId, isActive: true }, _count: { _all: true } }),
      loadComplianceSettings(this.prisma, clientId),
      this.prisma.complianceCase.findMany({
        where: { clientId, status: { in: OPEN_STATUSES } }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }], take: 5,
        select: { id: true, reason: true, kind: true, severity: true, status: true, createdAt: true, transactionId: true },
      }),
    ]);
    const statusCount = (s: ComplianceCaseStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    return {
      open: OPEN_STATUSES.reduce((n, s) => n + statusCount(s), 0),
      byStatus: Object.fromEntries(Object.values(ComplianceCaseStatus).map((s) => [s, statusCount(s)])),
      openBySeverity: Object.fromEntries(openBySeverity.map((r) => [r.severity, r._count._all])),
      heldTransactions: held,
      sanctionCases30d: sanctions30,
      amlCases30d: aml30,
      watchlist: Object.fromEntries(entries.map((r) => [r.kind, r._count._all])),
      settings,
      recentOpen,
    };
  }

  // ── Dossiers ────────────────────────────────────────────

  async listCases(user: AuthUserPayload, q: { status?: string; kind?: string; search?: string; take?: number }) {
    const clientId = this.companyOf(user);
    const where: Prisma.ComplianceCaseWhereInput = { clientId };
    if (q.status === 'OPEN_ALL') where.status = { in: OPEN_STATUSES };
    else if (q.status && (Object.values(ComplianceCaseStatus) as string[]).includes(q.status)) where.status = q.status as ComplianceCaseStatus;
    if (q.kind && Object.values(CASE_KIND).includes(q.kind as never)) where.kind = q.kind;
    const search = q.search?.trim();
    if (search) where.reason = { contains: search.slice(0, 80), mode: 'insensitive' };
    const take = Math.min(Math.max(q.take ?? 60, 1), 200);

    const cases = await this.prisma.complianceCase.findMany({ where, orderBy: [{ createdAt: 'desc' }], take });
    const txIds = cases.map((c) => c.transactionId).filter((x): x is string => !!x);
    const txs = txIds.length
      ? await this.prisma.transaction.findMany({ where: { id: { in: txIds }, clientId }, select: { id: true, reference: true, amount: true, currency: true, status: true } })
      : [];
    const byId = new Map(txs.map((t) => [t.id, t]));
    return {
      items: cases.map((c) => this.shapeCase(c, c.transactionId ? byId.get(c.transactionId) : undefined)),
    };
  }

  private shapeCase(c: { id: string; reason: string; notes: string | null; status: ComplianceCaseStatus; assignedTo: string | null; resolvedAt: Date | null; resolution: string | null; kind: string; severity: string; details: Prisma.JsonValue; transactionId: string | null; userId: string | null; createdAt: Date }, tx?: { id: string; reference: string; amount: Prisma.Decimal; currency: unknown; status: TransactionStatus }) {
    return {
      id: c.id, reason: c.reason, status: c.status, kind: c.kind, severity: c.severity, details: c.details,
      assignedTo: c.assignedTo, resolvedAt: c.resolvedAt, resolution: c.resolution, createdAt: c.createdAt,
      userId: c.userId, transactionId: c.transactionId,
      transaction: tx ? { id: tx.id, reference: tx.reference, amount: Number(tx.amount), currency: String(tx.currency), status: tx.status } : null,
    };
  }

  /** Décision sur un dossier. Les décisions qui closent exigent une justification écrite. */
  async actOnCase(user: AuthUserPayload, caseId: string, dto: CaseActionDto) {
    const clientId = this.companyOf(user);
    const c = await this.prisma.complianceCase.findFirst({ where: { id: caseId, clientId } });
    if (!c) throw new NotFoundException('Dossier introuvable.');
    const closed = c.status === ComplianceCaseStatus.RESOLVED || c.status === ComplianceCaseStatus.CLOSED;
    const note = dto.note?.trim() ?? '';
    const needsNote = dto.action === 'RESOLVE' || dto.action === 'DISMISS' || dto.action === 'RELEASE' || dto.action === 'REJECT';
    if (needsNote && note.length < 5) throw new BadRequestException('Justifiez votre décision (5 caractères au moins).');
    if (closed) throw new ConflictException('Ce dossier est déjà clos.');

    const now = new Date();
    let data: Prisma.ComplianceCaseUpdateInput = {};
    const audit: Record<string, unknown> = { action: dto.action, kind: c.kind, transactionId: c.transactionId };

    if (dto.action === 'TAKE') {
      data = { status: ComplianceCaseStatus.UNDER_REVIEW, assignedTo: user.id };
    } else if (dto.action === 'ESCALATE') {
      data = { status: ComplianceCaseStatus.ESCALATED, notes: note ? `${c.notes ? `${c.notes}\n` : ''}Escalade : ${note}` : c.notes };
    } else if (dto.action === 'RESOLVE' || dto.action === 'DISMISS') {
      data = { status: dto.action === 'RESOLVE' ? ComplianceCaseStatus.RESOLVED : ComplianceCaseStatus.CLOSED, resolvedAt: now, resolution: note, assignedTo: c.assignedTo ?? user.id };
    } else {
      // RELEASE / REJECT : seulement pour un envoi actuellement bloqué.
      if (!c.transactionId) throw new BadRequestException('Ce dossier ne porte pas sur un envoi.');
      const tx = await this.prisma.transaction.findFirst({ where: { id: c.transactionId, clientId }, select: { id: true, status: true } });
      if (!tx || tx.status !== TransactionStatus.ON_HOLD) throw new ConflictException("Cet envoi n'est pas bloqué.");
      if (dto.action === 'RELEASE') {
        const from = (c.details as { heldFrom?: string } | null)?.heldFrom;
        const restoreTo = (HELD_FROM as readonly string[]).includes(from ?? '') ? (from as TransactionStatus) : TransactionStatus.PENDING;
        await this.transactions.releaseHeld(clientId, user.id, tx.id, restoreTo);
        audit.restoredTo = restoreTo;
      } else {
        await this.transactions.rejectHeld(clientId, user.id, tx.id);
        audit.refunded = true;
      }
      data = { status: ComplianceCaseStatus.RESOLVED, resolvedAt: now, resolution: `${dto.action === 'RELEASE' ? 'Envoi débloqué' : 'Envoi rejeté et remboursé'} — ${note}`, assignedTo: c.assignedTo ?? user.id };
    }

    const updated = await this.prisma.complianceCase.update({ where: { id: c.id }, data });
    // Les signalements AML de l'envoi sont examinés dès que le dossier est clos.
    if (c.transactionId && (data.status === ComplianceCaseStatus.RESOLVED || data.status === ComplianceCaseStatus.CLOSED)) {
      await this.prisma.amlFlag.updateMany({
        where: { transactionId: c.transactionId, isReviewed: false },
        data: { isReviewed: true, reviewedBy: user.id, reviewedAt: now, resolution: note },
      }).catch(() => undefined);
    }
    await this.audit(user, clientId, 'COMPLIANCE_CASE', 'ComplianceCase', c.id, { ...audit, note });
    return this.shapeCase(updated);
  }

  // ── Listes de surveillance ──────────────────────────────

  async listWatchlist(user: AuthUserPayload, q: { kind?: string; search?: string; active?: string }) {
    const clientId = this.companyOf(user);
    const where: Prisma.WatchlistEntryWhereInput = { clientId };
    if (q.kind && (Object.values(WatchlistKind) as string[]).includes(q.kind)) where.kind = q.kind as WatchlistKind;
    if (q.active === 'true') where.isActive = true;
    if (q.active === 'false') where.isActive = false;
    const search = q.search?.trim();
    if (search) where.OR = [{ fullName: { contains: search.slice(0, 80), mode: 'insensitive' } }, { aliases: { has: search.slice(0, 80) } }, { reference: { contains: search.slice(0, 80), mode: 'insensitive' } }];
    const items = await this.prisma.watchlistEntry.findMany({ where, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }], take: 500 });
    return { items };
  }

  async createEntry(user: AuthUserPayload, dto: WatchlistEntryDto) {
    const clientId = this.companyOf(user);
    const entry = await this.prisma.watchlistEntry.create({
      data: { clientId, kind: dto.kind, fullName: dto.fullName.trim(), aliases: cleanList(dto.aliases), country: dto.country?.trim() || null, birthYear: dto.birthYear ?? null, reference: dto.reference?.trim() || null, notes: dto.notes?.trim() || null },
    });
    await this.audit(user, clientId, 'WATCHLIST_CHANGE', 'WatchlistEntry', entry.id, { op: 'CREATE', kind: entry.kind, fullName: entry.fullName });
    return entry;
  }

  async updateEntry(user: AuthUserPayload, id: string, dto: UpdateWatchlistEntryDto) {
    const clientId = this.companyOf(user);
    const found = await this.prisma.watchlistEntry.findFirst({ where: { id, clientId } });
    if (!found) throw new NotFoundException('Fiche introuvable.');
    const entry = await this.prisma.watchlistEntry.update({
      where: { id },
      data: {
        ...(dto.kind ? { kind: dto.kind } : {}),
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.aliases !== undefined ? { aliases: cleanList(dto.aliases) } : {}),
        ...(dto.country !== undefined ? { country: dto.country.trim() || null } : {}),
        ...(dto.birthYear !== undefined ? { birthYear: dto.birthYear } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit(user, clientId, 'WATCHLIST_CHANGE', 'WatchlistEntry', id, { op: 'UPDATE', fields: Object.keys(dto) });
    return entry;
  }

  async removeEntry(user: AuthUserPayload, id: string) {
    const clientId = this.companyOf(user);
    const found = await this.prisma.watchlistEntry.findFirst({ where: { id, clientId } });
    if (!found) throw new NotFoundException('Fiche introuvable.');
    await this.prisma.watchlistEntry.delete({ where: { id } });
    await this.audit(user, clientId, 'WATCHLIST_CHANGE', 'WatchlistEntry', id, { op: 'DELETE', fullName: found.fullName });
    return { ok: true };
  }

  async importEntries(user: AuthUserPayload, dto: ImportWatchlistDto) {
    const clientId = this.companyOf(user);
    const { entries, errors } = parseWatchlistLines(dto.text);
    if (!entries.length) return { created: 0, skipped: 0, errors };
    // Les fiches déjà présentes (même nom, même liste) ne sont pas dupliquées : on peut réimporter une liste mise à jour.
    const existing = await this.prisma.watchlistEntry.findMany({ where: { clientId, kind: dto.kind }, select: { fullName: true } });
    const known = new Set(existing.map((e) => e.fullName.trim().toLowerCase()));
    const fresh = entries.filter((e) => !known.has(e.fullName.toLowerCase()));
    if (fresh.length) {
      await this.prisma.watchlistEntry.createMany({
        data: fresh.map((e) => ({ clientId, kind: dto.kind, fullName: e.fullName, aliases: e.aliases, country: e.country, birthYear: e.birthYear, reference: e.reference })),
      });
    }
    await this.audit(user, clientId, 'WATCHLIST_CHANGE', 'WatchlistEntry', `import:${dto.kind}`, { op: 'IMPORT', kind: dto.kind, created: fresh.length, skipped: entries.length - fresh.length, errors: errors.length });
    return { created: fresh.length, skipped: entries.length - fresh.length, errors };
  }

  /** Teste un nom contre les listes de la société (sans rien enregistrer) — utile pour régler les seuils. */
  async testName(user: AuthUserPayload, name: string) {
    const clientId = this.companyOf(user);
    const [settings, entries] = await Promise.all([
      loadComplianceSettings(this.prisma, clientId),
      this.prisma.watchlistEntry.findMany({ where: { clientId, isActive: true } }),
    ]);
    const subjects = [{ role: 'TEST', name }];
    const matches = [
      ...findMatches(subjects, entries, 60),
      ...(await matchOfficial(this.prisma, settings.officialLists, subjects, 60)),
    ].sort((a, b) => b.score - a.score).slice(0, 8);
    return { matches, threshold: settings.matchThreshold, strongThreshold: settings.strongMatchThreshold };
  }

  /** Confronte toute la clientèle de la société à ses listes (saisies + officielles activées). Un dossier par client et par fiche. */
  async screenCustomers(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const result = await screenCustomerBase(this.prisma, clientId);
    await this.audit(user, clientId, 'COMPLIANCE_CASE', 'ComplianceCase', 'screen-customers', { op: 'SCREEN_CUSTOMERS', ...result });
    return result;
  }

  // ── Listes officielles (ONU · OFAC · UE) ────────────────

  async officialLists(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    const settings = await loadComplianceSettings(this.prisma, clientId);
    return this.official.overview(settings.officialLists);
  }

  /** Active / désactive une liste officielle pour la société. À l'activation : actualisation si besoin, puis contrôle de la clientèle. */
  async setOfficialList(user: AuthUserPayload, provider: string, enabled: boolean) {
    const clientId = this.companyOf(user);
    if (!isProvider(provider)) throw new NotFoundException('Liste inconnue.');
    const current = await loadComplianceSettings(this.prisma, clientId);
    const next = enabled ? Array.from(new Set([...current.officialLists, provider])) : current.officialLists.filter((p) => p !== provider);
    await this.prisma.complianceSettings.upsert({
      where: { clientId },
      create: { clientId, officialLists: next },
      update: { officialLists: next },
    });
    await this.audit(user, clientId, 'COMPLIANCE_SETTINGS', 'ComplianceSettings', String(clientId), { op: enabled ? 'OFFICIAL_LIST_ON' : 'OFFICIAL_LIST_OFF', provider });

    if (enabled) {
      const row = (await this.official.overview(next)).find((o) => o.provider === provider);
      if (row && row.entryCount === 0 && isConfigured(provider)) void this.official.sync(provider); // le contrôle de la clientèle suit la synchronisation
      else if (row && row.entryCount > 0) {
        void screenCustomerBase(this.prisma, clientId).then((r) => (r.cases > 0
          ? notifyAdmins(this.prisma, clientId, `⚠️ Liste ${provider} activée`, `${r.cases} dossier(s) client ouvert(s) après le contrôle de votre clientèle.`, { kind: 'OFFICIAL_LIST_MATCH', provider, cases: r.cases })
          : undefined));
      }
    }
    return this.officialLists(user);
  }

  /** Lance l'actualisation en arrière-plan (la liste est partagée : délai minimal entre deux demandes manuelles). */
  async syncOfficialList(user: AuthUserPayload, provider: string) {
    const clientId = this.companyOf(user);
    if (!isProvider(provider)) throw new NotFoundException('Liste inconnue.');
    if (!isConfigured(provider)) throw new BadRequestException("Aucune adresse n'est configurée pour cette liste (voir OFFICIAL_LIST_EU_URL).");
    if (this.official.isRunning(provider)) return this.officialLists(user);
    const row = await this.prisma.officialListSync.findUnique({ where: { provider } });
    if (row?.lastRunAt && row.status !== 'ERROR' && Date.now() - row.lastRunAt.getTime() < MANUAL_COOLDOWN_MS) {
      throw new ConflictException('Cette liste vient d’être actualisée. Réessayez dans quelques minutes.');
    }
    await this.audit(user, clientId, 'COMPLIANCE_SETTINGS', 'OfficialListSync', provider, { op: 'OFFICIAL_LIST_SYNC', provider });
    void this.official.sync(provider);
    return { ...(await this.officialLists(user)), started: true };
  }

  // ── Réglages ────────────────────────────────────────────

  async getSettings(user: AuthUserPayload) {
    const clientId = this.companyOf(user);
    return { ...(await loadComplianceSettings(this.prisma, clientId)), defaults: DEFAULT_COMPLIANCE_SETTINGS, platform: { amlThresholdXof: Number(process.env.AML_THRESHOLD_XOF) > 0 ? Number(process.env.AML_THRESHOLD_XOF) : 2_000_000, amlFlagScore: Number(process.env.AML_FLAG_SCORE) >= 1 ? Number(process.env.AML_FLAG_SCORE) : 60 } };
  }

  async updateSettings(user: AuthUserPayload, dto: UpdateComplianceSettingsDto) {
    const clientId = this.companyOf(user);
    const current = await loadComplianceSettings(this.prisma, clientId);
    const matchThreshold = dto.matchThreshold ?? current.matchThreshold;
    const strong = dto.strongMatchThreshold ?? current.strongMatchThreshold;
    if (strong < matchThreshold) throw new BadRequestException('Le seuil de blocage ne peut pas être inférieur au seuil de signalement.');
    const data = {
      sanctionsEnabled: dto.sanctionsEnabled ?? current.sanctionsEnabled,
      matchThreshold, strongMatchThreshold: strong,
      holdOnStrongMatch: dto.holdOnStrongMatch ?? current.holdOnStrongMatch,
      amlThresholdXof: dto.amlThresholdXof === undefined ? current.amlThresholdXof : dto.amlThresholdXof,
      amlFlagScore: dto.amlFlagScore === undefined ? current.amlFlagScore : dto.amlFlagScore,
      highRiskCountries: dto.highRiskCountries ? cleanList(dto.highRiskCountries) : current.highRiskCountries,
      structuringCount: dto.structuringCount ?? current.structuringCount,
      fanInSenders: dto.fanInSenders ?? current.fanInSenders,
      officialLists: dto.officialLists ? Array.from(new Set(dto.officialLists)).filter((p) => (OFFICIAL_PROVIDERS as readonly string[]).includes(p)) : current.officialLists,
    };
    await this.prisma.complianceSettings.upsert({ where: { clientId }, create: { clientId, ...data }, update: data });
    await this.audit(user, clientId, 'COMPLIANCE_SETTINGS', 'ComplianceSettings', String(clientId), { before: { ...current, configured: undefined }, after: data });
    return this.getSettings(user);
  }
}
