// apps/backend/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { User, Role } from '@prisma/client'; 
import { PrismaService } from '../prisma/prisma.service';

// Types pour les champs supplémentaires
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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔹 Lister
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

  // 🔹 Trouver par email
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  // 🔹 Créer
  async create(
    email: string,
    passwordHash: string,
    role: Role, 
    clientId: number,
    extra: UserExtraFields = {},
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        password: passwordHash,
        role,
        clientId,
        ...extra,
      },
    });
  }
}