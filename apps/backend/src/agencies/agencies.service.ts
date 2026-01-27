//apps/backend/src/agencies/agencies.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

@Injectable()
export class AgenciesService {
  constructor(private prisma: PrismaService) {}

  async create(clientId: number, dto: CreateAgencyDto) {
    // ... (Validation inchangée) ...
    if (!clientId || !Number.isFinite(clientId)) throw new BadRequestException('clientId invalide');
    const email = safeTrim(dto.email).toLowerCase();
    if (!email) throw new BadRequestException("Email requis");
    
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException(`L'email "${email}" est déjà utilisé.`);
    
    if (dto.code) {
        const existingCode = await this.prisma.agency.findUnique({ where: { code: dto.code } });
        if (existingCode) throw new ConflictException(`Le code "${dto.code}" est déjà utilisé.`);
    }

    const hashedPassword = await bcrypt.hash(safeTrim(dto.adminPassword) || '123456', 10);

    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: safeTrim(dto.name),
          city: safeTrim(dto.city),
          address: safeTrim(dto.address),
          phone: safeTrim(dto.phone),
          code: dto.code,
          email: dto.email,
          country: dto.country, // Le pays est là
          
          // ✅ C'EST CETTE LIGNE QUI MANQUAIT DANS VOTRE FICHIER :
          currency: dto.currency || 'XOF', 
          
          isActive: true,
          clientId,
        },
      });
      
      const agent = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: safeTrim(dto.adminFirstName) || 'Agent',
          lastName: safeTrim(dto.adminLastName) || 'Agence',
          role: Role.AGENT,
          clientId,
          agencyId: agency.id,
          phone: safeTrim(dto.phone),
          city: safeTrim(dto.city),
          jobTitle: 'Responsable Agence',
        },
      });
      return { agency, agent };
    });
  }

  // ... (Gardez vos méthodes update, remove, findAll, findOne telles quelles) ...
  // Je ne remets pas tout le fichier pour gagner de la place, mais ne changez rien d'autre.
  
  // Rappel de la méthode remove qui fonctionne :
  async remove(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({ where: { id, clientId } });
    if (!agency) throw new NotFoundException("Agence introuvable");

    return this.prisma.$transaction(async (tx) => {
        const agents = await tx.user.findMany({ where: { agencyId: id }, select: { id: true } });
        const agentIds = agents.map(a => a.id);

        if (agentIds.length > 0) {
            try { await tx.withdrawal.deleteMany({ where: { transaction: { senderId: { in: agentIds } } } }); } catch (e) {}
            await tx.transaction.deleteMany({ where: { senderId: { in: agentIds } } });
        }
        await tx.user.deleteMany({ where: { agencyId: id } });
        return tx.agency.delete({ where: { id } });
    });
  }
  
  async update(id: string, clientId: number, dto: UpdateAgencyDto) {
      // ... (Votre code update existant) ...
      const agency = await this.prisma.agency.findFirst({ where: { id, clientId } });
      if (!agency) throw new NotFoundException("Agence introuvable");

      return this.prisma.$transaction(async (tx) => {
          const updatedAgency = await tx.agency.update({
              where: { id },
              data: {
                  name: dto.name,
                  city: dto.city,
                  address: dto.address,
                  phone: dto.phone,
                  email: dto.email,
                  code: dto.code,
                  // @ts-ignore
                  isActive: (dto as any).isActive 
              }
          });

          if (dto.email && dto.email !== agency.email) {
              const email = safeTrim(dto.email).toLowerCase();
              const exists = await tx.user.findUnique({ where: { email } });
              if (exists) throw new ConflictException("Cet email est déjà pris.");

              await tx.user.updateMany({
                  where: { agencyId: id, role: Role.AGENT },
                  data: { email }
              });
          }
          return updatedAgency;
      });
  }

  async findAllByClient(clientId: number) {
    return this.prisma.agency.findMany({ where: { clientId }, include: { agents: true }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, clientId: number) {
    const agency = await this.prisma.agency.findFirst({ where: { id, clientId }, include: { agents: true } });
    if (!agency) throw new NotFoundException('Agence introuvable');
    return agency;
  }
}