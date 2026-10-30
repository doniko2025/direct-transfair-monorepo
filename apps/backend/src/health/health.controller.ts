// apps/backend/src/health/health.controller.ts
// =========================================================
// POINT DE CONTRÔLE DE SANTÉ v1.0 — GET /api/health
//
// À QUOI ÇA SERT
//   Un hébergeur économique (Render, plan gratuit) met le serveur en veille après ~15 min sans requête ; le réveil prend 30 à 60 s.
//   Un appel régulier (workflow GitHub `keep-alive.yml`, ou un service de ping gratuit) sur cette route garde le serveur éveillé.
//   Elle fait aussi un `SELECT 1` : la base de données (qui peut elle aussi s'endormir) reste réveillée, et l'appel échoue (503) si elle est
//   injoignable — un moniteur peut donc alerter sur une vraie panne, pas seulement sur un serveur arrêté.
//
// SÉCURITÉ
//   Publique et SANS tenant (déjà exclue du TenantMiddleware et du TenantGuard), hors limitation de débit. Ne renvoie AUCUNE donnée métier :
//   seulement « ok », l'état de la base, la durée de fonctionnement et l'heure.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Au-delà, la base est considérée injoignable (le moniteur voit un 503 plutôt qu'une attente infinie). */
const DB_TIMEOUT_MS = 8_000;

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    } finally {
      if (timer) clearTimeout(timer);
    }

    return {
      status: 'ok',
      db: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  }
}
