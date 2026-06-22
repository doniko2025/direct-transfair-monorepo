ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "subdomain" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "clients_subdomain_key" ON "clients"("subdomain");
CREATE UNIQUE INDEX IF NOT EXISTS "clients_customDomain_key" ON "clients"("customDomain");