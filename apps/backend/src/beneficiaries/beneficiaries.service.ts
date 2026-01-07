// apps/backend/src/beneficiaries/beneficiaries.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Beneficiary } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import type { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ On accepte maintenant clientId en argument
  async create(userId: string, clientId: number, dto: CreateBeneficiaryDto): Promise<Beneficiary> {
    
    // Sécurité : Vérifier que le clientId existe (si nécessaire, ou on fait confiance au Guard)
    if (!clientId) {
        // Fallback: chercher le user en DB si le JWT ne contenait pas le clientId
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.clientId) throw new BadRequestException('Impossible de déterminer la société.');
        clientId = user.clientId;
    }

    const { fullName, country, city, phone } = dto;

    return this.prisma.beneficiary.create({
      data: {
        fullName,
        country,
        city,
        phone: phone ?? null,
        user: {
          connect: { id: userId },
        },
        client: {
          connect: { id: clientId }, // ✅ Liaison propre avec la société
        },
      },
    });
  }

  async findAllForUser(userId: string): Promise<Beneficiary[]> {
    return this.prisma.beneficiary.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(id: string, userId: string): Promise<Beneficiary> {
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id, userId },
    });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');
    return beneficiary;
  }

  async updateForUser(id: string, userId: string, dto: UpdateBeneficiaryDto): Promise<Beneficiary> {
    const existing = await this.findOneForUser(id, userId);
    
    const hasAny = dto.fullName !== undefined || dto.country !== undefined || dto.city !== undefined || dto.phone !== undefined;
    if (!hasAny) throw new BadRequestException('No fields provided');

    return this.prisma.beneficiary.update({
      where: { id: existing.id },
      data: {
        fullName: dto.fullName ?? undefined,
        country: dto.country ?? undefined,
        city: dto.city ?? undefined,
        phone: dto.phone === undefined ? undefined : dto.phone,
      },
    });
  }

  async deleteForUser(id: string, userId: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOneForUser(id, userId);

    const txCount = await this.prisma.transaction.count({
      where: { beneficiaryId: existing.id },
    });

    if (txCount > 0) throw new BadRequestException('Cannot delete beneficiary linked to transactions');

    await this.prisma.beneficiary.delete({ where: { id: existing.id } });
    return { deleted: true, id: existing.id };
  }
}