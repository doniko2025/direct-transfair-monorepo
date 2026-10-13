-- ✅ v5.7 — client_portal_domains : suivi du déploiement du domaine de chaque société (lot C, console unique).
-- Migration additive : aucune table existante n'est modifiée ; deux valeurs ajoutées à l'enum AuditAction.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PORTAL_DOMAIN_SET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PORTAL_DOMAIN_REMOVE';

-- CreateEnum
CREATE TYPE "PortalDomainKind" AS ENUM ('SUBDOMAIN', 'CUSTOM');
CREATE TYPE "PortalDomainDnsMode" AS ENUM ('CLOUDFLARE', 'EXTERNAL');
CREATE TYPE "PortalDomainStatus" AS ENUM ('PENDING_NAMESERVERS', 'PENDING_VERIFICATION', 'ACTIVE', 'FAILED');

-- CreateTable
CREATE TABLE "client_portal_domains" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "kind" "PortalDomainKind" NOT NULL,
    "dnsMode" "PortalDomainDnsMode" NOT NULL DEFAULT 'CLOUDFLARE',
    "host" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "zoneId" TEXT,
    "nameServers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PortalDomainStatus" NOT NULL DEFAULT 'PENDING_NAMESERVERS',
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_portal_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_domains_clientId_key" ON "client_portal_domains"("clientId");
CREATE UNIQUE INDEX "client_portal_domains_host_key" ON "client_portal_domains"("host");
CREATE INDEX "client_portal_domains_status_lastCheckedAt_idx" ON "client_portal_domains"("status", "lastCheckedAt");
