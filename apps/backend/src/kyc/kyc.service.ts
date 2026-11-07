// apps/backend/src/kyc/kyc.service.ts
// =========================================================
// KYC SERVICE v1.0 — vérification d'identité des clients wallet.
//
//  CLIENT   getMyStatus()                 où en est mon dossier, ce qu'il manque
//           submit()                      envoi d'une pièce (recto, verso, selfie, justificatif de domicile)
//           getFile()                     relecture d'une de SES pièces (jamais celles d'un autre)
//  ADMIN    adminStats() / adminQueue()   file de validation de la société (le plus ancien d'abord)
//           adminDossier()                dossier complet d'un client : pièces, historique, niveau
//           approve() / reject()          décision motivée ; reject() sur une pièce déjà validée = révocation
//           adminRemind()                 rappel immédiat à un client qui n'a rien envoyé
//
// Règles :
//  • Le niveau KYC ne monte QUE par la validation d'un administrateur (ou sa décision manuelle, elle-même soumise aux
//    pièces : voir TransferLimitsService.setUserKycLevel). Il ne baisse que par révocation ou expiration de la pièce.
//  • Une décision est prise une seule fois (mise à jour conditionnelle sur le statut PENDING) : deux administrateurs qui
//    valident/refusent la même pièce en même temps ne la traitent pas deux fois.
//  • Seuls le propriétaire, les administrateurs de sa société et le super administrateur lisent une pièce.
//  • Tout est journalisé (AuditLog : KYC_SUBMIT / KYC_APPROVE / KYC_REJECT ; une expiration automatique est un KYC_REJECT avec expired:true).
// =========================================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuditAction, Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import type { SubmitKycDocumentDto } from './dto/kyc.dto';
import { recordView } from './kyc-audit';
import { KycNotifierService } from './kyc-notifier.service';
import {
  ADDRESS_TYPES,
  DOC_LABEL,
  IDENTITY_TYPES,
  KycFileError,
  NEEDS_BACK,
  NEEDS_EXPIRY,
  decodeUpload,
  isDocType,
  daysUntilExpiry,
  EXPIRY_RENEWAL_DAYS,
  identityExpiry,
  identityLapsed,
  isExpired,
  levelFromDocs,
  levelRank,
  maxLevel,
  missingForBasic,
  overallStatus,
  parseDate,
  type KycDocType,
} from './kyc-rules';
import { reminderMessage } from './kyc-messages';
import { hasPermission, SUPPORT_NOT_DELEGATED } from '../support/support-permissions';

/** Au plus ce nombre d'envois par client et par 24 h (anti-bourrage de la base). */
export const MAX_SUBMISSIONS_PER_DAY = 12;
/** Une pièce d'identité ne peut pas expirer dans plus de 25 ans (faute de saisie). */
const MAX_EXPIRY_YEARS = 25;

export type FileKind = 'front' | 'back';

const DOC_SELECT = {
  id: true,
  userId: true,
  type: true,
  status: true,
  documentNumber: true,
  expiryDate: true,
  issuedCountry: true,
  version: true,
  rejectionReason: true,
  reviewedAt: true,
  reviewedById: true,
  createdAt: true,
  backUrl: true,
} satisfies Prisma.KycDocumentSelect;

type DocRow = Prisma.KycDocumentGetPayload<{ select: typeof DOC_SELECT }>;

const fullName = (u: { firstName: string | null; lastName: string | null; email?: string | null } | null | undefined): string | null => {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || null;
};

const QUEUE_SELECT = {
  id: true, firstName: true, lastName: true, email: true, phone: true, country: true, kycLevel: true, createdAt: true, clientId: true,
  kyc: { orderBy: { createdAt: 'desc' as const }, select: DOC_SELECT },
} satisfies Prisma.UserSelect;

