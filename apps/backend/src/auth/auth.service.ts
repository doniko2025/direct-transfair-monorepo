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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // ---------------------------------------------------------
  // 🔐 LOGIN (Email OU Téléphone)
  // ---------------------------------------------------------
  async login(dto: LoginDto): Promise<{ access_token: string; user: PublicUser }> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

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

    if (user && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  // ---------------------------------------------------------
  // 📝 REGISTER (tenant auto via x-tenant-id)
  // ---------------------------------------------------------
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

    // ✅ IMPORTANT : le tenant est pris automatiquement depuis x-tenant-id
    // (fallback compat: dto.tenantCode, puis DONIKO)
    const resolvedTenantCode =
      normalizeTenantCode(tenantFromHeader) ??
      normalizeTenantCode(dto.tenantCode) ??
      'DONIKO';

    const client = await this.prisma.client.findUnique({
      where: { code: resolvedTenantCode },
    });

    if (!client) {
      throw new BadRequestException(
        `Société introuvable (tenant "${resolvedTenantCode}"). Vérifie le lien société / x-tenant-id.`,
      );
    }

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

    // Envoi automatique d'un OTP par email à l'inscription
    await this.sendOtp(user.id, 'EMAIL');

    return this.login({ email: dto.email, password: dto.password });
  }

  // ---------------------------------------------------------
  // 🛡️ SECURITÉ : OTP & RESET PASSWORD
  // ---------------------------------------------------------
  async findAccount(identifier: string) {
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

    if (!user) throw new NotFoundException('Compte introuvable');

    const channels: string[] = [];
    if (user.email) channels.push('EMAIL');
    if (user.phone) channels.push('PHONE');

    return { userId: user.id, channels };
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
      // eslint-disable-next-line no-console
      console.log(`📧 Envoi Email à ${user.email} : Code ${code}`);
      try {
        await this.transporter.sendMail({
          from: process.env.MAIL_FROM,
          to: user.email,
          subject: "Votre code de vérification Direct Transf'air",
          text: `Votre code est : ${code}. Il expire dans 15 minutes.`,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Erreur envoi email:', e);
      }
    } else if (channel === 'PHONE' && user.phone) {
      // eslint-disable-next-line no-console
      console.log(`📱 Envoi SMS à ${user.phone} : Code ${code}`);
      // Intégrer Twilio ici
    }

    return { success: true };
  }

  async verifyOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.otpCode !== code) throw new BadRequestException('Code invalide');

    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new BadRequestException('Code expiré');
    }

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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const hashedPassword = await bcrypt.hash(newPass, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    return { success: true };
  }

  // ---------------------------------------------------------
  // 🛠️ UTILS
  // ---------------------------------------------------------
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
    delete updateData.id;
    delete updateData.role;
    delete updateData.password;

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.getProfile(userId);
  }
}
