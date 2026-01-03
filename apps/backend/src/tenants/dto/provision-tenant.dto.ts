// apps/backend/src/tenants/dto/provision-tenant.dto.ts
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class ProvisionTenantDto {
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9_]+$/i, {
    message: 'code must be alphanumeric (underscore allowed)',
  })
  code!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  databaseUrl?: string;
}
