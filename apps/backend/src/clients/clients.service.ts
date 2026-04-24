// apps/backend/src/clients/clients.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { Role, SubscriptionStatus, Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  // 1. CRÉATION
  async create(dto: CreateClientDto) {
    const existingCode = await this.prisma.client.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existingCode) throw new ConflictException(`Le code "${dto.code}" est déjà pris.`);

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existingUser) throw new ConflictException(`L'email "${dto.adminEmail}" est déjà utilisé.`);

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

    return this.prisma.$transaction(async (tx) => {
        // ✅ CORRECTION : On retire 'country' car il n'existe pas sur Client
        const client = await tx.client.create({
            data: {
                code: dto.code.toUpperCase(),
                name: dto.name,
                primaryColor: dto.primaryColor || '#F7931E',
                subscriptionType: dto.subscriptionType,
                subscriptionStatus: SubscriptionStatus.ACTIVE,
                
                logoUrl: dto.logoUrl,
                email: dto.adminEmail, 
                phone: dto.contactPhone,
                address: dto.ownerAddress, // Adresse complète
                
                ownerFirstName: dto.adminFirstName,
                ownerLastName: dto.adminLastName,
                ownerBirthDate: dto.ownerBirthDate,
                ownerBirthPlace: dto.ownerBirthPlace,
                ownerCountry: dto.ownerCountry, // C'est le bon champ
                ownerAddress: dto.ownerAddress,
                
                contactEmail: dto.contactEmail || dto.adminEmail,
                contactPhone: dto.contactPhone,
                activitySector: dto.activitySector,
            }
        });

        // Création Admin
        const admin = await tx.user.create({
            data: {
                email: dto.adminEmail,
                password: hashedPassword,
                firstName: dto.adminFirstName,
                lastName: dto.adminLastName,
                role: Role.COMPANY_ADMIN,
                clientId: client.id,
                country: dto.ownerCountry, // Ici 'country' est valide sur User
                phone: dto.contactPhone,
                addressStreet: dto.ownerAddress,
            }
        });

        return { client, admin };
    });
  }

  // ✅ CORRECTION ICI : On retire le filtre pour afficher tous les clients, y compris "DONIKO"
  async findAll() {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, agencies: true } } },
    });
  }

  async findOne(id: number) {
    return this.prisma.client.findUnique({ where: { id }, include: { users: true } });
  }

  async findByCode(code: string) {
    return this.prisma.client.findUnique({ where: { code: code.toUpperCase() } });
  }

  // ✅ CORRECTION UPDATE : Nettoyage strict des champs
  async update(id: number, data: any) {
    const updateData: any = { ...data };
    
    // On retire 'country' s'il est présent
    if (updateData.country) delete updateData.country;
    
    // On retire 'status' et on mappe vers 'subscriptionStatus'
    if (data.status) {
        updateData.subscriptionStatus = data.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
        delete updateData.status;
    }

    // On retire les champs admin sensibles qui ne sont pas sur le modèle Client
    delete updateData.adminEmail;
    delete updateData.adminFirstName;
    delete updateData.adminLastName;
    delete updateData.adminPassword;

    return this.prisma.client.update({
        where: { id },
        data: updateData,
    });
  }

  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({ where: { id }, data: { subscriptionStatus: status } });
  }

  async remove(id: number) {
    // Protection ultime : Empêcher de supprimer le Super Client par API
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (client?.code === 'DONIKO') {
        throw new ConflictException("Impossible de supprimer la société système DONIKO.");
    }

    await this.prisma.user.deleteMany({ where: { clientId: id } });
    return this.prisma.client.delete({ where: { id } });
  }
}