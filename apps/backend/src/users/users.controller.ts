// apps/backend/src/users/users.controller.ts
// =========================================================
// USERS CONTROLLER v4.1
// ✅ v4.0 : GET /users, POST /users
// ✅ v4.1 : Ajout des 5 routes manquantes :
//   - GET  /users/:id           → fiche complète du client wallet
//   - PATCH /users/:id          → modification infos (nom, email, ville…)
//   - DELETE /users/:id         → soft delete (deletedAt + isActive=false)
//   - PATCH /users/:id/suspend  → suspension avec raison optionnelle
//   - PATCH /users/:id/reactivate → réactivation
//
//   ⚠️ ORDRE DES ROUTES NestJS :
//   Les routes à segments fixes (:id/suspend, :id/reactivate) sont
//   déclarées AVANT la route paramétrique générique (:id) pour éviter
//   tout conflit de capture — même si NestJS distingue déjà par le
//   nombre de segments, c'est une bonne pratique de l'expliciter.
//
//   ACCÈS :
//   - SUPER_ADMIN  : accès total (tous les clients)
//   - COMPANY_ADMIN : scoped à son clientId uniquement
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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

// ─── DTOs ─────────────────────────────────────────────────
interface CreateUserBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
  clientId?: number;
  phone?: string;
  country?: string;
}

interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  addressStreet?: string;
  postalCode?: string;
  mobileMoneyOperator?: string;
  mobileMoneyNumber?: string;
}

// ─── Helper : vérifie que le COMPANY_ADMIN accède à un user de son client ──
async function assertClientAccess(
  admin: AuthUserPayload,
  userId: string,
  usersService: UsersService,
): Promise<void> {
  if (admin.role === 'SUPER_ADMIN') return; // Accès total

  const target = await usersService.findById(userId);
  if (!target) throw new NotFoundException('Utilisateur introuvable');

  if (target.clientId !== admin.clientId) {
    throw new ForbiddenException(
      'Accès refusé : cet utilisateur n\'appartient pas à votre société.',
    );
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
  // GET /users — Liste tous les utilisateurs (scopé au client)
  // ──────────────────────────────────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  async findAll(@Req() req: { user?: AuthUserPayload }) {
    const user = req.user;
    const whereClause =
      user?.role === 'SUPER_ADMIN' ? {} : { clientId: user?.clientId };
    return this.usersService.findAll(whereClause);
  }

  // ──────────────────────────────────────────────────────
  // POST /users — Créer un utilisateur
  // ──────────────────────────────────────────────────────
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  async create(
    @Req() req: { user?: AuthUserPayload },
    @Body() body: CreateUserBody,
  ) {
    const currentUser = req.user;

    const targetClientId =
      currentUser?.role === 'SUPER_ADMIN'
        ? body.clientId ?? currentUser.clientId
        : currentUser?.clientId;

    if (!targetClientId) {
      throw new ConflictException(
        'Impossible de déterminer la société cible.',
      );
    }

    const existing = await this.usersService.findByEmail(body.email);
    if (existing) throw new ConflictException('Cet email est déjà utilisé.');

    const hashedPassword = await bcrypt.hash(body.password, 10);

    return this.usersService.create(
      body.email,
      hashedPassword,
      body.role ?? Role.AGENT,
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
  // ✅ v4.1 — PATCH /users/:id/suspend
  // Déclaré AVANT PATCH :id pour éviter tout conflit de capture
  // ──────────────────────────────────────────────────────
  @Patch(':id/suspend')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Suspendre un compte utilisateur' })
  async suspend(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    await assertClientAccess(req.user!, id, this.usersService);
    return this.usersService.suspend(id, reason);
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.1 — PATCH /users/:id/reactivate
  // Déclaré AVANT PATCH :id pour éviter tout conflit de capture
  // ──────────────────────────────────────────────────────
  @Patch(':id/reactivate')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Réactiver un compte utilisateur' })
  async reactivate(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    await assertClientAccess(req.user!, id, this.usersService);
    return this.usersService.reactivate(id);
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.1 — GET /users/:id
  // Fiche complète : infos, wallets, agency, client
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

    // COMPANY_ADMIN : accès uniquement aux users de son propre client
    if (
      req.user?.role !== 'SUPER_ADMIN' &&
      user.clientId !== req.user?.clientId
    ) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.usersService.serializeForAdmin(user);
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.1 — PATCH /users/:id
  // Modification des infos personnelles (nom, email, téléphone, ville…)
  // Ne touche PAS au mot de passe, rôle, clientId, agencyId
  // ──────────────────────────────────────────────────────
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modifier les infos d\'un utilisateur' })
  async update(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
    @Body() body: UpdateUserBody,
  ) {
    await assertClientAccess(req.user!, id, this.usersService);

    // Champs autorisés uniquement — jamais rôle / mot de passe / clientId
    const allowed: UpdateUserBody = {
      firstName:           body.firstName,
      lastName:            body.lastName,
      email:               body.email,
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

    // Supprime les clés undefined pour ne pas écraser des données existantes
    const clean = Object.fromEntries(
      Object.entries(allowed).filter(([, v]) => v !== undefined),
    );

    return this.usersService.update(id, clean);
  }

  // ──────────────────────────────────────────────────────
  // ✅ v4.1 — DELETE /users/:id
  // Soft delete : marque deletedAt + isActive=false
  // Les données sont conservées (conformité réglementaire)
  // ──────────────────────────────────────────────────────
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Supprimer (soft) un compte utilisateur' })
  async remove(
    @Req() req: { user?: AuthUserPayload },
    @Param('id') id: string,
  ) {
    await assertClientAccess(req.user!, id, this.usersService);
    return this.usersService.softDelete(id);
  }
}