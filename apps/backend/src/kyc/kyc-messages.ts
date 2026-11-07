// apps/backend/src/kyc/kyc-messages.ts
// Texte des rappels de vérification d'identité (notification, push, e-mail).
import type { KycMessage } from './kyc-notifier.service';
import type { KycStatusName } from './kyc-rules';

export function reminderMessage(status: KycStatusName, rejectionReason: string | null): KycMessage {
  const base = { kind: 'REMINDER' as const, actionUrl: '/profile/kyc', actionLabel: "Vérification d'identité" };
  switch (status) {
    case 'REJECTED':
      return {
        ...base,
        priority: 'HIGH',
        title: "Pièce d'identité à renvoyer",
        body:
          `Votre dernière pièce a été refusée${rejectionReason ? ` (${rejectionReason})` : ''}. ` +
          "Tant qu'une pièce valide n'est pas envoyée et vérifiée, vous ne pouvez ni envoyer d'argent, ni programmer de virement, ni retirer.",
      };
    case 'EXPIRED':
      return {
        ...base,
        priority: 'HIGH',
        title: "Pièce d'identité expirée",
        body: "Votre pièce d'identité est expirée. Envoyez-en une nouvelle pour retrouver l'accès aux envois, virements et retraits.",
      };
    default:
      return {
        ...base,
        priority: 'HIGH',
        title: 'Vérifiez votre identité',
        body:
          "Envoyez votre pièce d'identité et un selfie pour pouvoir envoyer de l'argent, programmer des virements et retirer. " +
          "Cela prend 2 minutes ; un administrateur valide ensuite votre dossier.",
      };
  }
}

const fr = (d: Date): string => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** Rappel « votre pièce expire bientôt » (30 puis 7 jours avant). */
export function expiryNoticeMessage(daysLeft: number, expiryDate: Date, docLabel: string): KycMessage {
  const urgent = daysLeft <= 7;
  return {
    kind: 'EXPIRING',
    priority: urgent ? 'HIGH' : 'NORMAL',
    actionUrl: '/profile/kyc',
    actionLabel: "Vérification d'identité",
    title: urgent ? `Votre pièce d'identité expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : "Votre pièce d'identité expire bientôt",
    body:
      `Votre ${docLabel.toLowerCase()} est valable jusqu'au ${fr(expiryDate)} inclus (encore ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). ` +
      "Envoyez dès maintenant une pièce en cours de validité : à l'expiration, les envois, virements programmés et retraits sont bloqués jusqu'à la validation de la nouvelle pièce.",
  };
}
