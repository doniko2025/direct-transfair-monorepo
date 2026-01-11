//apps/backend/src/agencies/agencies.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto'; // Assure-toi que ce DTO existe
import * as bcrypt from 'bcryptjs';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class AgenciesService {
  constructor(private prisma: PrismaService) {}

  async create(clientId: number, dto: CreateAgencyDto) {
    // L'email de l'agence servira de login pour l'agent
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException(`L'email "${dto.email}" est déjà utilisé.`);

    // Mot de passe provisoire pour l'agent (envoyé depuis le front ou par défaut)
    const password = dto.adminPassword || '123456';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Extraction prénom/nom du manager (ex: "Moussa DIOP")
    const nameParts = dto.managerName ? dto.managerName.split(' ') : ['Agent', 'Agence'];
    const firstName = dto.adminFirstName || nameParts[0];
    const lastName = dto.adminLastName || nameParts.slice(1).join(' ') || 'Responsable';

    return this.prisma.$transaction(async (tx) => {
        // 1. Création de l'Agence
        const agency = await tx.agency.create({
            data: {
                name: dto.name,
                city: dto.city,
                address: dto.address,
                phone: dto.phone,
                isActive: true,
                clientId: clientId,
                // On pourrait stocker le type (Partner/Filiale) ici si le modèle Agency le supportait
            }
        });

        // 2. Création de l'Agent (Guichetier)
        const agent = await tx.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                firstName: firstName,
                lastName: lastName,
                role: Role.AGENT,
                clientId: clientId,
                agencyId: agency.id, // Lien direct avec l'agence
                phone: dto.phone,
                city: dto.city,
                country: dto.country,
                jobTitle: 'Responsable Agence',
            }
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

  // Autres méthodes (update, delete...) si nécessaire
}
//super@doniko.com