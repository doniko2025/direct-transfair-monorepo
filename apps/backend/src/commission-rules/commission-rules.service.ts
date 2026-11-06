// apps/backend/src/commission-rules/commission-rules.service.ts
// =========================================================
// COMMISSION RULES v1.1 — répartition des frais d'un retrait payé
//   ✅ v1.1 : les parts « par défaut » viennent des paramètres de la société (plus de 40/20/40 écrits en dur) ; set() est atomique
//   (verrou par société + combinaison) : deux enregistrements simultanés ne créent plus deux lignes.
//
//   get()      : les 6 combinaisons (type de l'expéditeur × type de l'agence payeuse) avec leurs parts
//   set()      : modifie une combinaison (admin de société uniquement)
//   history()  : journal des modifications
//
// Même ligne en base que celle lue par withdrawals.service.ts (CommissionConfig, payoutMethod null) et par
// l'application mobile : aucun doublon de données. Le super admin consulte, il ne modifie rien.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { hasAtMostTwoDecimals } from '../fees-admin/fee-rules';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEST_TYPES,
  SOURCE_TYPES,
  effectiveShares,
  type DestType,
  type Shares,
  type SourceType,
} from './commission-rule-defaults';
import type { SetSplitDto } from './dto/commission-rule.dto';

interface SplitRow {
  sourceType: string;
  destType: string;
  senderShare: number;
  payerShare: number;
  platformShare: number;
  updatedAt: Date;
}

