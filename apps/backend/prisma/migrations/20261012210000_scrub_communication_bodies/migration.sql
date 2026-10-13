-- Phase 6 : le corps des emails et des SMS n'est plus enregistré (mots de passe temporaires, OTP, codes de retrait).
-- On efface ceux déjà stockés ; le destinataire, l'objet, le statut et les identifiants du fournisseur sont conservés.
UPDATE "communication_logs"
SET "htmlBody" = NULL,
    "textBody" = NULL,
    "smsContent" = NULL
WHERE "htmlBody" IS NOT NULL
   OR "textBody" IS NOT NULL
   OR "smsContent" IS NOT NULL;
