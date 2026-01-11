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

// ✅ CORRECTION ICI : clientId accepte maintenant 'number | null'
export type PublicUser = {
  id: string;
  email: string;
  role: Role;
  clientId: number | null; // <--- C'était 'number', maintenant 'number | null'

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
    clientId: user.clientId, // TypeScript est content car PublicUser accepte null

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

    if ((dto.role as any) === 'ADMIN' || dto.role === 'COMPANY_ADMIN') {
        userRole = Role.COMPANY_ADMIN;
    } else if ((dto.role as any) === 'SUPER_ADMIN') {
        userRole = Role.SUPER_ADMIN;
    } else {
        userRole = Role.USER;
    }

    // Par défaut on lie au client 1 (Doniko). 
    // Pour un Super Admin sans client, on pourrait passer null ici si UsersService l'accepte.
    const defaultClientId = 1; 

    const newUser = await this.users.create(
      email,
      hashedPassword,
      userRole,
      defaultClientId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        addressStreet: dto.addressStreet || (dto as any).addressNumber,
        postalCode: dto.postalCode,
        city: dto.city,
        country: dto.country,
        nationality: dto.nationality,
        birthDate: dto.birthDate,
        birthPlace: dto.birthPlace,
      },
    );

    return this.login({ email: dto.email, password: dto.password });
  }

  // ---------------------------------------------------------
  // 🔹 LOGIN
  // ---------------------------------------------------------
  async login(
    dto: LoginDto,
    clientId?: number,
  ): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // Vérification Multi-tenant (seulement si user a un clientId)
    if (typeof clientId === 'number' && user.clientId && user.clientId !== clientId) {
      throw new UnauthorizedException('Société invalide');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      // ✅ Si null, on envoie null explicitement
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
    delete data.id;
    delete data.role;
    delete data.password;
    delete data.clientId;
    delete data.balance; 
    delete data.email;

    const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { ...data }
    });

    return toPublicUser(updated);
  }

  // Méthodes de compatibilité
  async registerUser(dto: RegisterDto, clientId: number) {
      return this.register({ ...dto, role: 'USER' } as any);
  }

  async registerAdmin(dto: RegisterDto, clientId: number) {
      return this.register({ ...dto, role: 'ADMIN' } as any);
  }
}