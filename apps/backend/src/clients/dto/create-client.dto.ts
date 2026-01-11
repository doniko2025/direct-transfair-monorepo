// src/clients/dto/create-client.dto.ts
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { SubscriptionType } from '@prisma/client';

export class CreateClientDto {
  // --- Infos Société ---
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() primaryColor?: string;

  // --- Abonnement ---
  @IsEnum(SubscriptionType) subscriptionType: SubscriptionType;

  // --- Infos Admin ---
  @IsEmail() @IsNotEmpty() adminEmail: string;
  @IsString() @IsNotEmpty() @MinLength(6) adminPassword: string;
  @IsString() @IsNotEmpty() adminFirstName: string;
  @IsString() @IsNotEmpty() adminLastName: string;

  // --- ✅ NOUVEAUX CHAMPS (Ceux qui bloquaient) ---
  @IsOptional() @IsString() logoUrl?: string;
  
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() activitySector?: string;

  @IsOptional() @IsString() ownerFirstName?: string;
  @IsOptional() @IsString() ownerLastName?: string;
  @IsOptional() @IsString() ownerAddress?: string;
  @IsOptional() @IsString() ownerCountry?: string;
  @IsOptional() @IsString() ownerBirthDate?: string;
  @IsOptional() @IsString() ownerBirthPlace?: string;
}