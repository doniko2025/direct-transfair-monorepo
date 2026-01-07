// apps/backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client'; // ✅ Import des types Prisma officiels
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

// ✅ Type PublicUser mis à jour (SANS mot de passe, SANS addressNumber)
export type PublicUser = {
  id: string;
  email: string;
  role: Role; // C'est maintenant un Enum
  clientId: number;

  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;

  addressStreet?: string | null; // Remplacement de addressNumber
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;

  nationality?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  
  gender?: string | null;
  jobTitle?: string | null;
  
  agencyId?: string | null; // Nouveau champ SaaS
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
  // 🔹 REGISTER (Point d'entrée unique et robuste)
  // ---------------------------------------------------------
  async register(dto: RegisterDto) {
    // 1. Vérif email
    const email = normalizeEmail(dto.email);
    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé.');
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. ✅ MAPPING INTELLIGENT DES RÔLES
    // L'app mobile envoie peut-être encore "ADMIN" ou "USER" en string.
    // On doit convertir ça en Enum Prisma compatible.
    let userRole: Role = Role.USER;

    // Si le DTO demande "ADMIN", on lui donne le rôle "COMPANY_ADMIN"
    if ((dto.role as any) === 'ADMIN' || dto.role === 'COMPANY_ADMIN') {
        userRole = Role.COMPANY_ADMIN;
    } 
    // Si c'est SUPER_ADMIN (cas rare via API publique)
    else if ((dto.role as any) === 'SUPER_ADMIN') {
        userRole = Role.SUPER_ADMIN;
    } 
    // Sinon par défaut USER
    else {
        userRole = Role.USER;
    }

    // 4. Client par défaut (DONIKO = 1)
    const defaultClientId = 1;

    // 5. Création via UsersService
    const newUser = await this.users.create(
      email,
      hashedPassword,
      userRole, // Ici on passe bien un Role Enum
      defaultClientId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        // On mappe les champs d'adresse correctement
        addressStreet: dto.addressStreet || (dto as any).addressNumber, // Fallback si l'ancien champ est envoyé
        postalCode: dto.postalCode,
        city: dto.city,
        country: dto.country,
        nationality: dto.nationality,
        birthDate: dto.birthDate,
        birthPlace: dto.birthPlace,
      },
    );

    // 6. Connexion automatique
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

    // Vérification Multi-tenant
    if (typeof clientId === 'number' && user.clientId !== clientId) {
      throw new UnauthorizedException('Société invalide');
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
    // 🔒 SÉCURITÉ : Nettoyage des champs interdits
    delete data.id;
    delete data.role;
    delete data.password;
    delete data.clientId;
    delete data.balance; 
    delete data.email;

    // Mise à jour
    const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { ...data }
    });

    return toPublicUser(updated);
  }

  // Ces méthodes sont gardées pour compatibilité si ton Controller les appelle encore,
  // mais elles redirigent vers la méthode principale "register".
  async registerUser(dto: RegisterDto, clientId: number) {
      return this.register({ ...dto, role: 'USER' } as any);
  }

  async registerAdmin(dto: RegisterDto, clientId: number) {
      return this.register({ ...dto, role: 'ADMIN' } as any);
  }
}