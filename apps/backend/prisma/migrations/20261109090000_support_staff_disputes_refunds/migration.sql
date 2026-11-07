-- Lot 9 — compte service client (rôle SUPPORT) à permissions déléguées, litiges et demandes de remboursement.
-- Idempotente ; aucune donnée existante n'est modifiée.

-- 1. Rôle et valeurs d'audit (ADD VALUE : rien ne les utilise dans cette migration)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_REPLY';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_RESOLVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_STAFF_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPORT_PERMISSIONS_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFUND_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFUND_DECIDE';

-- 2. Délégations du service client
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supportPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 3. Litiges (tickets)
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "transactionId"  TEXT;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "outcome"        TEXT;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolvedById"   TEXT;
CREATE INDEX IF NOT EXISTS "support_tickets_transactionId_idx" ON "support_tickets"("transactionId");

-- 4. Demandes de remboursement
DO $$ BEGIN
  CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "refund_requests" (
  "id"            TEXT                  NOT NULL,
  "clientId"      INTEGER               NOT NULL,
  "transactionId" TEXT                  NOT NULL,
  "ticketId"      TEXT,
  "amount"        DECIMAL(18,4)         NOT NULL,
  "currency"      TEXT                  NOT NULL,
  "reason"        TEXT                  NOT NULL,
  "status"        "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT                  NOT NULL,
  "decidedById"   TEXT,
  "decisionNote"  TEXT,
  "decidedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)          NOT NULL,
  CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "refund_requests_clientId_status_idx" ON "refund_requests"("clientId", "status");
CREATE INDEX IF NOT EXISTS "refund_requests_transactionId_idx"   ON "refund_requests"("transactionId");
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_ticketId_fkey";
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
