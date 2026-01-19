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
import { AuthUserPayload } from './strategies/jwt.strategy'; 

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // --- REGISTER ---
  // On ne force pas le header x-tenant-id ici car le tenantCode est dans le DTO
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // --- LOGIN ---
  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    // On récupère le tenantCode depuis le header (envoyé par le front)
    const rawHeader = req.headers['x-tenant-id'];
    
    // On s'assure que c'est une string ou undefined
    const tenantCode = typeof rawHeader === 'string' ? rawHeader : undefined;

    // ✅ On passe le CODE (string) au service, pas l'ID numérique
    return this.authService.login(dto, tenantCode);
  }

  // --- ME ---
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
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
    return this.authService.updateProfile(req.user.id, body);
  }
}