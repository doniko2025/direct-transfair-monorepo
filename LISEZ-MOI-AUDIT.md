# Corrections issues de l'audit du dépôt (à appliquer après le lot 14)

- backend `merchant-reports.service.ts` : Set typé `string` (erreur de compilation TS2345 sous Prisma réel — faisait échouer `nest build`).
- backend `merchant-staff.service.ts` : tableau `out` typé (même cause, `never[]`).
- mobile `admin/supervision.tsx` : appelait `/audit-logs` et `/alerts` (inexistants) → `/supervision/audit-logs` et `/supervision/alerts`.
- mobile `admin/transactions.tsx` : retrait du bouton « Modifier le montant » (route PATCH /transactions/:id inexistante, et modifier un montant après coup n'est pas souhaitable) ;
  « Supprimer » renommé « Annuler la transaction » (c'est ce que fait réellement le serveur : annulation + remboursement).
- `.env.example` : RATE_MAX_AGE_HOURS et MERCHANT_EXPIRY_CRON documentés.
- backend `merchants.service.ts` : `getAdmin` charge maintenant le logo (`...WITH_LOGO`) — erreur TS2345 vue au `pnpm run build`.
