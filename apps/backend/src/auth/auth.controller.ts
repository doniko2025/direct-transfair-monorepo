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
import { ApiTags, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUserPayload } from './strategies/jwt.strategy';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const rawHeader = req.headers['x-tenant-id'];
    const tenantCode =
      typeof rawHeader === 'string' && rawHeader.trim().length > 0
        ? rawHeader.trim().toUpperCase()
        : undefined;

    return this.authService.login(dto, tenantCode);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-tenant-id')
  async me(@Req() req: Request & { user?: AuthUserPayload }) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.authService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-tenant-id')
  async updateMe(
    @Req() req: Request & { user?: AuthUserPayload },
    @Body() body: unknown,
  ) {
    if (!req.user) throw new BadRequestException('User not found');
    return this.authService.updateProfile(req.user.id, body);
  }
}
