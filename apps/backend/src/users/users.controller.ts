// apps/backend/src/users/users.controller.ts
// =========================================================
// USERS CONTROLLER v4.0
// ✅ Import JwtAuthGuard depuis '../auth/jwt-auth.guard' (pas guards/)
// ✅ RolesGuard inline
// =========================================================

import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { UsersService } from './users.service';
// ✅ CORRECTION : chemin correct
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';

// ✅ RolesGuard inline
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

@ApiTags('Utilisateurs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  async findAll(@Req() req: { user?: AuthUserPayload }) {
    const user = req.user;
    const whereClause =
      user?.role === 'SUPER_ADMIN' ? {} : { clientId: user?.clientId };
    return this.usersService.findAll(whereClause);
  }

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
        lastName: body.lastName,
        phone: body.phone,
        country: body.country,
      },
    );
  }
}