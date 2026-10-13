-- ✅ v5.6 — platform_sso_assertions : anti-rejeu des assertions de connexion unique (console dkmoney.store).
-- Migration additive : aucune table existante n'est modifiée.

-- CreateTable
CREATE TABLE "platform_sso_assertions" (
    "jti" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_sso_assertions_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "platform_sso_assertions_expiresAt_idx" ON "platform_sso_assertions"("expiresAt");
