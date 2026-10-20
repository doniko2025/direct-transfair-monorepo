// apps/backend/src/auth/platform-sso.service.ts
// =========================================================
// ✅ v1.1 (phase 7) : émetteur et destinataire de l'assertion (PLATFORM_SSO_ISSUER / PLATFORM_SSO_AUDIENCE) et nom de marque du message lus dans la configuration plateforme.
// CONNEXION UNIQUE DEPUIS LA CONSOLE dkmoney.store v1.1
//
// Le Grand Chef s'authentifie UNE fois sur la console (Assograndchef). Pour ouvrir le
// back-office Direct Transf'air sans retaper son mot de passe, la console signe une
// assertion JWT (HS256) de 60 secondes avec un secret PARTAGÉ (PLATFORM_SSO_SECRET), que
// ce service vérifie. Sens unique : Direct Transf'air ne fait jamais confiance à autre chose
// qu'une assertion valide et inédite, puis ouvre SA PROPRE session (mêmes jetons que le login).
//
// Garde-fous :
//   - PLATFORM_SSO_SECRET absent ou < 32 caractères  ⇒ route fermée (404), comme les secrets des crons ;
//   - algorithme HS256 imposé, émetteur et audience contrôlés, durée de vie ≤ 120 s ;
//   - identifiant d'assertion (jti) à usage unique, enregistré en base (anti-rejeu, multi-instances) ;
//   - seul un compte SUPER_ADMIN actif, non verrouillé, à e-mail vérifié peut être ouvert ;
//   - PLATFORM_SSO_ALLOWED_EMAILS (facultatif) restreint encore la liste des comptes autorisés ;
//   - l'en-tête x-app-client: web reste exigé (même règle que le login du portail).
// Aucun mot de passe n'est jamais lu ni modifié ici.
// =========================================================

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { assertAppClientAllowed } from './app-client.policy';
import { V2AuthService } from './v2-auth.service';
import { platform } from '../common/platform.config';

// ✅ v1.1 (phase 7) : émetteur / destinataire attendus pilotés par PLATFORM_SSO_ISSUER / PLATFORM_SSO_AUDIENCE
//   (défauts identiques à avant). Lus à chaque appel : exportés pour la spec comme valeurs par défaut.
export const SSO_ISSUER = 'dkmoney-console';
export const SSO_AUDIENCE = 'direct-transfair';
const MAX_LIFETIME_SECONDS = 120;
const MIN_SECRET_LENGTH = 32;

interface SsoClaims {
  email?: unknown;
  jti?: unknown;
  sub?: unknown;
  iat?: number;
  exp?: number;
}

/** Secret partagé, ou null si la fonction n'est pas configurée. */
export function ssoSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = (env.PLATFORM_SSO_SECRET ?? '').trim();
  return s.length >= MIN_SECRET_LENGTH ? s : null;
}

/** Liste facultative des e-mails autorisés (minuscules). Vide = pas de restriction supplémentaire. */
export function allowedSsoEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env.PLATFORM_SSO_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

@Injectable()
export class PlatformSsoService {
  private readonly logger = new Logger(PlatformSsoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly v2Auth: V2AuthService,
  ) {}

  async login(assertion: string, appClient?: string | null) {
    const secret = ssoSecret();
    if (!secret) throw new NotFoundException(); // fonction non configurée : la route n'existe pas

    // 1) Signature, algorithme, émetteur, audience, expiration.
    let claims: SsoClaims;
    try {
      claims = this.jwt.verify<SsoClaims>(assertion, {
        secret,
        algorithms: ['HS256'],
        issuer: platform.ssoIssuer,
        audience: platform.ssoAudience,
      });
    } catch {
      throw new UnauthorizedException('Assertion invalide ou expirée.');
    }

    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const jti = typeof claims.jti === 'string' ? claims.jti : '';
    if (!email || jti.length < 16 || jti.length > 100 || !claims.iat || !claims.exp) {
      throw new UnauthorizedException('Assertion incomplète.');
    }
    if (claims.exp - claims.iat > MAX_LIFETIME_SECONDS) {
      throw new UnauthorizedException("Durée de vie de l'assertion trop longue.");
    }

    // 2) Restriction facultative par liste blanche.
    const allowed = allowedSsoEmails();
    if (allowed.size > 0 && !allowed.has(email)) {
      this.logger.warn(`SSO refusé : ${email} hors liste autorisée`);
      throw new ForbiddenException("Ce compte n'est pas autorisé à utiliser la connexion unique.");
    }

    // 3) Compte Direct Transf'air correspondant : SUPER_ADMIN uniquement.
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { client: true, agency: true, wallets: { where: { isActive: true } } },
    });
    const ok =
      !!user &&
      user.role === Role.SUPER_ADMIN &&
      !user.deletedAt &&
      user.isActive &&
      !user.isSuspended &&
      user.isEmailVerified &&
      !(user.lockedUntil && user.lockedUntil > new Date());
    if (!ok) {
      this.logger.warn(`SSO refusé : aucun SUPER_ADMIN actif pour ${email}`);
      throw new ForbiddenException(
        `Aucun compte Super Admin actif de ${platform.name} ne correspond à ton adresse e-mail.`,
      );
    }

    // 4) Même règle que le login : les comptes « web » exigent x-app-client: web.
    assertAppClientAllowed(user.role, appClient);

    // 5) Anti-rejeu : l'assertion ne sert qu'une fois (contrainte d'unicité en base).
    await this.prisma.platformSsoAssertion
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => undefined);
    try {
      await this.prisma.platformSsoAssertion.create({
        data: { jti, subject: email, expiresAt: new Date(claims.exp * 1000 + 60_000) },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        this.logger.warn(`SSO rejeu bloqué pour ${email}`);
        throw new UnauthorizedException('Assertion déjà utilisée.');
      }
      throw e;
    }

    return this.v2Auth.completeSsoLogin(user, platform.ssoIssuer);
  }
}
