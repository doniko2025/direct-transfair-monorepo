// apps/backend/src/clients/clients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Client } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(code: string, name: string): Promise<Client> {
    const normalized = code.trim().toUpperCase();

    return this.prisma.client.create({
      data: { code: normalized, name },
    });
  }

  async findAll(): Promise<Client[]> {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCode(code: string): Promise<Client> {
    const normalized = code.trim().toUpperCase();

    const client = await this.prisma.client.findUnique({
      where: { code: normalized },
    });

    if (!client) {
      throw new NotFoundException(`Client '${normalized}' not found`);
    }

    return client;
  }
}
