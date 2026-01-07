// apps/backend/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { User, Role } from '@prisma/client'; 
import { PrismaService } from '../prisma/prisma.service';

type UserExtraFields = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  jobTitle?: string;
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

  // 🔹 Lister (avec filtre)
  async findAll(whereClause: any) {
    return this.prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, 
            email: true, 
            firstName: true, 
            lastName: true, 
            role: true, 
            createdAt: true,
            client: { select: { name: true } }
        }
    });
  }

  // 🔹 Trouver par Email
  findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  // 🔹 Créer
  create(
    email: string,
    passwordHash: string,
    role: Role, 
    clientId: number, // ✅ L'argument crucial
    extra: UserExtraFields = {},
  ): Promise<User> {
    const normalizedEmail = normalizeEmail(email);

    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: passwordHash,
        role,
        clientId, // ✅ Liaison correcte
        ...extra,
      },
    });
  }
}