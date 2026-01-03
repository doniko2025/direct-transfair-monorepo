// apps/backend/src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  BadRequestException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUserPayload } from './types/auth-user-payload.type';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * convertit x-tenant-id en clientId
   * - Supporte : "DONIKO" (code) ou "1" (id)
   * - Normalise les codes en uppercase
   */
  private async resolveClientId(headerValue: unknown): Promise<number> {
    if (headerValue === undefined || headerValue === null) {
      throw new BadRequestException('Missing x-tenant-id header');
    }

    const raw = String(headerValue).trim();
    if (!raw) {
      throw new BadRequestException('Missing x-tenant-id header');
    }

    // 1) Header numérique → ID direct (mais on vérifie qu'il existe)
    if (/^\d+$/.test(raw)) {
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) {
        throw new BadRequestException('Invalid tenant id');
      }

      const exists = await this.prisma.client.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new BadRequestException(`Unknown tenant id: ${id}`);
      }

      return exists.id;
    }

    // 2) Sinon → code (ex: DONIKO)
    const code = raw.toUpperCase();

    const client = await this.prisma.client.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!client) {
      throw new BadRequestException(`Unknown tenant code: ${code}`);
    }

    return client.id;
  }

  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier (ex: DONIKO or 1)',
    required: true,
  })
  @Post('register')
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    const clientId = await this.resolveClientId(req.headers['x-tenant-id']);
    return this.authService.registerUser(dto, clientId);
  }

  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier (ex: DONIKO or 1)',
    required: true,
  })
  @Post('register-admin')
  async registerAdmin(@Req() req: Request, @Body() dto: RegisterDto) {
    const clientId = await this.resolveClientId(req.headers['x-tenant-id']);
    return this.authService.registerAdmin(dto, clientId);
  }

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const header = req.headers['x-tenant-id'];
    const clientId = header ? await this.resolveClientId(header) : undefined;
    return this.authService.login(dto, clientId);
  }

  // ======================================================
  // ✅ GET /auth/me — NOUVEAU (safe, multi-tenant, JWT)
  // ======================================================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) {
      throw new BadRequestException('User not found in request');
    }

    return req.user;
  }
}
