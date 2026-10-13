// apps/backend/src/users/users.controller.ts
// =========================================================
// USERS CONTROLLER v4.6
// ✅ v4.6 (phase 6, passe 2) : PATCH /users/:id validé par UpdateUserDto (types et longueurs) et email normalisé en
//   minuscules. Avant : interface TypeScript sans contrôle à l'exécution — valeur non textuelle = erreur 500, email en
//   majuscules = compte qui ne pouvait plus se connecter.
// ✅ v4.5 : 🔒 FIX — élévation de privilèges d'un COMPANY_ADMIN
//
//   PROBLÈME RÉSOLU :
//   - POST /users laissait un COMPANY_ADMIN créer n'importe quel rôle,
//     SUPER_ADMIN compris (body.role n'était pas contrôlé).
//   - Un COMPANY_ADMIN pouvait modifier, suspendre, supprimer ses
//     collègues administrateurs de société... et lui-même.
//   - GET /users et GET /users/:id exposaient à un COMPANY_ADMIN les
//     comptes SUPER_ADMIN rattachés à sa société.
//   CORRECTIF :
//   - COMPANY_ADMIN : ne crée que des AGENT et des USER ; ne gère
//     (modifier / suspendre / réactiver / supprimer) que les AGENT et
//     USER de sa société ; peut seulement modifier SON propre profil.
//   - Personne ne peut se suspendre ni se supprimer soi-même.
//   - Un compte supprimé ne peut plus être modifié.
//   - Le corps de POST /users est validé (CreateUserDto) : l'interface
//     TypeScript d'avant ne valide rien à l'exécution.
//   Le rattachement d'un agent à une agence se fait via /agents-admin.
//
// ✅ v4.0-4.2 : toutes les routes admin (findAll, create, findById,
//   update, softDelete, suspend, reactivate, findPublic)
// ✅ v4.3 : Ajout GET /users/by-phone?q=775099993
//
//   PROBLÈME RÉSOLU :
//   Dans send.tsx, taper un numéro de téléphone ne retournait rien
//   si la personne n'était pas dans les bénéficiaires sauvegardés
//   de l'utilisateur. Pourtant elle pouvait être inscrite sur la
//   plateforme.
//
//   CORRECTIF :
//   Nouvelle route accessible à TOUT utilisateur authentifié
//   (pas de @Roles → RolesGuard laisse passer), scopée au même
//   clientId (tenant). Délègue à usersService.findByPhoneInTenant().
//   Ne retourne que les champs publics nécessaires au formulaire
//   d'envoi : id, firstName, lastName, phone, country, primaryCurrency.
//
//   ORDRE des routes :
//   'by-phone' est déclaré AVANT ':id' et 'public/:id' pour éviter
//   tout risque de capture par la route paramétrique générique.
//
// ✅ v4.4 : 🐛 FIX — findAll() ne filtrait pas deletedAt
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   Depuis qu'AgenciesService.remove() désactive ses agents en douceur
//   (deletedAt + isActive:false, voir agencies.service.ts v4.5) plutôt
//   que de les supprimer définitivement, ces comptes désactivés
//   continuent d'apparaître indéfiniment dans GET /users, aussi bien
//   pour un SUPER_ADMIN (whereClause: {}) qu'un COMPANY_ADMIN
//   (whereClause: { clientId }) — aucun des deux ne filtrait deletedAt.
//   Un agent désactivé depuis des mois resterait donc listé comme
//   n'importe quel compte actif dans l'écran de gestion des
//   utilisateurs.
//   CORRECTIF : deletedAt: null ajouté aux deux branches. N'affecte
//   QUE cette liste — findOne() (fiche détail d'un utilisateur
//   précis) reste volontairement inchangé : un admin qui clique
//   explicitement sur un compte désactivé (ex. depuis l'historique
//   d'une transaction) doit pouvoir consulter sa fiche pour l'audit,
//   même s'il n'apparaît plus dans la liste générale.
// =========================================================

import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ─── RolesGuard inline ────────────────────────────────────
const ROLES_KEY = 'roles';
const Roles = (...roles: Role[]) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(ROLES_KEY, roles);
};

@Injectable()
class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user: AuthUserPayload = req.user;
    if (!user?.role) return false;
    return required.includes(user.role as Role);
  }
}

// ─── Règles de gestion des comptes ────────────────────────
type ManageAction = 'update' | 'suspend' | 'reactivate' | 'delete';

