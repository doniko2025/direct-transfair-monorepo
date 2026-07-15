// apps/backend/src/auth/jwt-auth.guard.ts
// =========================================================
// JWT AUTH GUARD v4.2
// ✅ v4.1 : Fix "Tenant mismatch" sur Railway :
//    - tenantClientId=0 (multi-db mode) → bypass le check
//    - tenantClientId=-1 (non résolu) → bypass le check
//    - SUPER_ADMIN → bypass global (inchangé)
//    - COMPANY_ADMIN avec clientId valide → check normal
//
// ✅ v4.2 : 🚨 FIX SÉCURITÉ — un token déjà émis restait valide
//     jusqu'à expiration même après désactivation du compte/société
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   Cette garde ne faisait QUE vérifier la signature/l'expiration du
//   JWT et la cohérence de ses claims (clientId vs tenant résolu) —
//   aucun accès base de données. Volontairement rapide (vérification
//   JWT pure), mais avec une conséquence directe : auth.service.ts
//   v5.5/v5.6 bloque bien deletedAt/isSuspended/client.isActive au
//   moment de la CONNEXION (login/loginByPhone/register/
//   refreshTokens), mais un access token déjà émis AVANT une
//   désactivation continuait de fonctionner normalement sur TOUTES
//   les routes protégées jusqu'à sa propre expiration (TTL 1h,
//   v5.0) — la désactivation d'un compte, d'un agent ou d'une société
//   entière n'avait donc aucun effet immédiat sur les sessions déjà
//   en cours.
//
//   CORRECTIF :
//   Ajout d'un lookup Prisma minimal (une seule ligne, par clé
//   primaire User.id — la recherche la plus rapide possible,
//   seulement 4 champs booléens/relation sélectionnés, pas l'objet
//   User complet) à CHAQUE requête authentifiée, avant tout autre
//   traitement. Si le compte est deletedAt/isSuspended, ou que sa
//   société (hors SUPER_ADMIN) a isActive:false, la requête est
//   rejetée immédiatement — quel que soit l'âge ou la validité
//   résiduelle du token. Le SUPER_ADMIN garde son bypass du matching
//   tenant (inchangé), mais passe désormais aussi par ce contrôle
//   deletedAt/isSuspended comme tout le monde — un compte SUPER_ADMIN
//   soft-supprimé (via UsersService.softDelete()) ne doit pas non
//   plus pouvoir continuer à opérer.
//   ⚠️ Compromis assumé : chaque requête authentifiée coûte désormais
//   un aller-retour DB supplémentaire (lookup par clé primaire,
//   donc déjà aussi rapide que possible côté Postgres/Neon). Étant
//   donné les enjeux financiers de l'app (révocation immédiate d'un
//   compte compromis ou d'une société désactivée), ce coût est jugé
//   justifié plutôt que de laisser une fenêtre résiduelle pouvant
//   aller jusqu'à 1h. Si ce coût devient mesurable en production,
//   la prochaine étape serait un cache court (quelques secondes,
//   Redis ou équivalent) sur ce lookup plutôt qu'un retour en arrière
//   complet — non implémenté ici faute de infrastructure de cache
//   confirmée disponible dans ce projet.
// =========================================================

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthUserPayload } from './types/auth-user-payload.type';
import type { TenantContext } from '../tenants/tenant-context';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayloadLike = {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  clientId?: number;
  agencyId?: string | null;
  primaryCurrency?: string | null;
};

type AuthenticatedRequest = Request & {
  user?: AuthUserPayload;
  tenantContext?: TenantContext;
};

function extractToken(req: Request): string {
  const rawHeader = req.headers['authorization'];

  if (!rawHeader || Array.isArray(rawHeader)) {
    throw new UnauthorizedException('Missing Authorization header');
  }

  const header = String(rawHeader).trim();
  if (!header) {
    throw new UnauthorizedException('Missing Authorization header');
  }

  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : header.trim();

  if (!token) {
    throw new UnauthorizedException('Invalid Authorization header');
  }

  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    // ✅ v4.2 — voir changelog en tête de fichier
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(req);

    try {
      const payload = this.jwt.verify<JwtPayloadLike>(token);

      const id = payload.sub ?? payload.id ?? payload.userId;
      if (!id) throw new UnauthorizedException('Invalid token payload');

      const clientId =
        typeof payload.clientId === 'number' ? payload.clientId : undefined;

      req.user = {
        id,
        sub: id,
        email: payload.email,
        role: payload.role,
        clientId,
        agencyId: payload.agencyId ?? null,
        primaryCurrency: payload.primaryCurrency ?? null,
      };

      // ✅ v4.2 — FIX (voir changelog en tête de fichier) : révocation
      // immédiate d'un compte/société désactivé, indépendamment de la
      // validité résiduelle du token. Lookup minimal par clé primaire.
      const dbUser = await this.prisma.user.findUnique({
        where:  { id },
        select: {
          deletedAt:   true,
          isSuspended: true,
          role:        true,
          client:      { select: { isActive: true } },
        },
      });

      if (!dbUser || dbUser.deletedAt) {
        throw new UnauthorizedException(
          'Ce compte a été désactivé. Reconnectez-vous ou contactez votre administrateur.',
        );
      }
      if (dbUser.isSuspended) {
        throw new UnauthorizedException('Ce compte est suspendu.');
      }
      // Le SUPER_ADMIN n'est pas rattaché à une société "cliente" au
      // sens produit — même exemption que auth.service.ts v5.6.
      if (
        dbUser.role !== 'SUPER_ADMIN' &&
        dbUser.client &&
        dbUser.client.isActive === false
      ) {
        throw new UnauthorizedException(
          'Cette société a été désactivée. Contactez votre administrateur.',
        );
      }

      // ✅ SUPER_ADMIN — bypass total du matching tenant (inchangé).
      // Passe désormais par les vérifications deletedAt/isSuspended
      // ci-dessus comme tout le monde, avant ce bypass.
      if (payload.role === 'SUPER_ADMIN') return true;

      // ✅ Tenant matching
      const tenantClientId = req.tenantContext?.clientId;

      // ✅ FIX v4.1 : on ne vérifie que si tenantClientId est un entier > 0
      // - tenantClientId=0  → mode multi-db (pas de clientId global fiable) → bypass
      // - tenantClientId=-1 → non résolu → bypass
      // - tenantClientId=undefined/null → middleware non passé → bypass
      // - tenantClientId>0 → single-db avec clientId résolu → on vérifie
      if (
        typeof tenantClientId === 'number' &&
        tenantClientId > 0
      ) {
        if (typeof clientId !== 'number') {
          throw new UnauthorizedException('Invalid token: missing clientId');
        }

        if (clientId !== tenantClientId) {
          // ✅ Log détaillé pour debug Railway (ne pas laisser en prod silencieux)
          console.error(
            `[JwtAuthGuard] Tenant mismatch — JWT clientId=${clientId} vs tenant clientId=${tenantClientId} | role=${payload.role} | userId=${id}`,
          );
          throw new UnauthorizedException(
            `Tenant mismatch (token clientId=${clientId}, tenant clientId=${tenantClientId}). ` +
            `Reconnectez-vous pour obtenir un nouveau token.`,
          );
        }
      }

      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}