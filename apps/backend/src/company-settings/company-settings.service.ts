// apps/backend/src/company-settings/company-settings.service.ts
// =========================================================
// COMPANY SETTINGS v1.0 — paramètres métier d'une société, réglés par son administrateur.
//
//   forClient()   valeurs APPLIQUÉES (défauts + surcharges) — lu par les services métier (envoi, retrait, frais…)
//   get()         écran « Paramètres » : valeurs appliquées, défauts, surcharges, options disponibles
//   update()      modification partielle (admin de société uniquement), journalisée
//   reset()       retour à tous les défauts (admin de société uniquement)
//   history()     journal des modifications
//
// Le super admin consulte, il ne modifie rien : ce sont les règles de la société.
// Un petit cache mémoire (20 s) évite une lecture en base à chaque envoi ; il est vidé à chaque modification faite sur
// cette instance, et expire seul sur les autres.
// =========================================================

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { FEE_METHODS } from '../fees-admin/fee-rules';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENCIES,
  LIMITS,
  RECHARGE_METHODS,
  SettingsValidationError,
  applyPatch,
  defaultSettings,
  mergeSettings,
  type CompanySettings,
  type CompanySettingsPatch,
} from './company-settings.logic';

export const SETTINGS_ENTITY = 'CompanySettings';
const CACHE_TTL_MS = 20_000;

const fullName = (u: { firstName: string | null; lastName: string | null; email: string } | null): string | null => {
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email;
};

const RECHARGE_LABEL: Record<(typeof RECHARGE_METHODS)[number], string> = {
  CARD: 'Carte bancaire',
  ORANGE_MONEY: 'Orange Money',
  SENDWAVE: 'Sendwave',
};

@Injectable()
export class CompanySettingsService {
  private readonly logger = new Logger(CompanySettingsService.name);
  private readonly cache = new Map<number, { at: number; value: CompanySettings }>();

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture pour les services métier ───────────────────

  /** Valeurs appliquées à cette société. Ne lève jamais : en cas de panne de lecture, les défauts s'appliquent. */
  async forClient(clientId: number): Promise<CompanySettings> {
    const hit = this.cache.get(clientId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
    try {
      const row = await this.prisma.companySetting.findUnique({ where: { clientId }, select: { data: true } });
      const value = mergeSettings(row?.data);
      this.cache.set(clientId, { at: Date.now(), value });
      return value;
    } catch (err) {
      this.logger.error(`Paramètres de la société ${clientId} illisibles, défauts appliqués : ${(err as Error).message}`);
      return defaultSettings();
    }
  }

  invalidate(clientId: number): void {
    this.cache.delete(clientId);
  }

  // ── Écran admin ────────────────────────────────────────

  private readScope(user: AuthUserPayload, clientId?: number): number {
    if (user.role === 'SUPER_ADMIN') {
      if (!clientId) throw new BadRequestException('Précisez la société (clientId).');
      return clientId;
    }
    if (!user.clientId) throw new ForbiddenException('Compte non rattaché à une société.');
    return user.clientId;
  }

  private requireCompanyAdmin(user: AuthUserPayload): number {
    if (user.role !== 'COMPANY_ADMIN' || !user.clientId) {
      throw new ForbiddenException("Seul l'administrateur de la société modifie ses paramètres.");
    }
    return user.clientId;
  }

  private async storedOf(clientId: number): Promise<{ data: CompanySettingsPatch; updatedAt: Date | null }> {
    const row = await this.prisma.companySetting.findUnique({ where: { clientId }, select: { data: true, updatedAt: true } });
    return { data: (row?.data ?? {}) as CompanySettingsPatch, updatedAt: row?.updatedAt ?? null };
  }

  private async view(clientId: number, editable: boolean) {
    const company = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, code: true } });
    if (!company) throw new NotFoundException('Société introuvable.');
    const stored = await this.storedOf(clientId);
    return {
      company,
      editable,
      settings: mergeSettings(stored.data),
      defaults: defaultSettings(),
      overridden: stored.data,
      updatedAt: stored.updatedAt ? stored.updatedAt.toISOString() : null,
      options: {
        feeMethods: FEE_METHODS.map((m) => ({ key: m.key, label: m.label })),
        rechargeMethods: RECHARGE_METHODS.map((key) => ({ key, label: RECHARGE_LABEL[key] })),
        currencies: CURRENCIES,
        limits: LIMITS,
      },
    };
  }

  async get(user: AuthUserPayload, clientId?: number) {
    const scope = this.readScope(user, clientId);
    return this.view(scope, user.role === 'COMPANY_ADMIN');
  }

  async update(user: AuthUserPayload, patch: unknown) {
    const clientId = this.requireCompanyAdmin(user);
    const stored = await this.storedOf(clientId);
    let next: CompanySettingsPatch;
    try {
      next = applyPatch(stored.data, patch);
    } catch (err) {
      if (err instanceof SettingsValidationError) throw new BadRequestException(err.message);
      throw err;
    }

    const before = mergeSettings(stored.data);
    const after = mergeSettings(next);
    if (JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(stored.data) === JSON.stringify(next)) {
      return this.view(clientId, true);
    }

    await this.prisma.companySetting.upsert({
      where: { clientId },
      create: { clientId, data: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
      update: { data: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
    });
    this.invalidate(clientId);

    await this.audit(user, clientId, before, after);
    return this.view(clientId, true);
  }

  async reset(user: AuthUserPayload) {
    const clientId = this.requireCompanyAdmin(user);
    const before = mergeSettings((await this.storedOf(clientId)).data);
    await this.prisma.companySetting.deleteMany({ where: { clientId } });
    this.invalidate(clientId);
    await this.audit(user, clientId, before, defaultSettings());
    return this.view(clientId, true);
  }

  /** La modification est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec. */
  private async audit(user: AuthUserPayload, clientId: number, from: CompanySettings, to: CompanySettings): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          clientId,
          action: 'COMMISSION_CONFIG_UPDATE',
          entity: SETTINGS_ENTITY,
          entityId: String(clientId),
          details: { from, to } as unknown as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (paramètres, société ${clientId}) : ${(err as Error).message}`);
    }
  }

  async history(user: AuthUserPayload, clientId: number | undefined, limit: number) {
    const scope = this.readScope(user, clientId);
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'COMMISSION_CONFIG_UPDATE', entity: SETTINGS_ENTITY, clientId: scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return {
      data: rows.map((r) => {
        const d = (r.details ?? {}) as { from?: unknown; to?: unknown };
        return { id: r.id, createdAt: r.createdAt.toISOString(), from: d.from ?? null, to: d.to ?? null, user: fullName(r.user) };
      }),
    };
  }
}
