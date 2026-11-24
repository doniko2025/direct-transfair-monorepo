// apps/direct-transfair-mobile/app/operation/[id].tsx
// =========================================================
// ✅ v1 : détail d'une opération ouvert DEPUIS UN AUTRE ÉCRAN que la liste d'Activité (accueil, demandes d'argent…).
//
// Pourquoi une route à part ? Avant, l'accueil poussait « /(tabs)/transactions/<id> » : la page Détail était alors posée
// DANS la pile interne de l'onglet Activité, parfois comme seule page. Toucher ensuite l'onglet « Activité » rouvrait ce détail
// au lieu de la liste des opérations. Ici le détail vit dans la pile principale de l'application : le retour ramène
// exactement là d'où l'on vient, et la pile de l'onglet Activité reste intacte (toujours sur sa liste).
//
// Même écran que celui de l'onglet (aucune logique dupliquée) : on le ré-exporte simplement.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================
export { default } from "../(tabs)/transactions/[id]";
