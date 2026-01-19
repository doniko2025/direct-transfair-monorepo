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

// Interface publique renvoyée au frontend
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
};

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

// Convertisseur User Prisma -> PublicUser
function toPublicUser(user: User): PublicUser {
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
    
    // ✅ Ces champs fonctionneront après 'npx prisma generate'
    birthCountry: user.birthCountry, 
    birthCity: user.birthCity,       
    
    gender: user.gender,
    jobTitle: user.jobTitle,
    
    agencyId: user.agencyId,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------
  // 🔹 REGISTER
  // ---------------------------------------------------------
  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let userRole: Role = Role.USER;
    // Gestion simplifiée des rôles via le DTO (sécuriser en prod)
    if ((dto.role as any) === 'ADMIN' || dto.role === 'COMPANY_ADMIN') {
        userRole = Role.COMPANY_ADMIN;
    } else if ((dto.role as any) === 'SUPER_ADMIN') {
        userRole = Role.SUPER_ADMIN;
    }

    // Gestion du Tenant (Code Société)
    let clientId: number | null = null;
    if (dto.tenantCode && dto.tenantCode !== 'DONIKO') {
        const client = await this.prisma.client.findUnique({
            where: { code: dto.tenantCode.toUpperCase() }
        });
        if (client) {
            clientId = client.id;
        }
    } else {
        // Fallback: Si pas de code ou code DONIKO, on assigne ID 1 (Doniko) ou null
        clientId = 1; 
    }

    // Création
    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: userRole,
        clientId: clientId,
        
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
  // 🔹 LOGIN
  // ---------------------------------------------------------
  async login(
    dto: LoginDto,
    tenantCode?: string, 
  ): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId ?? null, 
    };

    const accessToken = await this.jwt.signAsync(payload);
    return { access_token: accessToken, user: toPublicUser(user) };
  }

  // ---------------------------------------------------------
  // 🔹 VALIDATE USER (Interne)
  // ---------------------------------------------------------
  private async validateUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);

    const user = await this.users.findByEmail(normalizedEmail);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return user;
  }

  // ---------------------------------------------------------
  // ✅ GET PROFILE
  // ---------------------------------------------------------
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return toPublicUser(user);
  }

  // ---------------------------------------------------------
  // ✅ UPDATE PROFILE
  // ---------------------------------------------------------
  async updateProfile(userId: string, data: any): Promise<PublicUser> {
    const updateData = { ...data };
    
    // Nettoyage sécurité
    delete updateData.id;
    delete updateData.role;
    delete updateData.password;
    delete updateData.clientId;
    delete updateData.balance; 
    delete updateData.email; 

    const updated = await this.prisma.user.update({
        where: { id: userId },
        data: updateData
    });

    return toPublicUser(updated);
  }
}