export interface SplitView extends Shares {
  sourceType: SourceType;
  destType: DestType;
  /** Une ligne existe en base. Sinon ce sont les parts par défaut de la société (paramètres) qui s'appliquent. */
  configured: boolean;
  /** Parts réellement perçues (pour un client expéditeur, la part d'envoi revient à la société). */
  effective: Shares;
  updatedAt: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const fullName = (u: { firstName: string | null; lastName: string | null; email: string } | null): string | null => {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
};

function viewOf(source: SourceType, dest: DestType, row: SplitRow | undefined, fallback: Shares): SplitView {
  const raw: Shares = row
    ? { senderShare: row.senderShare, payerShare: row.payerShare, platformShare: row.platformShare }
    : { ...fallback };
  return {
    sourceType: source,
    destType: dest,
    ...raw,
    configured: Boolean(row),
    effective: effectiveShares(source, raw),
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

@Injectable()
export class CommissionRulesService {
  private readonly logger = new Logger(CommissionRulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CompanySettingsService,
  ) {}

  /** Parts appliquées tant qu'aucune ligne n'existe : le réglage « répartition par défaut » de la société. */
  private async fallbackOf(clientId: number): Promise<Shares> {
    const d = (await this.settings.forClient(clientId)).commissions.defaultSplit;
    return { senderShare: d.senderShare, payerShare: d.payerShare, platformShare: d.platformShare };
  }

  private readScope(user: AuthUserPayload, clientId?: number): number {
    if (user.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private rowsOf(clientId: number): Promise<SplitRow[]> {
    return this.prisma.commissionConfig.findMany({
      where: { clientId, payoutMethod: null },
      select: { sourceType: true, destType: true, senderShare: true, payerShare: true, platformShare: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }) as unknown as Promise<SplitRow[]>;
  }

  private viewsOf(rows: readonly SplitRow[], fallback: Shares): SplitView[] {
    const out: SplitView[] = [];
    for (const source of SOURCE_TYPES) {
      for (const dest of DEST_TYPES) {
        // Les lignes sont triées de la plus récente à la plus ancienne : on garde la dernière modifiée.
        out.push(viewOf(source, dest, rows.find((r) => r.sourceType === source && r.destType === dest), fallback));
      }
    }
    return out;
  }

  async get(user: AuthUserPayload, clientId?: number) {
    const scope = this.readScope(user, clientId);
    const company = await this.prisma.client.findUnique({ where: { id: scope }, select: { id: true, name: true, code: true } });
    if (!company) throw new NotFoundException('Société introuvable.');
    return { company, editable: user.role === 'COMPANY_ADMIN', rules: this.viewsOf(await this.rowsOf(scope), await this.fallbackOf(scope)) };
  }

  async set(user: AuthUserPayload, rawSource: string, rawDest: string, dto: SetSplitDto): Promise<SplitView> {
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException("Seul l'administrateur de la société modifie la répartition de ses frais.");
    }
    const clientId = user.clientId;

    const source = String(rawSource ?? '').toUpperCase() as SourceType;
    const dest = String(rawDest ?? '').toUpperCase() as DestType;
    if (!SOURCE_TYPES.includes(source)) throw new BadRequestException(`Expéditeur inconnu : « ${rawSource} ».`);
    if (!DEST_TYPES.includes(dest)) throw new BadRequestException(`Agence payeuse inconnue : « ${rawDest} ».`);

    if (!hasAtMostTwoDecimals(dto.senderShare) || !hasAtMostTwoDecimals(dto.payerShare)) {
      throw new BadRequestException('Deux décimales au maximum.');
    }
    if (source === 'WALLET' && dto.senderShare !== 0) {
      throw new BadRequestException("Un client n'a pas d'agence d'envoi : sa part revient à la société. Laissez la part d'envoi à 0.");
    }
    const platformShare = round2(100 - dto.senderShare - dto.payerShare);
    if (platformShare < 0) throw new BadRequestException('La somme des parts ne peut pas dépasser 100 %.');

    const fallback = await this.fallbackOf(clientId);
    const rows = await this.rowsOf(clientId);
    const before = viewOf(source, dest, rows.find((r) => r.sourceType === source && r.destType === dest), fallback);
    if (before.configured && before.senderShare === dto.senderShare && before.payerShare === dto.payerShare && before.platformShare === platformShare) {
      return before;
    }

    const where = { clientId, sourceType: source, destType: dest, payoutMethod: null } as Prisma.CommissionConfigWhereInput;
    const data = { senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare };
    // ✅ v1.1 : mise à jour atomique. La contrainte unique de la table ignore les lignes dont la devise est NULL : sans verrou,
    // deux enregistrements simultanés pouvaient créer deux lignes. Verrou de transaction par société + combinaison.
    // updateMany : si d'anciennes lignes en double existent (withdrawals.service lit la plus récente), elles restent cohérentes.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`split:${clientId}:${source}:${dest}`}))`;
      const updated = await tx.commissionConfig.updateMany({ where, data });
      if (updated.count === 0) {
        await tx.commissionConfig.create({
          data: { clientId, sourceType: source, destType: dest, ...data, description: `SPLIT:${source}:${dest}` },
        });
      }
    });

    // La modification est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec.
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'COMMISSION_CONFIG_UPDATE',
          entity: 'SplitRule',
          entityId: `${source}:${dest}`,
          details: {
            sourceType: source,
            destType: dest,
            from: { senderShare: before.senderShare, payerShare: before.payerShare, platformShare: before.platformShare, configured: before.configured },
            to: { ...data },
          } as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (répartition ${source}:${dest}, société ${clientId}) : ${(err as Error).message}`);
    }

    return viewOf(source, dest, (await this.rowsOf(clientId)).find((r) => r.sourceType === source && r.destType === dest), fallback);
  }

  async history(user: AuthUserPayload, clientId: number | undefined, limit: number) {
    const scope = this.readScope(user, clientId);
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'COMMISSION_CONFIG_UPDATE', entity: 'SplitRule', clientId: scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return {
      data: rows.map((r) => {
        const d = (r.details ?? {}) as { sourceType?: string; destType?: string; from?: unknown; to?: unknown };
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          sourceType: d.sourceType ?? null,
          destType: d.destType ?? null,
          from: d.from ?? null,
          to: d.to ?? null,
          user: fullName(r.user),
        };
      }),
    };
  }
}
