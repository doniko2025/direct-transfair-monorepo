// apps/backend/src/contracts/contracts.service.ts
// =========================================================
// CONTRATS v1.0 — émission, signature électronique, conservation et consultation (Grand Chef).
//
//   Émission    : issue() fige le texte du contrat (Contract.content) + une empreinte SHA-256, crée un jeton de signature
//                 (seul son hash est stocké) et, selon `notify`, envoie le lien par e-mail. À la création d'une société, le
//                 lien est joint au courriel de bienvenue (identifiants + signature) par ClientsService.
//   Signature   : sign() — lien public sans connexion, jeton de 256 bits, validité CONTRACT_SIGN_LINK_DAYS (30 par défaut).
//                 Le PDF signé (signature dessinée + certificat : nom, date, IP, empreinte) est produit AVANT la mise à jour,
//                 puis la ligne passe PENDING → SIGNED de façon atomique (une seule signature possible, même en double clic).
//                 Le contrat signé est ensuite envoyé par e-mail au signataire, avec copie au Prestataire.
//   Consultation: liste / détail / PDF réservés au SUPER_ADMIN (voir contracts.controller.ts).
//   Expiration  : paresseuse — un contrat PENDING dont le lien est échu est présenté EXPIRED ; « renvoyer le lien » le réactive.
// =========================================================

