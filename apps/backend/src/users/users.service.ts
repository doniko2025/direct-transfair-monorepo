// apps/backend/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '../auth/dto/register.dto';

type UserExtraFields = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressNumber?: string;
  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;
};

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------
  // 🔹 FIND BY EMAIL
  // ---------------------------------------------------------
  findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  // ---------------------------------------------------------
  // 🔹 FIND BY ID
  // ---------------------------------------------------------
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  // ---------------------------------------------------------
  // 🔹 CREATE USER (avec éventuels champs KYC)
  // ---------------------------------------------------------
  create(
    email: string,
    passwordHash: string,
    role: UserRole,
    clientId: number,
    extra: UserExtraFields = {},
  ): Promise<User> {
    const normalizedEmail = normalizeEmail(email);

    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: passwordHash,
        role,
        clientId,
        ...extra,
      },
    });
  }
}
