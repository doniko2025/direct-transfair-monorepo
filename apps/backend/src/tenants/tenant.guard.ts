//apps/backend/src/tenants/tenant.guard.ts
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable, 
  BadRequestException, 
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    const tenantIdHeader = request.headers['x-tenant-id'];

    if (!tenantIdHeader) {
      this.logger.error('❌ Header x-tenant-id manquant');
      throw new BadRequestException('Tenant header (x-tenant-id) is missing');
    }

    const tenantCode = String(tenantIdHeader).trim().toUpperCase();

    const client = await this.prisma.client.findUnique({
      where: { code: tenantCode },
    });

    if (!client) {
      this.logger.error(`❌ Tenant introuvable en DB: ${tenantCode}`);
      throw new BadRequestException(`Société introuvable: ${tenantCode} (Base de données vide ?)`);
    }

    // ✅ CORRECTION : On compare uniquement avec l'Enum 'ACTIVE' (Majuscules)
    if (client.subscriptionStatus !== 'ACTIVE') {
       this.logger.error(`❌ Tenant inactif: ${tenantCode} (Status: ${client.subscriptionStatus})`);
       throw new BadRequestException(`Société inactive: ${tenantCode}`);
    }

    request.user = { ...request.user, clientId: client.id };
    
    return true;
  }
}