import {
  BadRequestException, ConflictException, GoneException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { platform } from '../common/platform.config';
import { ContractMailService } from '../mail/channels/contract-mail.service';
import { CONTRACT_TEMPLATE_VERSION, contractConfig } from './contract-config';
import { newSignToken, sha256Hex, stableStringify } from './contract-format';
import { renderContractPdf } from './contract-pdf';
import {
  buildContract, normalizeTerms,
  type ContractContent, type ContractKind, type ContractTerms,
} from './contract-templates';

export type EffectiveStatus = 'PENDING' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';

export interface IssueInput {
  clientId: number;
  kind?: ContractKind;
  terms: Partial<ContractTerms>;
  recipientEmail?: string;
  /** Envoi immédiat du lien par e-mail. Faux : l'appelant joint le lien à un autre courriel (bienvenue société). */
  notify: boolean;
  issuedById?: string | null;
}

export interface IssuedContract {
  id: string;
  reference: string;
  kind: ContractKind;
  label: string;
  signUrl: string | null;
  token: string;
  expiresAt: Date;
  recipientEmail: string;
  recipientName: string | null;
}

export const contractLabel = (kind: ContractKind) =>
  kind === 'RENTAL' ? "contrat de location de l'application" : "contrat d'achat de l'application";

const MAX_SIGNATURE_BYTES = 60_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: ContractMailService,
  ) {}

  // ───────────────────────── Utilitaires ─────────────────────────

  signUrl(token: string): string | null {
    const base = platform.appUrl;
    return base ? `${base}/signature/${token}` : null;
  }

  private effectiveStatus(c: { status: string; tokenExpiresAt: Date }): EffectiveStatus {
    if (c.status === 'PENDING' && c.tokenExpiresAt.getTime() <= Date.now()) return 'EXPIRED';
    return c.status as EffectiveStatus;
  }

  private async nextReference(attempt: number): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.contract.count({ where: { reference: { startsWith: `CT-${year}-` } } });
    return `CT-${year}-${String(count + 1 + attempt).padStart(4, '0')}`;
  }

  private tokenExpiry(): Date {
    return new Date(Date.now() + contractConfig.signLinkDays * 24 * 60 * 60 * 1000);
  }

  private async audit(userId: string | null | undefined, clientId: number, event: string, entityId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          clientId,
          action: 'CLIENT_UPDATE',
          entity: 'Contract',
          entityId,
          details: { event, ...details } as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.warn(`Journal d'audit non écrit (contrat ${entityId}, ${event}) : ${(err as Error).message}`);
    }
  }

  // ───────────────────────── Émission ─────────────────────────

  async issue(input: IssueInput): Promise<IssuedContract> {
    const client = await this.prisma.client.findFirst({ where: { id: input.clientId, deletedAt: null } });
    if (!client) throw new NotFoundException('Société introuvable.');

    const kind: ContractKind = input.kind ?? (client.subscriptionType === 'PURCHASE' ? 'PURCHASE' : 'RENTAL');
    const amount = Number(input.terms.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Le montant du contrat est obligatoire (supérieur à 0).');
    }
    const today = new Date().toISOString().slice(0, 10);
    const terms = normalizeTerms(kind, { ...input.terms, effectiveDate: input.terms.effectiveDate || today });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(terms.effectiveDate) || Number.isNaN(new Date(terms.effectiveDate).getTime())) {
      throw new BadRequestException("La date d'effet du contrat est invalide.");
    }

    const recipientEmail = (input.recipientEmail || client.email || client.contactEmail || '').trim();
    if (!recipientEmail) throw new BadRequestException("Aucune adresse e-mail pour envoyer le contrat.");
    const recipientName = [client.ownerFirstName, client.ownerLastName].filter(Boolean).join(' ').trim() || client.representativeName || null;

    const pending = await this.prisma.contract.findFirst({ where: { clientId: client.id, status: 'PENDING' } });
    if (pending) {
      throw new ConflictException(
        `Un contrat (${pending.reference}) est déjà en attente de signature pour cette société : renvoyez le lien ou annulez-le avant d'en émettre un autre.`,
      );
    }

    const issuedAt = new Date();
    const { token, hash } = newSignToken();
    const expiresAt = this.tokenExpiry();

    let created: { id: string; reference: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const reference = await this.nextReference(attempt);
      const content = buildContract({
        kind,
        reference,
        issuedAt,
        terms,
        customer: {
          name: client.name,
          legalName: client.legalCompanyName,
          address: client.address ?? client.ownerAddress,
          city: client.city,
          country: client.country,
          email: recipientEmail,
          representativeName: recipientName || client.name,
        },
      });
      const contentHash = sha256Hex(stableStringify({ reference, kind, version: CONTRACT_TEMPLATE_VERSION, terms, content }));
      try {
        created = await this.prisma.contract.create({
          data: {
            reference,
            clientId: client.id,
            type: kind,
            version: CONTRACT_TEMPLATE_VERSION,
            terms: terms as unknown as Prisma.InputJsonValue,
            content: content as unknown as Prisma.InputJsonValue,
            contentHash,
            recipientEmail,
            recipientName,
            signTokenHash: hash,
            tokenExpiresAt: expiresAt,
            issuedById: input.issuedById ?? null,
          },
          select: { id: true, reference: true },
        });
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err; // référence déjà prise : on retente
      }
    }
    if (!created) throw new ConflictException("Impossible de réserver une référence de contrat, réessayez.");

    const issued: IssuedContract = {
      id: created.id,
      reference: created.reference,
      kind,
      label: contractLabel(kind),
      signUrl: this.signUrl(token),
      token,
      expiresAt,
      recipientEmail,
      recipientName,
    };

    await this.audit(input.issuedById, client.id, 'ISSUED', created.id, { reference: created.reference, kind, amount: terms.amount, currency: terms.currency });
    if (input.notify) await this.notifyRequest(issued, client.name, false);
    return issued;
  }

  /** Envoie (ou renvoie) le courriel avec le lien de signature et note la date d'envoi. */
  async notifyRequest(issued: IssuedContract, companyName: string, reminder: boolean): Promise<boolean> {
    if (!issued.signUrl) {
      this.logger.warn(`Contrat ${issued.reference} : aucune adresse publique du portail (PLATFORM_APP_URL / FRONTEND_URL) — lien de signature impossible à envoyer.`);
      return false;
    }
    try {
      await this.mail.sendSignatureRequest({
        email: issued.recipientEmail,
        recipientName: issued.recipientName,
        companyName,
        contractLabel: issued.label,
        reference: issued.reference,
        url: issued.signUrl,
        expiresAt: issued.expiresAt,
        reminder,
      });
      await this.markSent(issued.id, reminder);
      return true;
    } catch (err) {
      this.logger.warn(`Contrat ${issued.reference} : e-mail de signature non envoyé à ${issued.recipientEmail} — ${(err as Error).message}`);
      return false;
    }
  }

  /** Appelé par ClientsService une fois le courriel de bienvenue (avec le lien) parti. */
  async markSent(contractId: string, reminder = false): Promise<void> {
    await this.prisma.contract
      .update({
        where: { id: contractId },
        data: { sentAt: new Date(), ...(reminder ? { reminderCount: { increment: 1 } } : {}) },
      })
      .catch(() => undefined);
  }

  // ───────────────────────── Page publique de signature ─────────────────────────

  private async findByToken(token: string) {
    if (!token || token.length < 20 || token.length > 100) throw new NotFoundException('Lien de signature invalide.');
    const c = await this.prisma.contract.findUnique({
      where: { signTokenHash: sha256Hex(token) },
      include: { client: { select: { name: true } } },
    });
    if (!c) throw new NotFoundException('Lien de signature invalide.');
    return c;
  }

  async getPublic(token: string) {
    const c = await this.findByToken(token);
    const status = this.effectiveStatus(c);
    return {
      reference: c.reference,
      kind: c.type as ContractKind,
      status,
      canSign: status === 'PENDING',
      expiresAt: c.tokenExpiresAt,
      companyName: c.client.name,
      recipientName: c.recipientName,
      recipientEmail: c.recipientEmail,
      signedAt: c.signedAt,
      signerName: c.signerName,
      content: c.content as unknown as ContractContent,
    };
  }

  async getPublicPdf(token: string): Promise<{ buffer: Buffer; filename: string }> {
    const c = await this.findByToken(token);
    if (c.status === 'CANCELLED') throw new GoneException('Ce contrat a été annulé.');
    return this.pdfOf(c);
  }

  private async pdfOf(c: { reference: string; status: string; signedPdf: Uint8Array | null; content: Prisma.JsonValue }) {
    if (c.status === 'SIGNED' && c.signedPdf) {
      return { buffer: Buffer.from(c.signedPdf), filename: `contrat-${c.reference}-signe.pdf` };
    }
    const buffer = await renderContractPdf(c.content as unknown as ContractContent, null);
    return { buffer, filename: `contrat-${c.reference}-apercu.pdf` };
  }

  private decodeSignature(dataUrl: string): Buffer {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec((dataUrl ?? '').trim());
    if (!m) throw new BadRequestException('Signature invalide : dessinez votre signature puis réessayez.');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > MAX_SIGNATURE_BYTES) throw new BadRequestException('Signature trop volumineuse.');
    if (buf.length < 300 || !buf.subarray(0, 4).equals(PNG_MAGIC)) {
      throw new BadRequestException('Signature invalide : dessinez votre signature puis réessayez.');
    }
    return buf;
  }

  async sign(
    token: string,
    dto: { signerName: string; signature: string; accept: boolean },
    meta: { ip?: string | null; userAgent?: string | null },
  ) {
    const c = await this.findByToken(token);
    const status = this.effectiveStatus(c);
    if (status === 'SIGNED') throw new ConflictException('Ce contrat est déjà signé.');
    if (status === 'CANCELLED') throw new GoneException('Ce contrat a été annulé.');
    if (status === 'EXPIRED') throw new GoneException("Ce lien de signature a expiré. Demandez l'envoi d'un nouveau lien.");
    if (dto.accept !== true) throw new BadRequestException('Vous devez cocher « Lu et approuvé » pour signer.');

    const signerName = dto.signerName.replace(/\s+/g, ' ').trim();
    if (signerName.length < 3) throw new BadRequestException('Saisissez votre nom complet.');
    const signaturePng = this.decodeSignature(dto.signature);

    const signedAt = new Date();
    const ip = meta.ip?.slice(0, 64) ?? null;
    const userAgent = meta.userAgent?.slice(0, 300) ?? null;

    // Le PDF est produit avant l'écriture : si sa génération échoue, le contrat reste à signer.
    const pdf = await renderContractPdf(c.content as unknown as ContractContent, {
      signedAt,
      signerName,
      signerEmail: c.recipientEmail,
      signerIp: ip,
      signerUserAgent: userAgent,
      signaturePng,
      contentHash: c.contentHash,
    });

    const res = await this.prisma.contract.updateMany({
      where: { id: c.id, status: 'PENDING', tokenExpiresAt: { gt: signedAt } },
      data: {
        status: 'SIGNED',
        signedAt,
        signerName,
        signatureImage: dto.signature.trim(),
        signerIp: ip,
        signerUserAgent: userAgent,
        signedPdf: pdf,
        signedPdfHash: sha256Hex(pdf),
      },
    });
    if (res.count !== 1) throw new ConflictException('Ce contrat vient d\'être signé ou n\'est plus disponible.');

    await this.audit(null, c.clientId, 'SIGNED', c.id, { reference: c.reference, signerName, ip });
    void this.mailSigned(c.id).catch((err) => this.logger.warn(`Contrat ${c.reference} : envoi du contrat signé échoué — ${(err as Error).message}`));

    return { reference: c.reference, status: 'SIGNED' as const, signedAt };
  }

  /** Envoie le contrat signé au signataire, avec copie au Prestataire. */
  async mailSigned(contractId: string): Promise<void> {
    const c = await this.prisma.contract.findUnique({ where: { id: contractId }, include: { client: { select: { name: true } } } });
    if (!c || c.status !== 'SIGNED' || !c.signedPdf || !c.signedAt) throw new BadRequestException("Ce contrat n'est pas signé.");
    const pdf = Buffer.from(c.signedPdf);
    const label = contractLabel(c.type as ContractKind);

    await this.mail.sendSignedContract({
      email: c.recipientEmail,
      recipientName: c.recipientName,
      companyName: c.client.name,
      contractLabel: label,
      reference: c.reference,
      signedAt: c.signedAt,
      pdf,
    });
    const copy = contractConfig.copyEmail;
    if (copy && copy.toLowerCase() !== c.recipientEmail.toLowerCase()) {
      await this.mail
        .sendSignedCopyToProvider({
          to: copy,
          companyName: c.client.name,
          contractLabel: label,
          reference: c.reference,
          signerName: c.signerName ?? '',
          signedAt: c.signedAt,
          pdf,
        })
        .catch((err) => this.logger.warn(`Contrat ${c.reference} : copie au Prestataire non envoyée — ${(err as Error).message}`));
    }
    await this.prisma.contract.update({ where: { id: c.id }, data: { signedMailedAt: new Date() } });
  }

  // ───────────────────────── Espace Grand Chef (SUPER_ADMIN) ─────────────────────────

  private readonly listSelect = {
    id: true, reference: true, type: true, status: true, version: true, terms: true,
    recipientEmail: true, recipientName: true, tokenExpiresAt: true, sentAt: true, reminderCount: true,
    signedAt: true, signerName: true, signedMailedAt: true, cancelledAt: true, createdAt: true,
    client: { select: { id: true, name: true, code: true, logoUrl: true, primaryColor: true } },
  } satisfies Prisma.ContractSelect;

  async list(filter: { status?: string; clientId?: number; q?: string }) {
    const where: Prisma.ContractWhereInput = {};
    if (filter.clientId) where.clientId = filter.clientId;
    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { signerName: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.contract.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500, select: this.listSelect });
    const items = rows.map((r) => ({ ...r, status: this.effectiveStatus(r) }));
    const wanted = filter.status?.toUpperCase();
    return wanted && ['PENDING', 'SIGNED', 'CANCELLED', 'EXPIRED'].includes(wanted) ? items.filter((i) => i.status === wanted) : items;
  }

  async getOne(id: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id },
      select: {
        ...this.listSelect,
        content: true, contentHash: true, signatureImage: true, signerIp: true, signerUserAgent: true,
        signedPdfHash: true, cancelReason: true, issuedById: true,
      },
    });
    if (!c) throw new NotFoundException('Contrat introuvable.');
    return { ...c, status: this.effectiveStatus(c) };
  }

  async pdf(id: string) {
    const c = await this.prisma.contract.findUnique({ where: { id }, select: { reference: true, status: true, signedPdf: true, content: true } });
    if (!c) throw new NotFoundException('Contrat introuvable.');
    return this.pdfOf(c);
  }

  /** Nouveau lien (l'ancien cesse de fonctionner) + e-mail. Réactive un contrat dont le lien avait expiré. */
  async resendLink(id: string, userId: string) {
    const c = await this.prisma.contract.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
    if (!c) throw new NotFoundException('Contrat introuvable.');
    if (c.status === 'SIGNED') throw new ConflictException('Ce contrat est déjà signé.');
    if (c.status === 'CANCELLED') throw new ConflictException('Ce contrat a été annulé.');

    const { token, hash } = newSignToken();
    const expiresAt = this.tokenExpiry();
    await this.prisma.contract.update({ where: { id }, data: { signTokenHash: hash, tokenExpiresAt: expiresAt, status: 'PENDING' } });

    const issued: IssuedContract = {
      id: c.id,
      reference: c.reference,
      kind: c.type as ContractKind,
      label: contractLabel(c.type as ContractKind),
      signUrl: this.signUrl(token),
      token,
      expiresAt,
      recipientEmail: c.recipientEmail,
      recipientName: c.recipientName,
    };
    const emailed = await this.notifyRequest(issued, c.client.name, true);
    await this.audit(userId, c.clientId, 'LINK_RESENT', c.id, { reference: c.reference, emailed });
    return { signUrl: issued.signUrl, emailed, expiresAt, recipientEmail: c.recipientEmail };
  }

  async resendSigned(id: string, userId: string) {
    const c = await this.prisma.contract.findUnique({ where: { id }, select: { id: true, reference: true, status: true, clientId: true, recipientEmail: true } });
    if (!c) throw new NotFoundException('Contrat introuvable.');
    if (c.status !== 'SIGNED') throw new ConflictException("Ce contrat n'est pas encore signé.");
    await this.mailSigned(id);
    await this.audit(userId, c.clientId, 'SIGNED_COPY_RESENT', c.id, { reference: c.reference });
    return { ok: true, recipientEmail: c.recipientEmail };
  }

  async cancel(id: string, userId: string, reason?: string) {
    const c = await this.prisma.contract.findUnique({ where: { id }, select: { id: true, reference: true, status: true, clientId: true } });
    if (!c) throw new NotFoundException('Contrat introuvable.');
    if (c.status === 'SIGNED') throw new ConflictException('Un contrat signé ne peut pas être annulé.');
    if (c.status === 'CANCELLED') return { ok: true };
    await this.prisma.contract.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason?.trim() || null },
    });
    await this.audit(userId, c.clientId, 'CANCELLED', c.id, { reference: c.reference, reason: reason ?? null });
    return { ok: true };
  }
}
