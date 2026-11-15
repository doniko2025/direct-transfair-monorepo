// apps/direct-transfair-mobile/utils/safeArea.ts
// =========================================================
// MARGE HAUTE SÛRE v1.0 — hauteur à réserver en haut d'un écran plein écran pour ne jamais passer sous la barre d'état.
// Pourquoi : sur Android en mode « bord à bord », StatusBar.currentHeight peut valoir 0 ou undefined et l'inset sécurisé
// arrive parfois à 0 au premier rendu → l'en-tête se retrouvait SOUS l'heure et la batterie. On prend donc le plus grand des
// trois (inset, hauteur de barre d'état, plancher de 28 px sur Android) et on traite 0 comme « inconnu ».
// =========================================================

import { Platform, StatusBar } from 'react-native';

export function safeTop(insetTop: number): number {
  if (Platform.OS === 'android') return Math.max(insetTop || 0, StatusBar.currentHeight || 0, 28);
  return Math.max(insetTop || 0, 12);
}
