// apps/backend/src/payments/simulation.flags.ts
// =========================================================
// Interrupteurs des paiements simulés (aucun PSP ni opérateur n'est branché pour le moment).
//
//   BLOCK_SIMULATED_RECHARGES=true   bloque les recharges carte / Orange Money / Sendwave (simulées : succès
//                                    systématique). À activer au lancement. Sans la variable, les recharges
//                                    simulées restent ouvertes, comme décidé pour la phase de test.
//   ALLOW_SIMULATED_PAYMENTS=true    rouvre POST /payments/initiate (dev / tests seulement). Cette route
//                                    permettait à l'expéditeur de marquer lui-même son envoi « payé » sans
//                                    que l'agence ait versé le cash : elle est fermée par défaut.
// =========================================================

const on = (name: string): boolean => String(process.env[name] ?? '').trim().toLowerCase() === 'true';

export const simulatedRechargesBlocked = (): boolean => on('BLOCK_SIMULATED_RECHARGES');
export const simulatedPaymentsAllowed = (): boolean => on('ALLOW_SIMULATED_PAYMENTS');
