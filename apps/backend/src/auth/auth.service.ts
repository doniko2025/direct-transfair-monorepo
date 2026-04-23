// apps/backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';

import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

export type PublicUser = {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  clientId: number | null;
  firstName?: string | null;
  lastName?: string | null;
  agencyId?: string | null;
  balance?: number;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  birthDate?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
  addressStreet?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  return phone.replace(/\s+/g, '');
}

function normalizeTenantCode(code?: string | null): string | null {
  const c = String(code ?? '').trim();
  if (!c) return null;
  return c.toUpperCase();
}

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  async login(dto: LoginDto): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Identifiants incorrects');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    };

    const accessToken = await this.jwt.signAsync(payload);
    return { access_token: accessToken, user: this.toPublicUser(user) };
  }

  async validateUser(identifier: string, pass: string): Promise<User | null> {
    const isEmail = identifier.includes('@');
    let user: User | null = null;

    if (isEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: normalizeEmail(identifier) },
      });
    } else {
      const phone = normalizePhone(identifier);
      if (phone) {
        user = await this.prisma.user.findFirst({ where: { phone } });
      }
    }

    if (user && (await bcrypt.compare(pass, user.password))) return user;
    return null;
  }

  async register(dto: RegisterDto, tenantFromHeader?: string | null) {
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException('Cet email est déjà utilisé.');

    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({ where: { phone } });
      if (existingPhone) throw new ConflictException('Ce numéro est déjà utilisé.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const resolvedTenantCode =
      normalizeTenantCode(tenantFromHeader) ??
      normalizeTenantCode(dto.tenantCode) ??
      'DONIKO';

    const client = await this.prisma.client.findUnique({
      where: { code: resolvedTenantCode },
    });

    if (!client) throw new BadRequestException(`Société introuvable (${resolvedTenantCode}).`);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: dto.role === 'AGENT' ? Role.AGENT : Role.USER,
        clientId: client.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        country: dto.country,
        city: dto.city,
        addressStreet: dto.addressStreet,
        postalCode: dto.postalCode,
        nationality: dto.nationality,
        birthDate: dto.birthDate,
        birthCountry: dto.birthCountry,
        birthCity: dto.birthCity,
        birthPlace: dto.birthPlace,
      },
    });

    await this.sendOtp(user.id, 'EMAIL');
    return this.login({ email: dto.email, password: dto.password });
  }

  async sendOtp(userId: string, channel: 'EMAIL' | 'PHONE') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: code,
        otpExpiresAt: expires,
        otpType: channel === 'EMAIL' ? 'EMAIL_VERIFY' : 'PHONE_VERIFY',
      },
    });

    if (channel === 'EMAIL' && user.email) {
      try {
        await this.transporter.sendMail({
          from: process.env.MAIL_FROM,
          to: user.email,
          subject: "Votre code de vérification Direct Transf'air",
          text: `Votre code est : ${code}. Il expire dans 15 minutes.`,
        });
      } catch (e) {
        console.error('Erreur envoi email:', e);
      }
    }
    return { success: true };
  }

  async verifyOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.otpCode !== code) throw new BadRequestException('Code invalide');
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) throw new BadRequestException('Code expiré');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        isEmailVerified: user.otpType === 'EMAIL_VERIFY' ? true : user.isEmailVerified,
        isPhoneVerified: user.otpType === 'PHONE_VERIFY' ? true : user.isPhoneVerified,
      },
    });
    return { success: true };
  }

  async resetPassword(userId: string, code: string, newPass: string) {
    const hashedPassword = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, otpCode: null, otpExpiresAt: null },
    });
    return { success: true };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      clientId: user.clientId,
      firstName: user.firstName,
      lastName: user.lastName,
      agencyId: user.agencyId,
      balance: Number(user.balance),
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      birthDate: user.birthDate,
      birthPlace: user.birthPlace,
      nationality: user.nationality,
      addressStreet: user.addressStreet,
      postalCode: user.postalCode,
      city: user.city,
      country: user.country,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true, agency: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = { ...data };
    
    // Protection des champs sensibles
    delete updateData.id;
    delete updateData.role;
    delete updateData.password;
    delete updateData.email; // On ne change pas l'email ici pour sécurité
    delete updateData.balance;

    // ✅ Normalisation du téléphone si présent
    if (updateData.phone) {
      updateData.phone = normalizePhone(updateData.phone);
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Ce numéro de téléphone est déjà utilisé.');
      throw new BadRequestException('Erreur lors de la mise à jour du profil.');
    }

    return this.getProfile(userId);
  }
}