-- Audit argent (I4) — double validation des retraits de trésorerie.
CREATE TABLE IF NOT EXISTS "treasury_withdrawal_requests" (
  "id"            TEXT NOT NULL,
  "clientId"      INTEGER NOT NULL,
  "currency"      TEXT NOT NULL,
  "amount"        DECIMAL(18,4) NOT NULL,
  "reason"        TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy"   TEXT NOT NULL,
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "decidedBy"     TEXT,
  "decidedAt"     TIMESTAMP(3),
  "decisionNote"  TEXT,
  "failureReason" TEXT,
  CONSTRAINT "treasury_withdrawal_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "treasury_withdrawal_requests_clientId_status_idx" ON "treasury_withdrawal_requests"("clientId", "status");
CREATE INDEX IF NOT EXISTS "treasury_withdrawal_requests_status_expiresAt_idx" ON "treasury_withdrawal_requests"("status", "expiresAt");
