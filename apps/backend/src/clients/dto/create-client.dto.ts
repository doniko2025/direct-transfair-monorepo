// src/clients/dto/create-client.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  code: string; // "DONIKO"

  @IsString()
  @IsNotEmpty()
  name: string; // "Doniko"
}
