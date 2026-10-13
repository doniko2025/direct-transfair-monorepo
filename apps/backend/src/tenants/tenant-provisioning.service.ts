// apps/backend/src/tenants/tenant-provisioning.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import { Client } from 'pg';

import { PlatformPrismaService } from '../platform/platform-prisma.service';

const execFileAsync = promisify(execFile);

/** Masque le mot de passe d'une URL de base : postgres://user:***@hôte/base. */
export function maskDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '***';
  }
}

/** Code société : lettres, chiffres, tiret et souligné (2 à 32 caractères). */
const TENANT_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
/** Nom de base : sert dans CREATE DATABASE "<nom>" — aucun caractère de citation ou d'espace. */
const DB_NAME_RE = /^[A-Za-z0-9_]{1,63}$/;

function assertPostgresUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid databaseUrl (must be a valid postgres URL)');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new BadRequestException('databaseUrl must start with postgres:// or postgresql://');
  }
  return url;
}

function databaseNameOf(url: URL): string {
  const dbName = url.pathname.replace('/', '').trim();
  if (!dbName) {
    throw new BadRequestException('databaseUrl must include a database name (…/dbname)');
  }
  if (!DB_NAME_RE.test(dbName)) {
    throw new BadRequestException('Database name: letters, digits and "_" only (63 characters max)');
  }
  return dbName;
}

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
    if (!TENANT_CODE_RE.test(code)) throw new BadRequestException('Tenant code: letters, digits, "-" or "_" (2 to 32 characters)');
    if (!name) throw new BadRequestException('Tenant name is required');
    if (!databaseUrl) throw new BadRequestException('Tenant databaseUrl is required');
    const parsedUrl = assertPostgresUrl(databaseUrl);
    if (params.createDatabase) databaseNameOf(parsedUrl);

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

    // L'adresse complète (avec mot de passe) reste en base ; elle ne repart jamais dans une réponse.
    return { ...tenant, databaseUrl: maskDatabaseUrl(tenant.databaseUrl) };
  }

  async setTenantActive(codeRaw: string, isActive: boolean): Promise<void> {
    const code = normalizeTenantCode(codeRaw);
    if (!code) throw new BadRequestException('Tenant code is required');
    if (typeof isActive !== 'boolean') throw new BadRequestException('isActive must be a boolean');

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

    const rows = await this.platform.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: { code: true, name: true, databaseUrl: true, isActive: true, createdAt: true },
    });
    return rows.map((t: { databaseUrl: string }) => ({ ...t, databaseUrl: maskDatabaseUrl(t.databaseUrl) })) as any;
  }

  // -------------------------
  // Helpers
  // -------------------------

  private async createPostgresDatabaseIfMissing(databaseUrl: string): Promise<void> {
    const url = assertPostgresUrl(databaseUrl);

    const dbName = databaseNameOf(url);

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
