// apps/backend/src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  BadRequestException,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// ✅ CORRECTION DE L'IMPORT : On pointe vers le dossier 'strategies'
import { AuthUserPayload } from './strategies/jwt.strategy'; 

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Helper Tenant ---
  private async resolveClientId(headerValue: unknown): Promise<number> {
    if (!headerValue) throw new BadRequestException('Missing x-tenant-id');
    const raw = String(headerValue).trim();
    
    // 1. ID numérique
    if (/^\d+$/.test(raw)) {
      const id = Number(raw);
      const exists = await this.prisma.client.findUnique({ where: { id } });
      if (!exists) throw new BadRequestException(`Unknown tenant id: ${id}`);
      return exists.id;
    }

    // 2. Code (ex: FLASH2026)
    const client = await this.prisma.client.findUnique({ where: { code: raw.toUpperCase() } });
    if (!client) throw new BadRequestException(`Unknown tenant code: ${raw}`);
    return client.id;
  }

  // --- REGISTER ---
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @Post('register')
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    await this.resolveClientId(req.headers['x-tenant-id']);
    return this.authService.register(dto);
  }

  // --- LOGIN ---
  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const header = req.headers['x-tenant-id'];
    // Le clientID est optionnel au login (sauf si stratégie stricte), mais utile pour vérifier
    const clientId = header ? await this.resolveClientId(header) : undefined;
    return this.authService.login(dto, clientId);
  }

  // --- ME ---
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    // ✅ Utilisation de 'id' (plus propre que sub)
    return this.authService.getProfile(req.user.id);
  }

  // --- UPDATE ME ---
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateMe(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: any,
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    // ✅ Utilisation de 'id'
    return this.authService.updateProfile(req.user.id, body);
  }
}