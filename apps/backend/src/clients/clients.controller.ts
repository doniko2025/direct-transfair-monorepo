// src/clients/clients.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';

import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async create(@Body() dto: CreateClientDto) {
    const client = await this.clientsService.create(dto.code, dto.name);

    return {
      message: 'Client created',
      client,
    };
  }

  @Get()
  async findAll() {
    const clients = await this.clientsService.findAll();
    return { clients };
  }
}
