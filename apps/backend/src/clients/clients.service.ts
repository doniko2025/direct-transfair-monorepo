// apps/backend/src/clients/clients.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcryptjs';
import { Role, SubscriptionStatus, Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  // 1. CRÉATION (Avec transaction pour l'admin)
  async create(dto: CreateClientDto) {
    // Vérifs unicité
    const existingCode = await this.prisma.client.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existingCode) throw new ConflictException(`Le code "${dto.code}" est déjà pris.`);

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existingUser) throw new ConflictException(`L'email "${dto.adminEmail}" est déjà utilisé.`);

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

    return this.prisma.$transaction(async (tx) => {
        // Création Société
        const client = await tx.client.create({
            data: {
                code: dto.code.toUpperCase(),
                name: dto.name,
                primaryColor: dto.primaryColor || '#F7931E',
                subscriptionType: dto.subscriptionType,
                subscriptionStatus: SubscriptionStatus.ACTIVE,
                
                // ✅ CORRECTION : Pas de champ 'country' ici !
                // On utilise les champs qui existent vraiment dans le schéma :
                logoUrl: dto.logoUrl,
                email: dto.adminEmail, 
                phone: dto.contactPhone,
                address: dto.ownerAddress, // On met l'adresse complète ici
                
                ownerFirstName: dto.adminFirstName,
                ownerLastName: dto.adminLastName,
                ownerBirthDate: dto.ownerBirthDate,
                ownerBirthPlace: dto.ownerBirthPlace,
                ownerCountry: dto.ownerCountry, // ✅ C'est ici qu'on met le pays du gérant
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
                country: dto.ownerCountry, // Le User a bien un champ country
                phone: dto.contactPhone,
                addressStreet: dto.ownerAddress,
            }
        });

        return { client, admin };
    });
  }

  async findAll() {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, agencies: true } } },
    });
  }

  async findOne(id: number) {
    return this.prisma.client.findUnique({ where: { id }, include: { users: true } });
  }

  // ✅ C'EST CETTE MÉTHODE QUI MANQUAIT POUR LE TENANT SERVICE
  async findByCode(code: string) {
    const client = await this.prisma.client.findUnique({
        where: { code: code.toUpperCase() },
    });
    // On ne throw pas forcément ici pour laisser le middleware gérer, 
    // mais si c'est null, le middleware renverra une 404.
    return client;
  }

  async update(id: number, data: any) {
    const updateData: any = { ...data };
    
    // Nettoyage pour éviter l'erreur "Unknown argument 'status'"
    if (data.status) {
        updateData.subscriptionStatus = data.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
        delete updateData.status;
    }
    // Nettoyage pour éviter l'erreur "Unknown argument 'country'"
    if (data.country) {
        delete updateData.country; // On le supprime car il n'existe pas sur Client
    }

    return this.prisma.client.update({
        where: { id },
        data: updateData,
    });
  }

  async updateStatus(id: number, status: SubscriptionStatus) {
    return this.prisma.client.update({ where: { id }, data: { subscriptionStatus: status } });
  }

  async remove(id: number) {
    await this.prisma.user.deleteMany({ where: { clientId: id } });
    return this.prisma.client.delete({ where: { id } });
  }
}