/** Rôles qu'un administrateur de société peut créer et gérer. */
const COMPANY_MANAGED_ROLES: readonly string[] = [Role.AGENT, Role.USER];

/**
 * Vérifie que `admin` peut effectuer `action` sur `target`, ou lève l'exception adaptée.
 * Un COMPANY_ADMIN ne voit jamais un SUPER_ADMIN (404) ; il ne touche qu'aux comptes
 * AGENT / USER de sa société, plus la modification de son propre profil.
 */
function assertCanManage(
  admin: AuthUserPayload,
  target: { id: string; role: string; clientId: number | null; deletedAt?: Date | null },
  action: ManageAction,
): void {
  const isSelf = target.id === admin.id;

  if ((action === 'suspend' || action === 'delete') && isSelf) {
    throw new ForbiddenException('Vous ne pouvez pas suspendre ni supprimer votre propre compte.');
  }

  if (admin.role === 'SUPER_ADMIN') return;

  if (target.role === Role.SUPER_ADMIN) throw new NotFoundException('Utilisateur introuvable');

  if (target.clientId !== admin.clientId) {
    throw new ForbiddenException(
      'Accès refusé : cet utilisateur n\'appartient pas à votre société.',
    );
  }

  if (action === 'update' && isSelf) return;

  if (!COMPANY_MANAGED_ROLES.includes(target.role)) {
    throw new ForbiddenException(
      'Seul le super administrateur peut gérer un administrateur de société.',
    );
  }
}

async function loadAndAssert(
  admin: AuthUserPayload,
  userId: string,
  action: ManageAction,
  usersService: UsersService,
): Promise<void> {
  const target = await usersService.findById(userId);
  if (!target) throw new NotFoundException('Utilisateur introuvable');
  assertCanManage(admin, target, action);
  if (action === 'update' && target.deletedAt) {
    throw new NotFoundException('Ce compte a été supprimé');
  }
}

