// apps/backend/src/clients/clients.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { Role, SubscriptionStatus, Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    const existingCode = await this.prisma.client.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existingCode) throw new ConflictException(`Le code "${dto.code}" est déjà pris.`);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingUser) throw new ConflictException(`L'email "${dto.adminEmail}" est déjà utilisé.`);

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

    return this.prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
            data: {
                code: dto.code.toUpperCase(),
                name: dto.name,
                primaryColor: dto.primaryColor || '#F7931E',
                subscriptionType: dto.subscriptionType,
                subscriptionStatus: SubscriptionStatus.ACTIVE,
            }
        });

        const admin = await tx.user.create({
            data: {
                email: dto.adminEmail,
                password: hashedPassword,
                firstName: dto.adminFirstName,
                lastName: dto.adminLastName,
                role: Role.COMPANY_ADMIN,
                clientId: client.id,
            }
        });

        return { client, admin };
    });
  }

  async findAll() {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, agencies: true } },
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.client.findUnique({ where: { id }, include: { users: true } });
  }

  async findByCode(code: string) {
    const client = await this.prisma.client.findUnique({
        where: { code: code.toUpperCase() },
    });
    if (!client) throw new NotFoundException(`Aucune société trouvée avec le code : ${code}`);
    return client;
  }

  // ✅ LOGIQUE UPDATE
  async update(id: number, data: Prisma.ClientUpdateInput) {
    return this.prisma.client.update({
        where: { id },
        data,
    });
  }

  // ✅ LOGIQUE STATUS
  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({
        where: { id },
        data: { subscriptionStatus: status }
    });
  }

  // ✅ LOGIQUE REMOVE (Supprime aussi les users pour éviter les erreurs)
  async remove(id: number) {
    await this.prisma.user.deleteMany({ where: { clientId: id } });
    return this.prisma.client.delete({ where: { id } });
  }
}