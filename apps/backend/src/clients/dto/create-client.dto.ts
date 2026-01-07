// src/clients/dto/create-client.dto.ts
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { SubscriptionType, SubscriptionStatus } from '@prisma/client';

export class CreateClientDto {
  // --- Infos Société ---
  @IsString()
  @IsNotEmpty()
  code: string; // Ex: "FLASH"

  @IsString()
  @IsNotEmpty()
  name: string; // Ex: "Flash Transfert"

  @IsString()
  @IsOptional()
  primaryColor?: string;

  // --- Abonnement ---
  @IsEnum(SubscriptionType)
  subscriptionType: SubscriptionType;

  // --- ✅ NOUVEAU : Infos du Premier Admin ---
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  adminPassword: string;

  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  adminLastName: string;
}