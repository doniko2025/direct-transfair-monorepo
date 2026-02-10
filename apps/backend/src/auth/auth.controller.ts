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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUserPayload } from './strategies/jwt.strategy';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // --- ROUTES SECURITÉ (MFA / RESET / FIND) ---

  @Public()
  @Post('find-account')
  async findAccount(@Body('identifier') identifier: string) {
      if (!identifier) throw new BadRequestException("Identifiant requis");
      return this.authService.findAccount(identifier);
  }

  @Public()
  @Post('send-otp')
  async sendOtp(@Body() body: { userId: string, channel: 'EMAIL' | 'PHONE' }) {
      if (!body.userId || !body.channel) throw new BadRequestException("Données incomplètes");
      return this.authService.sendOtp(body.userId, body.channel);
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() body: { userId: string, code: string, type?: string }) {
      if (!body.userId || !body.code) throw new BadRequestException("Données incomplètes");
      // ✅ CORRECTION ICI : On passe seulement 2 arguments (userId, code)
      // On retire 'body.type' car votre AuthService ne l'attend pas encore.
      return this.authService.verifyOtp(body.userId, body.code);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { userId: string, code: string, newPassword: string }) {
      if (!body.userId || !body.code || !body.newPassword) throw new BadRequestException("Données incomplètes");
      return this.authService.resetPassword(body.userId, body.code, body.newPassword);
  }

  // --- ROUTES PROFILE (PROTEGÉES) ---

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async me(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.authService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async updateMe(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: unknown,
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.authService.updateProfile(req.user.id, body);
  }
}