// apps/backend/src/notifications/notification-space.ts
// Comptes séparés : à quelle boîte de réception (client / marchand) appartient une notification ?
//   • « merchant » : tout message qui ouvre un écran du compte marchand (/merchant, /merchant/payment…) ;
//   • « client »   : tout le reste (paiement effectué, demande à payer, envois, KYC, sécurité…).
// Sans `space` dans une requête : aucun filtre (portail web, anciennes versions de l'application).

export type NotificationSpace = 'client' | 'merchant';

export const parseNotificationSpace = (v: unknown): NotificationSpace | undefined => (v === 'merchant' || v === 'client' ? v : undefined);

/** L'espace d'une notification d'après l'écran qu'elle ouvre (les écrans d'administration /merchants/… sont des messages « client »). */
export function spaceOfAction(actionUrl?: string | null): NotificationSpace {
  return actionUrl && /^\/merchant(\/|\?|$)/.test(actionUrl) ? 'merchant' : 'client';
}
