// apps/backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';

import { UsersService } from '../users/users.service';
import { hashPassword, comparePassword } from '../common/password';
import { RegisterDto, type UserRole } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

type PublicUser = {
  id: string;
  email: string;
  role: string;
  clientId: number;

  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;

  addressNumber?: string | null;
  addressStreet?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;

  nationality?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
};

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function toPublicUser(user: User): PublicUser {
  // IMPORTANT: jamais renvoyer user.password
  return {
    id: user.id,
    email: user.email,
    role: String(user.role),
    clientId: user.clientId,

    firstName: (user as any).firstName ?? null,
    lastName: (user as any).lastName ?? null,
    phone: (user as any).phone ?? null,

    addressNumber: (user as any).addressNumber ?? null,
    addressStreet: (user as any).addressStreet ?? null,
    postalCode: (user as any).postalCode ?? null,
    city: (user as any).city ?? null,
    country: (user as any).country ?? null,

    nationality: (user as any).nationality ?? null,
    birthDate: (user as any).birthDate ?? null,
    birthPlace: (user as any).birthPlace ?? null,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------
  // 🔹 REGISTER USER
  // ---------------------------------------------------------
  async registerUser(
    dto: RegisterDto,
    clientId: number,
  ): Promise<{ message: string; user: User }> {
    return this.registerWithRole(dto, 'USER', clientId);
  }

  // ---------------------------------------------------------
  // 🔹 REGISTER ADMIN
  // ---------------------------------------------------------
  async registerAdmin(
    dto: RegisterDto,
    clientId: number,
  ): Promise<{ message: string; user: User }> {
    return this.registerWithRole(dto, 'ADMIN', clientId);
  }

  // ---------------------------------------------------------
  // 🔹 Méthode interne commune
  // ---------------------------------------------------------
  private async registerWithRole(
    dto: RegisterDto,
    role: UserRole,
    clientId: number,
  ): Promise<{ message: string; user: User }> {
    const email = normalizeEmail(dto.email);

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new UnauthorizedException('Email already used');
    }

    const hashed = await hashPassword(dto.password);

    const user = await this.users.create(email, hashed, role, clientId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      addressNumber: dto.addressNumber,
      addressStreet: dto.addressStreet,
      postalCode: dto.postalCode,
      city: dto.city,
      country: dto.country,
      nationality: dto.nationality,
      birthDate: dto.birthDate,
      birthPlace: dto.birthPlace,
    });

    const message = role === 'ADMIN' ? 'Admin created' : 'User created';
    return { message, user };
  }

  // ---------------------------------------------------------
  // 🔹 VALIDATE USER (login)
  // ---------------------------------------------------------
  private async validateUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);

    const user = await this.users.findByEmail(normalizedEmail);
    if (!user) return null;

    const valid = await comparePassword(password, user.password);
    if (!valid) return null;

    return user;
  }

  // ---------------------------------------------------------
  // 🔹 LOGIN
  // - clientId optionnel : si fourni, on vérifie l'isolation tenant
  // ---------------------------------------------------------
  async login(
    dto: LoginDto,
    clientId?: number,
  ): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Multi-tenant (optionnel, mais recommandé)
    if (typeof clientId === 'number' && user.clientId !== clientId) {
      throw new UnauthorizedException('Invalid tenant');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    };

    const accessToken = await this.jwt.signAsync(payload);
    return { access_token: accessToken, user: toPublicUser(user) };
  }
}
