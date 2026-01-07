//apps/backend/src/users/users.controller.ts
import { Controller, Get, Post, Body, UseGuards, Request, ConflictException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// ✅ Import du DTO qu'on vient de créer
import { CreateUserDto } from './dto/create-user.dto';

// ✅ Définition du type pour la Requête (plus de "any" !)
interface RequestWithUser {
  user: {
    id: string;
    email: string;
    role: Role;
    clientId: number;
  };
}

@ApiTags('Utilisateurs (Gestion)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  // 🔹 LISTER LES UTILISATEURS
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  // ✅ On type req avec RequestWithUser
  async findAll(@Request() req: RequestWithUser) {
    const user = req.user;
    
    // Si Super Admin, voit tout. Sinon, voit uniquement ceux de sa société.
    const whereClause = user.role === Role.SUPER_ADMIN ? {} : { clientId: user.clientId };

    return this.prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true,
        client: { select: { name: true } }
      }
    });
  }

  // 🔹 CRÉER UN UTILISATEUR
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  // ✅ On remplace body: any par body: CreateUserDto
  async create(@Request() req: RequestWithUser, @Body() body: CreateUserDto) {
    const currentUser = req.user;

    // 1. Déterminer la société cible
    let targetClientId = body.clientId;
    
    // Sécurité : Si je ne suis pas Super Admin, je ne peux créer que pour MA société
    if (!targetClientId || currentUser.role !== Role.SUPER_ADMIN) {
        targetClientId = currentUser.clientId;
    }

    if (!targetClientId) {
        // Fallback sécurité (ex: Super Admin orphelin qui crée un user)
        targetClientId = 1; 
    }

    // 2. Vérifier unicité email
    const existingUser = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existingUser) throw new ConflictException("Email déjà utilisé.");

    // 3. Création
    const hashedPassword = await bcrypt.hash(body.password, 10);

    return this.prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role || Role.AGENT,
        clientId: targetClientId,
      },
    });
  }
}