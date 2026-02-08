// apps/backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

export type PublicUser = {
  id: string;
  email: string;
  role: Role;
  clientId: number | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  addressStreet?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  birthCountry?: string | null;
  birthCity?: string | null;
  gender?: string | null;
  jobTitle?: string | null;
  agencyId?: string | null;
  balance?: number;
};

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeTenantCode(raw?: string): string {
  const s = String(raw ?? '').trim().toUpperCase();
  return s.length > 0 ? s : 'DONIKO';
}

type DecimalLike = { toNumber?: () => number; toString?: () => string };

function decimalToNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const v = value as DecimalLike;
    if (typeof v.toNumber === 'function') {
      const n = v.toNumber();
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof v.toString === 'function') {
      const n = Number(v.toString());
      return Number.isFinite(n) ? n : 0;
    }
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toPublicUser(user: User): PublicUser {
  const balanceNumber = decimalToNumber((user as any).balance);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    addressStreet: user.addressStreet,
    postalCode: user.postalCode,
    city: user.city,
    country: user.country,
    nationality: user.nationality,
    birthDate: user.birthDate,
    birthPlace: user.birthPlace,
    birthCountry: user.birthCountry,
    birthCity: user.birthCity,
    gender: user.gender,
    jobTitle: user.jobTitle,
    agencyId: user.agencyId,
    balance: balanceNumber,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    // On vérifie l'email globalement (SaaS)
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Cet email est déjà utilisé.');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let userRole: Role = Role.USER;
    if (dto.role === 'COMPANY_ADMIN') userRole = Role.COMPANY_ADMIN;
    if (dto.role === 'SUPER_ADMIN') userRole = Role.SUPER_ADMIN;

    const tenantCode = normalizeTenantCode(dto.tenantCode);
    let clientId: number | null = null;

    if (tenantCode !== 'DONIKO') {
      const client = await this.prisma.client.findUnique({
        where: { code: tenantCode },
      });
      clientId = client ? client.id : 1;
    } else {
      clientId = 1;
    }

    await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: userRole,
        clientId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        country: dto.country,
        city: dto.city,
        addressStreet: dto.addressStreet,
        postalCode: dto.postalCode,
        nationality: dto.nationality,
        birthDate: dto.birthDate,
        birthPlace: dto.birthPlace,
        birthCountry: dto.birthCountry,
        birthCity: dto.birthCity,
      },
    });

    return this.login({ email: dto.email, password: dto.password });
  }

  // ---------------------------------------------------------
  // 🔐 LOGIN
  // ---------------------------------------------------------
  async login(
    dto: LoginDto,
    _tenantCode?: string, // On garde le paramètre pour la compatibilité mais on l'ignore
  ): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // ✅ SÉCURISATION DU CLIENT ID
    const safeClientId = (user.clientId !== undefined && user.clientId !== null) 
      ? user.clientId 
      : null;

    const payload = {
      sub: user.id, 
      email: user.email,
      role: user.role,
      clientId: safeClientId,
    };

    const accessToken = await this.jwt.signAsync(payload);
    return { access_token: accessToken, user: toPublicUser(user) };
  }

  private async validateUser(email: string, password: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);
    
    // ✅ Logique SaaS : On cherche l'utilisateur globalement par email.
    // L'email doit être unique dans la table User pour que cela fonctionne parfaitement.
    const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail }
    });

    if (!user) return null;
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;
    
    return user;
  }

  // ✅ CORRECTION ICI : On inclut l'Agence et le Client pour l'affichage frontend
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ 
        where: { id: userId },
        include: { 
            client: { select: { name: true, code: true } }, 
            agency: { select: { id: true, name: true, currency: true } } 
        }
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // On force le typage pour inclure les objets imbriqués dans la réponse JSON
    const publicUser: any = toPublicUser(user);
    publicUser.client = (user as any).client;
    publicUser.agency = (user as any).agency;

    return publicUser;
  }

  async updateProfile(userId: string, data: unknown): Promise<PublicUser> {
    const updateData: Record<string, unknown> =
      data && typeof data === 'object' && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>) }
        : {};

    delete updateData.id;
    delete updateData.role;
    delete updateData.password;
    delete updateData.clientId;
    delete updateData.balance;
    delete updateData.email;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return toPublicUser(updated);
  }
}