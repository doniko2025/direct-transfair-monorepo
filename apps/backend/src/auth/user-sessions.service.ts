// apps/backend/src/auth/user-sessions.service.ts
// Sessions actives d'un utilisateur (écran « Appareils connectés » du web et du mobile).
//
// - Liste : uniquement les sessions ACTIVES et non expirées ; la session de l'appareil qui interroge est marquée `current`
//   (identifiant de session `sid` porté par le jeton d'accès).
// - Révocation d'une session : refusée (404) si elle n'appartient pas à l'utilisateur ou n'est plus active
//   (avant : réponse « succès » même pour un identifiant qui n'existait pas).
// - Révocation de toutes les autres sessions : « déconnecter tous mes autres appareils ».
// Une session révoquée est rejetée aussitôt par JwtAuthGuard (jeton d'accès) et par /auth/refresh (jeton de renouvellement).
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SessionView = {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  createdAt: Date;
  expiresAt: Date;
  current: boolean;
};

@Injectable()
export class UserSessionsService {
  private readonly logger = new Logger(UserSessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, currentSid?: string | null): Promise<SessionView[]> {
    const rows = await this.prisma.userSession.findMany({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      select: {
        id: true,
        device: true,
        ipAddress: true,
        userAgent: true,
        country: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const list = rows.map((r) => ({ ...r, current: !!currentSid && r.id === currentSid }));
    // L'appareil courant en premier, puis du plus récent au plus ancien.
    return list.sort((a, b) => Number(b.current) - Number(a.current));
  }

  async revoke(userId: string, sessionId: string, currentSid?: string | null): Promise<{ success: true; wasCurrent: boolean }> {
    const res = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (res.count === 0) throw new NotFoundException('Session introuvable ou déjà fermée.');
    await this.audit(userId, { sessionId, scope: 'one' });
    return { success: true, wasCurrent: !!currentSid && sessionId === currentSid };
  }

  async revokeOthers(userId: string, currentSid?: string | null): Promise<{ success: true; revoked: number }> {
    if (!currentSid) {
      // Ancien jeton sans identifiant de session : impossible de savoir quel appareil garder (et on ne veut pas déconnecter
      // celui qui fait la demande). Une reconnexion (ou le prochain renouvellement du jeton) corrige cela.
      throw new BadRequestException('Reconnectez-vous pour utiliser cette fonction.');
    }
    const res = await this.prisma.userSession.updateMany({
      where: { userId, status: 'ACTIVE', id: { not: currentSid } },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (res.count > 0) await this.audit(userId, { scope: 'others', revoked: res.count });
    return { success: true, revoked: res.count };
  }

  private async audit(userId: string, details: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { userId, clientId: null, action: AuditAction.DEVICE_REVOKE, details: details as any, successful: true },
      });
    } catch (e) {
      this.logger.warn('Audit log error (non-bloquant)', e as Error);
    }
  }
}
