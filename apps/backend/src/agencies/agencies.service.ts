//apps/backend/src/agencies/agencies.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

@Injectable()
export class AgenciesService {
  constructor(private prisma: PrismaService) {}

  async create(clientId: number, dto: CreateAgencyDto) {
    if (!clientId || !Number.isFinite(clientId)) {
      throw new BadRequestException('clientId invalide');
    }

    const email = safeTrim(dto.email).toLowerCase();
    if (!email) {
      throw new BadRequestException("Email requis pour créer l'agent");
    }

    // L'email de l'agence servira de login pour l'agent
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException(`L'email "${email}" est déjà utilisé.`);

    const name = safeTrim(dto.name);
    const city = safeTrim(dto.city);
    const address = safeTrim(dto.address);

    if (!name || !city || !address) {
      throw new BadRequestException("Champs requis: name, city, address");
    }

    // Mot de passe provisoire pour l'agent (envoyé depuis le front ou par défaut)
    const rawPassword = safeTrim(dto.adminPassword) || '123456';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Extraction prénom/nom du manager (ex: "Moussa DIOP")
    const managerName = safeTrim(dto.managerName);
    const parts = managerName ? managerName.split(/\s+/).filter(Boolean) : [];
    const fallbackFirst = parts[0] || 'Agent';
    const fallbackLast = parts.slice(1).join(' ') || 'Agence';

    const firstName = safeTrim(dto.adminFirstName) || fallbackFirst;
    const lastName = safeTrim(dto.adminLastName) || fallbackLast;

    const phone = safeTrim(dto.phone) || null;
    const country = safeTrim(dto.country) || null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Création de l'Agence
      const agency = await tx.agency.create({
        data: {
          name,
          city,
          address,
          phone,
          isActive: true,
          clientId,
        },
      });

      // 2. Création de l'Agent (Guichetier)
      const agent = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: Role.AGENT,
          clientId,
          agencyId: agency.id,
          phone,
          city,
          country,
          jobTitle: 'Responsable Agence',
        },
      });

      return { agency, agent };
    });
  }

  async findAllByClient(clientId: number) {
    return this.prisma.agency.findMany({
      where: { clientId },
      include: { agents: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, clientId },
      include: { agents: true },
    });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return agency;
  }
}

//super@doniko.com