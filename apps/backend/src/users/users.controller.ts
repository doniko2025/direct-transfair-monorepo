//apps/backend/src/users/users.controller.ts
import { Controller, Get, Post, Body, UseGuards, Request, ConflictException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import * as bcrypt from 'bcryptjs';

// ✅ Interface pour typer le corps de la requête (plus d'erreur "any")
interface CreateUserBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
  clientId?: number;
  phone?: string;
}

@ApiTags('Utilisateurs (Gestion)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 🔹 LISTER
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  async findAll(@Request() req: any) {
    const user = req.user;
    // Si Super Admin, voit tout. Sinon, voit uniquement sa société.
    const whereClause = user.role === Role.SUPER_ADMIN ? {} : { clientId: user.clientId };

    return this.usersService.findAll(whereClause);
  }

  // 🔹 CRÉER
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  async create(@Request() req: any, @Body() body: CreateUserBody) {
    const currentUser = req.user;

    // 1. Déterminer la société cible
    // Si Super Admin : on prend l'ID envoyé, sinon le sien.
    // Si Admin Société : on force le sien.
    const targetClientId = currentUser.role === Role.SUPER_ADMIN 
        ? (body.clientId || currentUser.clientId) 
        : currentUser.clientId;

    if (!targetClientId) {
        throw new ConflictException("Impossible de déterminer la société cible.");
    }

    // 2. Vérifier si l'email existe
    const existing = await this.usersService.findByEmail(body.email);
    if (existing) throw new ConflictException("Cet email est déjà utilisé.");

    // 3. Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // 4. Appel au Service
    return this.usersService.create(
        body.email,
        hashedPassword,
        body.role || Role.AGENT,
        targetClientId,
        {
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone
        }
    );
  }
}