function docView(d: DocRow) {
  return {
    id: d.id,
    type: d.type,
    label: DOC_LABEL[d.type as KycDocType] ?? d.type,
    status: d.status,
    documentNumber: d.documentNumber,
    expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
    issuedCountry: d.issuedCountry,
    version: d.version,
    hasBack: Boolean(d.backUrl),
    rejectionReason: d.rejectionReason,
    reviewedAt: d.reviewedAt ? d.reviewedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: KycNotifierService,
  ) {}

  // ── Outils ───────────────────────────────────────────
  private async audit(
    userId: string | null,
    clientId: number | null,
    action: AuditAction,
    entityId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { userId, clientId, action, entity: 'KycDocument', entityId, details: details as Prisma.InputJsonValue, successful: true },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (KYC ${entityId}) : ${(err as Error).message}`);
    }
  }

  /** L'administrateur peut-il agir sur ce client ? (sa société, ou super administrateur ; le service client doit avoir la délégation.) */
  private assertAdminScope(admin: AuthUserPayload, target: { clientId: number | null }): void {
    if (admin.role === 'SUPER_ADMIN') return;
    if ((admin.role !== 'COMPANY_ADMIN' && admin.role !== 'SUPPORT') || !admin.clientId) throw new ForbiddenException("Réservé à l'administrateur de la société.");
    if (admin.role === 'SUPPORT' && !hasPermission(admin, 'KYC_REVIEW')) throw new ForbiddenException(SUPPORT_NOT_DELEGATED);
    if (target.clientId !== admin.clientId) throw new NotFoundException('Dossier introuvable.');
  }

  /** Administrateurs, ou service client à qui l'admin a délégué la validation des pièces (lot 9). */
  private assertIsAdmin(admin: AuthUserPayload): void {
    if (admin.role === 'SUPER_ADMIN' || admin.role === 'COMPANY_ADMIN') return;
    if (admin.role === 'SUPPORT') {
      if (!hasPermission(admin, 'KYC_REVIEW')) throw new ForbiddenException(SUPPORT_NOT_DELEGATED);
      return;
    }
    throw new ForbiddenException("Réservé aux administrateurs.");
  }

  // ═══════════════════════════════════════════════════════
  //  CLIENT
  // ═══════════════════════════════════════════════════════
  async getMyStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, kycLevel: true, kycVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return this.statusOf(user);
  }

  private async statusOf(user: { id: string; role: string; kycLevel: string; kycVerifiedAt: Date | null }) {
    const now = new Date();
    const docs = await this.prisma.kycDocument.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: DOC_SELECT,
    });
    const status = overallStatus(user.kycLevel, docs, now);
    // Une seule version « courante » par type : la plus récente.
    const latestByType = new Map<string, DocRow>();
    for (const d of docs) if (!latestByType.has(d.type)) latestByType.set(d.type, d);
    // lot 8 — une pièce d'identité expirée (et non remplacée) retire la vérification immédiatement.
    const lapsed = identityLapsed(docs, now);
    const verified = levelRank(user.kycLevel) >= 1 && !lapsed;
    const exp = identityExpiry(docs, now);
    return {
      status,
      level: user.kycLevel,
      verified,
      /** Un client non vérifié, ou dont la pièce d'identité a expiré, ne peut ni envoyer ni programmer de virement. */
      canTransact: user.role !== 'USER' || verified,
      verifiedAt: user.kycVerifiedAt ? user.kycVerifiedAt.toISOString() : null,
      /** Pièce d'identité qui expire dans 30 jours ou moins, ou déjà expirée ; null sinon. */
      expiry: exp
        ? { type: exp.type, label: DOC_LABEL[exp.type as KycDocType] ?? exp.type, expiryDate: exp.expiryDate.toISOString().slice(0, 10), daysLeft: exp.daysLeft, expired: exp.expired }
        : null,
      missing: verified ? [] : missingForBasic(docs, now),
      canUpgrade: verified && levelRank(user.kycLevel) < 2 && !docs.some((d) => (ADDRESS_TYPES as readonly string[]).includes(d.type) && ['PENDING', 'APPROVED'].includes(d.status)),
      documents: [...latestByType.values()].map(docView),
      history: docs.map(docView),
    };
  }

  async submit(userId: string, dto: SubmitKycDocumentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, clientId: true, kycLevel: true, kycVerifiedAt: true, firstName: true, lastName: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) throw new NotFoundException('Utilisateur introuvable.');
    if (user.role !== 'USER') throw new ForbiddenException("La vérification d'identité concerne les clients wallet.");
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');

    if (!isDocType(dto.type)) throw new BadRequestException('Type de pièce inconnu.');
    const type: KycDocType = dto.type;
    const now = new Date();

    // ── Champs de la pièce ──
    let expiryDate: Date | null = null;
    if ((NEEDS_EXPIRY as readonly string[]).includes(type)) {
      expiryDate = parseDate(dto.expiryDate);
      if (!expiryDate) throw new BadRequestException("Indiquez la date d'expiration de la pièce (AAAA-MM-JJ).");
      if (isExpired(expiryDate, now)) throw new BadRequestException('Cette pièce est expirée : envoyez une pièce en cours de validité.');
      const limit = new Date(now);
      limit.setUTCFullYear(limit.getUTCFullYear() + MAX_EXPIRY_YEARS);
      if (expiryDate > limit) throw new BadRequestException("La date d'expiration semble erronée.");
    }
    if ((IDENTITY_TYPES as readonly string[]).includes(type) && !(dto.documentNumber ?? '').trim()) {
      throw new BadRequestException('Indiquez le numéro de la pièce.');
    }
    if ((NEEDS_BACK as readonly string[]).includes(type) && !dto.back) {
      throw new BadRequestException(`Photographiez aussi le verso : ${DOC_LABEL[type]}.`);
    }

    // ── Fichiers ──
    let front, back;
    try {
      front = decodeUpload(dto.front, 'La photo (recto)');
      back = dto.back ? decodeUpload(dto.back, 'La photo du verso') : null;
    } catch (err) {
      if (err instanceof KycFileError) throw new BadRequestException(err.message);
      throw err;
    }
    if (type === 'SELFIE' && front.mimeType === 'application/pdf') throw new BadRequestException('Le selfie doit être une photo.');

    // ── Limites ──
    const recent = await this.prisma.kycDocument.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
    if (recent >= MAX_SUBMISSIONS_PER_DAY) {
      throw new HttpException('Trop d\'envois aujourd\'hui. Réessayez demain ou contactez votre agence.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const alreadyValid = await this.prisma.kycDocument.findFirst({ where: { userId, type, status: 'APPROVED' }, select: { expiryDate: true } });
    // Renouvellement (lot 8) : une pièce d'identité qui expire dans 30 jours ou moins peut être remplacée avant son échéance, sinon le
    // rappel « votre pièce expire bientôt » serait sans issue. L'ancienne reste valable (et débloque les opérations) jusqu'à sa date.
    const renewable =
      !!alreadyValid?.expiryDate && (IDENTITY_TYPES as readonly string[]).includes(type) && daysUntilExpiry(alreadyValid.expiryDate, now) <= EXPIRY_RENEWAL_DAYS;
    if (alreadyValid && !isExpired(alreadyValid.expiryDate, now) && !renewable) {
      throw new ConflictException(`Votre ${DOC_LABEL[type].toLowerCase()} est déjà validée.`);
    }

    // ── Écriture : on remplace une éventuelle pièce du même type encore en attente ──
    const id = randomUUID();
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.kycDocument.deleteMany({ where: { userId, type, status: 'PENDING' } });
      const last = await tx.kycDocument.findFirst({ where: { userId, type }, orderBy: { version: 'desc' }, select: { version: true } });
      return tx.kycDocument.create({
        data: {
          id,
          userId,
          type,
          status: 'PENDING',
          documentUrl: `/kyc/documents/${id}/front`,
          backUrl: back ? `/kyc/documents/${id}/back` : null,
          documentNumber: dto.documentNumber?.trim() || null,
          expiryDate,
          issuedCountry: dto.issuedCountry?.trim() || null,
          version: (last?.version ?? 0) + 1,
          files: {
            create: [
              { kind: 'FRONT', mimeType: front.mimeType, sizeBytes: front.sizeBytes, sha256: front.sha256, data: front.buffer },
              ...(back ? [{ kind: 'BACK', mimeType: back.mimeType, sizeBytes: back.sizeBytes, sha256: back.sha256, data: back.buffer }] : []),
            ],
          },
        },
        select: DOC_SELECT,
      });
    });

    await this.audit(userId, user.clientId, 'KYC_SUBMIT', created.id, { type, version: created.version, hasBack: Boolean(back) });

    // Prévenir les administrateurs de la société (jamais bloquant).
    void this.notifier
      .notifyCompanyAdmins(user.clientId, {
        kind: 'ADMIN_NEW',
        title: "Nouveau dossier d'identité à valider",
        body: `${fullName(user) ?? 'Un client'} a envoyé : ${DOC_LABEL[type]}.`,
        actionUrl: '/admin/kyc',
        actionLabel: 'Vérifications KYC',
      })
      .catch((e) => this.logger.warn(`Avis aux administrateurs non envoyé : ${(e as Error).message}`));

    // Accusé de réception au client (notification dans l'application, sans e-mail ni push superflus).
    await this.prisma.notification
      .create({
        data: {
          userId,
          title: 'Pièce reçue',
          message: `Votre ${DOC_LABEL[type].toLowerCase()} a bien été reçue. Un administrateur la vérifie : vous serez prévenu de la décision.`,
          type: 'INFO',
          channels: ['IN_APP'],
          groupKey: 'kyc',
          actionUrl: '/profile/kyc',
          actionLabel: "Vérification d'identité",
        },
      })
      .catch(() => undefined);

    return { document: docView(created), ...(await this.statusOf(user)) };
  }

  /** Contenu d'une pièce : son propriétaire, les administrateurs de sa société, le super administrateur. */
  async getFile(requester: AuthUserPayload, documentId: string, kind: FileKind) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      select: { id: true, userId: true, type: true, user: { select: { clientId: true } } },
    });
    if (!doc) throw new NotFoundException('Pièce introuvable.');
    const own = doc.userId === requester.id;
    const adminOk =
      requester.role === 'SUPER_ADMIN' ||
      ((requester.role === 'COMPANY_ADMIN' || (requester.role === 'SUPPORT' && hasPermission(requester, 'KYC_REVIEW'))) &&
        !!requester.clientId &&
        requester.clientId === doc.user.clientId);
    if (!own && !adminOk) throw new NotFoundException('Pièce introuvable.'); // 404 : on ne confirme pas l'existence

    const file = await this.prisma.kycFile.findUnique({
      where: { documentId_kind: { documentId, kind: kind === 'back' ? 'BACK' : 'FRONT' } },
      select: { data: true, mimeType: true, sha256: true },
    });
    if (!file) throw new NotFoundException('Fichier introuvable.');
    // lot 8 — la consultation par un administrateur est journalisée (pas celle du client sur sa propre pièce).
    if (!own) {
      await recordView(this.prisma, { actorId: requester.id, clientId: doc.user.clientId, entity: 'KycDocument', entityId: documentId, what: kind, subjectId: doc.userId });
    }
    return { buffer: Buffer.from(file.data), mimeType: file.mimeType, sha256: file.sha256, name: `${doc.type.toLowerCase()}-${kind}` };
  }

  // ═══════════════════════════════════════════════════════
  //  ADMIN
  // ═══════════════════════════════════════════════════════
  private scopeWhere(admin: AuthUserPayload, clientId?: number): Prisma.UserWhereInput {
    this.assertIsAdmin(admin);
    const base: Prisma.UserWhereInput = { role: 'USER', deletedAt: null };
    if (admin.role === 'SUPER_ADMIN') return clientId ? { ...base, clientId } : base;
    if (!admin.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return { ...base, clientId: admin.clientId };
  }

  async adminStats(admin: AuthUserPayload, clientId?: number) {
    const scope = this.scopeWhere(admin, clientId);
    const [pending, rejected, notSubmitted, approved, oldest] = await Promise.all([
      this.prisma.user.count({ where: { ...scope, kyc: { some: { status: 'PENDING' } } } }),
      this.prisma.user.count({ where: { ...scope, kycLevel: 'LEVEL_0', kyc: { some: { status: 'REJECTED' }, none: { status: 'PENDING' } } } }),
      this.prisma.user.count({ where: { ...scope, kycLevel: 'LEVEL_0', kyc: { none: {} } } }),
      this.prisma.user.count({ where: { ...scope, kycLevel: { not: 'LEVEL_0' } } }),
      this.prisma.kycDocument.findFirst({
        where: { status: 'PENDING', user: scope },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    return { pending, rejected, notSubmitted, approved, oldestPendingAt: oldest ? oldest.createdAt.toISOString() : null };
  }

  async adminQueue(
    admin: AuthUserPayload,
    q: { status?: string; search?: string; page?: number; limit?: number; clientId?: number },
  ) {
    const scope = this.scopeWhere(admin, q.clientId);
    const status = String(q.status ?? 'PENDING').toUpperCase();
    const page = Math.max(1, Math.floor(Number(q.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(q.limit) || 20)));

    const filters: Prisma.UserWhereInput[] = [scope];
    if (status === 'PENDING') filters.push({ kyc: { some: { status: 'PENDING' } } });
    else if (status === 'REJECTED') filters.push({ kycLevel: 'LEVEL_0', kyc: { some: { status: 'REJECTED' }, none: { status: 'PENDING' } } });
    else if (status === 'NOT_SUBMITTED') filters.push({ kycLevel: 'LEVEL_0', kyc: { none: {} } });
    else if (status === 'APPROVED') filters.push({ kycLevel: { not: 'LEVEL_0' } });
    else if (status !== 'ALL') throw new BadRequestException('Statut inconnu.');
    const search = (q.search ?? '').trim();
    if (search) {
      filters.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.UserWhereInput = { AND: filters };

    let total: number;
    let users: Array<Prisma.UserGetPayload<{ select: typeof QUEUE_SELECT }>>;
    if (status === 'PENDING') {
      // File d'attente : premier arrivé, premier servi — tri sur la plus ancienne pièce en attente de chaque client.
      const pendingWhere: Prisma.KycDocumentWhereInput = { status: 'PENDING', user: where };
      const [ids, count] = await Promise.all([
        this.prisma.kycDocument.groupBy({
          by: ['userId'],
          where: pendingWhere,
          _min: { createdAt: true },
          orderBy: [{ _min: { createdAt: 'asc' } }, { userId: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.user.count({ where }),
      ]);
      total = count;
      const rows = await this.prisma.user.findMany({ where: { id: { in: ids.map((i) => i.userId) } }, select: QUEUE_SELECT });
      const byId = new Map(rows.map((r) => [r.id, r]));
      users = ids.map((i) => byId.get(i.userId)).filter((u): u is NonNullable<typeof u> => Boolean(u));
    } else {
      [total, users] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: QUEUE_SELECT,
        }),
      ]);
    }

    const now = new Date();
    const items = users.map((u) => {
      const pendingDocs = u.kyc.filter((d) => d.status === 'PENDING');
      const submittedAt = pendingDocs.length ? pendingDocs.reduce((min, d) => (d.createdAt < min ? d.createdAt : min), pendingDocs[0].createdAt) : null;
      return {
        userId: u.id,
        name: fullName(u),
        email: u.email,
        phone: u.phone,
        country: u.country,
        clientId: u.clientId,
        level: u.kycLevel,
        status: overallStatus(u.kycLevel, u.kyc, now),
        pendingCount: pendingDocs.length,
        pendingTypes: pendingDocs.map((d) => d.type),
        submittedAt: submittedAt ? submittedAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      };
    });
    return { items, page, limit, total, hasMore: page * limit < total };
  }

  async adminDossier(admin: AuthUserPayload, userId: string) {
    this.assertIsAdmin(admin);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'USER', deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true, country: true, city: true, addressStreet: true, postalCode: true, birthDate: true, nationality: true, birthPlace: true,
        kycLevel: true, kycVerifiedAt: true, createdAt: true, clientId: true, isSuspended: true, kycLastReminderAt: true, kycReminderCount: true,
      },
    });
    if (!user) throw new NotFoundException('Client introuvable.');
    this.assertAdminScope(admin, user);
    await recordView(this.prisma, { actorId: admin.id, clientId: user.clientId, entity: 'KycDossier', entityId: user.id, what: 'dossier', subjectId: user.id });
    const status = await this.statusOf({ id: user.id, role: 'USER', kycLevel: user.kycLevel, kycVerifiedAt: user.kycVerifiedAt });
    return {
      user: {
        id: user.id, name: fullName(user), firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone,
        country: user.country, city: user.city, address: [user.addressStreet, user.postalCode].filter(Boolean).join(' ') || null,
        birthDate: user.birthDate, nationality: user.nationality, birthPlace: user.birthPlace,
        createdAt: user.createdAt.toISOString(), isSuspended: user.isSuspended,
        remindersSent: user.kycReminderCount, lastReminderAt: user.kycLastReminderAt ? user.kycLastReminderAt.toISOString() : null,
      },
      ...status,
    };
  }

  private async loadForReview(admin: AuthUserPayload, documentId: string) {
    this.assertIsAdmin(admin);
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      select: { ...DOC_SELECT, user: { select: { id: true, clientId: true, kycLevel: true, firstName: true, lastName: true, email: true } } },
    });
    if (!doc) throw new NotFoundException('Pièce introuvable.');
    this.assertAdminScope(admin, doc.user);
    return doc;
  }

  /** Recalcule le niveau du client après une décision et l'enregistre. `allowDecrease` : révocation / expiration. */
  private async applyLevel(
    tx: Prisma.TransactionClient,
    userId: string,
    allowDecrease: boolean,
    now: Date,
  ): Promise<{ before: string; after: string }> {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { kycLevel: true } });
    const docs = await tx.kycDocument.findMany({ where: { userId }, select: { type: true, status: true, expiryDate: true } });
    const computed = levelFromDocs(docs, now);
    const before = String(u?.kycLevel ?? 'LEVEL_0');
    // Montée : jamais en dessous du niveau actuel. Révocation : le niveau retombe à ce que prouvent les pièces restantes
    // (un LEVEL_3 accordé à la main est conservé tant que l'identité de base reste prouvée).
    let after: string = allowDecrease ? computed : maxLevel(before, computed);
    if (allowDecrease && before === 'LEVEL_3' && levelRank(computed) >= 1) after = 'LEVEL_3';
    if (after !== before || levelRank(after) >= 1) {
      await tx.user.update({
        where: { id: userId },
        data: {
          kycLevel: after as never,
          ...(levelRank(after) >= 1 && levelRank(before) < 1 ? { kycVerifiedAt: now, kycReminderCount: 0, kycLastReminderAt: null } : {}),
        },
      });
    }
    return { before, after };
  }

  async approve(admin: AuthUserPayload, documentId: string, note?: string) {
    const doc = await this.loadForReview(admin, documentId);
    const now = new Date();
    if ((NEEDS_EXPIRY as readonly string[]).includes(doc.type) && isExpired(doc.expiryDate, now)) {
      throw new BadRequestException("Cette pièce est expirée : refusez-la en demandant une pièce en cours de validité.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Décision unique : seule la pièce encore EN ATTENTE peut être validée.
      const claimed = await tx.kycDocument.updateMany({
        where: { id: documentId, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedAt: now, reviewedById: admin.id, rejectionReason: null },
      });
      if (claimed.count !== 1) throw new ConflictException('Cette pièce a déjà été traitée.');
      return this.applyLevel(tx, doc.userId, false, now);
    });

    await this.audit(admin.id, doc.user.clientId, 'KYC_APPROVE', documentId, {
      userId: doc.userId, type: doc.type, levelBefore: result.before, levelAfter: result.after, note: note?.trim() || null,
    });

    const verified = levelRank(result.after) >= 1;
    const partial = !verified; // une pièce validée, mais il manque encore l'autre (pièce ou selfie)
    await this.notifier.notifyUser(doc.user, partial
      ? { kind: 'PARTIAL', title: 'Pièce validée', body: `Votre ${DOC_LABEL[doc.type as KycDocType].toLowerCase()} est validée. Il reste à envoyer ${missingLabel(await this.missingNow(doc.userId))} pour finaliser la vérification.`, actionUrl: '/profile/kyc', actionLabel: "Vérification d'identité" }
      : { kind: 'APPROVED', title: 'Identité vérifiée ✅', body: levelRank(result.after) > levelRank(result.before) ? 'Votre identité est vérifiée. Vous pouvez maintenant envoyer de l\'argent, programmer des virements et retirer.' : `Votre ${DOC_LABEL[doc.type as KycDocType].toLowerCase()} est validée.`, actionUrl: '/profile/kyc', actionLabel: "Vérification d'identité" });

    return this.adminDossier(admin, doc.userId);
  }

  private async missingNow(userId: string): Promise<KycDocType[]> {
    const docs = await this.prisma.kycDocument.findMany({ where: { userId }, select: { type: true, status: true, expiryDate: true } });
    return missingForBasic(docs, new Date());
  }

  async reject(admin: AuthUserPayload, documentId: string, reason: string) {
    const doc = await this.loadForReview(admin, documentId);
    const clean = (reason ?? '').trim();
    if (clean.length < 5) throw new BadRequestException('Indiquez le motif du refus.');
    const now = new Date();
    const wasApproved = doc.status === 'APPROVED';
    if (doc.status !== 'PENDING' && !wasApproved) throw new ConflictException('Cette pièce a déjà été traitée.');

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.kycDocument.updateMany({
        where: { id: documentId, status: doc.status },
        data: { status: 'REJECTED', reviewedAt: now, reviewedById: admin.id, rejectionReason: clean },
      });
      if (claimed.count !== 1) throw new ConflictException('Cette pièce a déjà été traitée.');
      return this.applyLevel(tx, doc.userId, wasApproved, now);
    });

    await this.audit(admin.id, doc.user.clientId, 'KYC_REJECT', documentId, {
      userId: doc.userId, type: doc.type, reason: clean, revoked: wasApproved, levelBefore: result.before, levelAfter: result.after,
    });

    await this.notifier.notifyUser(doc.user, {
      kind: 'REJECTED',
      title: wasApproved ? "Pièce d'identité révoquée" : "Pièce d'identité refusée",
      body: `${wasApproved ? 'Votre' : 'Votre'} ${DOC_LABEL[doc.type as KycDocType].toLowerCase()} n'a pas pu être retenue. Motif : ${clean}\nEnvoyez-en une nouvelle depuis Profil › Vérification d'identité.`,
      actionUrl: '/profile/kyc',
      actionLabel: "Vérification d'identité",
      priority: 'HIGH',
    });

    return this.adminDossier(admin, doc.userId);
  }

  /** Rappel immédiat à un client (au plus un toutes les 12 heures). */
  async adminRemind(admin: AuthUserPayload, userId: string) {
    this.assertIsAdmin(admin);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'USER', deletedAt: null },
      select: { id: true, clientId: true, email: true, firstName: true, kycLevel: true, kycLastReminderAt: true, kycReminderCount: true },
    });
    if (!user) throw new NotFoundException('Client introuvable.');
    this.assertAdminScope(admin, user);
    const now = new Date();
    const docs = await this.prisma.kycDocument.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { type: true, status: true, expiryDate: true, rejectionReason: true } });
    // Vérifié = niveau ≥ 1 ET pièce d'identité encore valable : un client dont la pièce a expiré peut (doit) être relancé.
    if (levelRank(user.kycLevel) >= 1 && !identityLapsed(docs, now)) throw new ConflictException("L'identité de ce client est déjà vérifiée.");
    if (user.kycLastReminderAt && now.getTime() - user.kycLastReminderAt.getTime() < 12 * 3_600_000) {
      throw new HttpException('Un rappel a déjà été envoyé à ce client il y a moins de 12 heures.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const claimed = await this.prisma.user.updateMany({
      where: { id: user.id, kycLastReminderAt: user.kycLastReminderAt },
      data: { kycLastReminderAt: now, kycReminderCount: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new ConflictException('Un rappel vient d\'être envoyé.');

    await this.notifier.notifyUser(user, reminderMessage(overallStatus(user.kycLevel, docs, now), docs.find((d) => d.status === 'REJECTED')?.rejectionReason ?? null));
    await this.prisma.auditLog
      .create({ data: { userId: admin.id, clientId: user.clientId, action: 'KYC_REMIND', entity: 'User', entityId: user.id, details: { manual: true, reminderNumber: user.kycReminderCount + 1 }, successful: true } })
      .catch((err: Error) => this.logger.error(`Journal d'audit non écrit (relance KYC ${user.id}) : ${err.message}`));
    return { sent: true };
  }
}

function missingLabel(types: KycDocType[]): string {
  if (types.length === 0) return 'les pièces manquantes';
  return types.map((t) => (t === 'SELFIE' ? 'votre selfie' : 'votre pièce d\'identité')).join(' et ');
}