// ─── Controller ───────────────────────────────────────────
@ApiTags('Utilisateurs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ──────────────────────────────────────────────────────
  // GET /users — Liste
  // ✅ v4.4 — FIX : deletedAt: null ajouté (voir changelog en tête de fichier)
  // ──────────────────────────────────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  async findAll(@Req() req: { user?: AuthUserPayload }) {
    const user = req.user;
    const whereClause =
      user?.role === 'SUPER_ADMIN'
        ? { deletedAt: null }
        : { clientId: user?.clientId, deletedAt: null, role: { not: Role.SUPER_ADMIN } };
    return this.usersService.findAll(whereClause);
  }

  // ──────────────────────────────────────────────────────
  // POST /users — Créer
  // ──────────────────────────────────────────────────────
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  async create(
    @Req() req: { user?: AuthUserPayload },
    @Body() body: CreateUserDto,
  ) {
    const currentUser = req.user;
    const isSuper = currentUser?.role === 'SUPER_ADMIN';

    const role = body.role ?? Role.AGENT;
    if (!isSuper && !COMPANY_MANAGED_ROLES.includes(role)) {
      throw new ForbiddenException(
        'Un administrateur de société ne peut créer que des agents et des clients.',
      );
    }

    const targetClientId = isSuper
      ? body.clientId ?? currentUser?.clientId
      : currentUser?.clientId;

    if (!targetClientId) {
      throw new ConflictException('Impossible de déterminer la société cible.');
    }

    const existing = await this.usersService.findByEmail(body.email);
    if (existing) throw new ConflictException('Cet email est déjà utilisé.');

    const hashedPassword = await bcrypt.hash(body.password, 10);

    return this.usersService.create(
      body.email,
      hashedPassword,
      role,
      targetClientId,
      {
        firstName: body.firstName,
        lastName:  body.lastName,
        phone:     body.phone,
        country:   body.country,
      },
    );
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.3 — GET /users/by-phone?q=775099993
  //
  // Recherche un utilisateur de la plateforme par numéro de téléphone.
  // Accessible à TOUT utilisateur authentifié (pas de @Roles).
  // Utilisé par send.tsx pour auto-détecter un destinataire lors
  // de la saisie du numéro, même s'il n'est pas encore sauvegardé
  // comme bénéficiaire.
  //
  // Scopé au même clientId → un CLIENT ne peut pas trouver un user
  // d'une autre société.
  //
  // ⚠️ Déclaré EN PREMIER, AVANT toutes les routes paramétriques
  // (:id, public/:id, :id/suspend, :id/reactivate) pour éviter tout
  // conflit de capture par NestJS.
  // ──────────────────────────────────────────────────────
  @Get('by-phone')
  @ApiOperation({ summary: 'Trouver un utilisateur de la plateforme par téléphone' })
  @ApiQuery({ name: 'q', description: 'Numéro de téléphone (chiffres uniquement ou avec indicatif)', example: '775099993' })
  async findByPhone(
    @Req() req: { user?: AuthUserPayload },
    @Query('q') q: string,
  ) {
    if (!q || q.replace(/\D/g, '').length < 6) {
      return null;
    }

    const clientId = req.user?.clientId;
    if (!clientId) return null;

    return this.usersService.findByPhoneInTenant(q, clientId);
  }

  // ──────────────────────────────────────────────────────
  // PATCH /users/:id/suspend
  // ──────────────────────────────────────────────────────
  @Patch(':id/suspend')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Suspendre un compte utilisateur' })
  async suspend(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    await loadAndAssert(req.user!, id, 'suspend', this.usersService);
    return this.usersService.suspend(id, reason);
  }

  // ──────────────────────────────────────────────────────
  // PATCH /users/:id/reactivate
  // ──────────────────────────────────────────────────────
  @Patch(':id/reactivate')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Réactiver un compte utilisateur' })
  async reactivate(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    await loadAndAssert(req.user!, id, 'reactivate', this.usersService);
    return this.usersService.reactivate(id);
  }

  // ──────────────────────────────────────────────────────
  // GET /users/public/:id (inchangé v4.2)
  // ──────────────────────────────────────────────────────
  @Get('public/:id')
  @ApiOperation({ summary: 'Résoudre l\'identité publique d\'un utilisateur (QR / P2P)' })
  async findPublic(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    const target = await this.usersService.findById(id);
    if (!target || !target.isActive || target.deletedAt) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (target.clientId !== req.user?.clientId) {
      throw new ForbiddenException(
        'Cet utilisateur n\'appartient pas à votre société.',
      );
    }
    return {
      id:              target.id,
      firstName:       target.firstName,
      lastName:        target.lastName,
      phone:           target.phone,
      primaryCurrency: target.primaryCurrency,
    };
  }

  // ──────────────────────────────────────────────────────
  // GET /users/:id
  // ⚠️ Volontairement SANS filtre deletedAt — voir changelog v4.4 en
  // tête de fichier (consultation ponctuelle d'un compte désactivé
  // toujours possible pour l'audit, contrairement à findAll()).
  // ──────────────────────────────────────────────────────
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Obtenir la fiche complète d\'un utilisateur' })
  async findOne(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (req.user?.role !== 'SUPER_ADMIN') {
      if (user.role === Role.SUPER_ADMIN) throw new NotFoundException('Utilisateur introuvable');
      if (user.clientId !== req.user?.clientId) throw new ForbiddenException('Accès refusé');
    }

    return this.usersService.serializeForAdmin(user);
  }

  // ──────────────────────────────────────────────────────
  // PATCH /users/:id
  // ──────────────────────────────────────────────────────
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifier les infos d\'un utilisateur' })
  async update(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    await loadAndAssert(req.user!, id, 'update', this.usersService);

    const allowed: UpdateUserDto = {
      firstName:           body.firstName,
      lastName:            body.lastName,
      email:               body.email?.trim().toLowerCase(), // v4.6 : la connexion cherche l'email en minuscules
      phone:               body.phone,
      city:                body.city,
      country:             body.country,
      gender:              body.gender,
      birthDate:           body.birthDate,
      nationality:         body.nationality,
      addressStreet:       body.addressStreet,
      postalCode:          body.postalCode,
      mobileMoneyOperator: body.mobileMoneyOperator,
      mobileMoneyNumber:   body.mobileMoneyNumber,
    };

    const clean = Object.fromEntries(
      Object.entries(allowed).filter(([, v]) => v !== undefined),
    );

    return this.usersService.update(id, clean);
  }

  // ──────────────────────────────────────────────────────
  // DELETE /users/:id
  // ──────────────────────────────────────────────────────
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Supprimer (soft) un compte utilisateur' })
  async remove(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    await loadAndAssert(req.user!, id, 'delete', this.usersService);
    return this.usersService.softDelete(id);
  }
}