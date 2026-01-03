// apps/backend/src/tenants/tenant-provisioning.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import { Client } from 'pg';

import { PlatformPrismaService } from '../platform/platform-prisma.service';

const execFileAsync = promisify(execFile);

function normalizeTenantCode(code: string): string {
  return String(code ?? '').trim().toUpperCase();
}

@Injectable()
export class TenantProvisioningService {
  constructor(private readonly platform: PlatformPrismaService) {}

  async provisionTenant(params: {
    code: string;
    name: string;
    databaseUrl: string;
    createDatabase?: boolean;
  }): Promise<{ code: string; name: string; databaseUrl: string }> {
    const code = normalizeTenantCode(params.code);
    const name = String(params.name ?? '').trim();
    const databaseUrl = String(params.databaseUrl ?? '').trim();

    if (!code) throw new BadRequestException('Tenant code is required');
    if (!name) throw new BadRequestException('Tenant name is required');
    if (!databaseUrl) throw new BadRequestException('Tenant databaseUrl is required');

    // Platform DB obligatoire pour Phase 2
    if (!process.env.DATABASE_URL_PLATFORM) {
      throw new BadRequestException('DATABASE_URL_PLATFORM is not configured');
    }

    await this.platform.connect();

    const existing = await this.platform.tenant.findUnique({
      where: { code },
      select: { isActive: true },
    });

    if (existing?.isActive) {
      throw new ForbiddenException(`Tenant ${code} already exists and is active`);
    }

    if (params.createDatabase) {
      await this.createPostgresDatabaseIfMissing(databaseUrl);
    }

    // Migrations main schema sur la DB du tenant
    await this.runPrismaMigrateDeploy(databaseUrl);

    const tenant = await this.platform.tenant.upsert({
      where: { code },
      create: { code, name, databaseUrl, isActive: true },
      update: { name, databaseUrl, isActive: true },
      select: { code: true, name: true, databaseUrl: true },
    });

    return tenant;
  }

  async setTenantActive(codeRaw: string, isActive: boolean): Promise<void> {
    const code = normalizeTenantCode(codeRaw);
    if (!code) throw new BadRequestException('Tenant code is required');

    if (!process.env.DATABASE_URL_PLATFORM) {
      throw new BadRequestException('DATABASE_URL_PLATFORM is not configured');
    }

    await this.platform.connect();

    await this.platform.tenant.update({
      where: { code },
      data: { isActive },
    });
  }

  async listTenants(): Promise<
    { code: string; name: string; databaseUrl: string; isActive: boolean; createdAt: Date }[]
  > {
    if (!process.env.DATABASE_URL_PLATFORM) {
      throw new BadRequestException('DATABASE_URL_PLATFORM is not configured');
    }

    await this.platform.connect();

    return this.platform.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: { code: true, name: true, databaseUrl: true, isActive: true, createdAt: true },
    });
  }

  // -------------------------
  // Helpers
  // -------------------------

  private async createPostgresDatabaseIfMissing(databaseUrl: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new BadRequestException('Invalid databaseUrl (must be a valid postgres URL)');
    }

    const dbName = url.pathname.replace('/', '').trim();
    if (!dbName) {
      throw new BadRequestException('databaseUrl must include a database name (…/dbname)');
    }

    const adminUrl = new URL(databaseUrl);
    adminUrl.pathname = '/postgres';

    const client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();

    try {
      const exists = await client.query<{ datname: string }>(
        `SELECT datname FROM pg_database WHERE datname = $1`,
        [dbName],
      );

      if (exists.rowCount === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
      }
    } finally {
      await client.end();
    }
  }

  private async runPrismaMigrateDeploy(databaseUrl: string): Promise<void> {
    // robuste même si le process est lancé ailleurs
    const backendRoot = path.resolve(__dirname, '..', '..'); // src/tenants -> backend root

    await execFileAsync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['-s', 'exec', 'prisma', 'migrate', 'deploy'],
      {
        cwd: backendRoot,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      },
    );
  }
}
