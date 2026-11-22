# Montant à recevoir EXACT (option A) — 50 000 saisis = 50 000 reçus

## Cause du manque de 15 GNF
L'écran calculait l'envoi avec le taux affiché (10 500) alors que le taux garanti retient une marge de 0,2 % (10 479) : 50 000 GNF → 4,77 € → 49 985 GNF.

## Correction
- **App (send.tsx v7.5)** : quand le client saisit le montant dans « reçoit », l'envoi = montant ÷ (taux × facteur du taux garanti), arrondi au centime supérieur. Exemple : 50 000 GNF → 4,78 € (+ frais).
- **Serveur** : le taux garanti reçoit le montant saisi (`desiredReceivedAmount`) et crédite EXACTEMENT 50 000 GNF (garde-fous : jamais plus que le calcul, saisie incohérente ignorée).
- Nouvelle route `GET /rate-locks/config` → `{ rateFactor: 0.998 }` (lit `RATE_LOCK_MARGIN_PCT`). Absente / en erreur : l'app utilise 1 (ancien comportement).
- Le détail de la transaction affichera 4,78 € / 50 000 GNF avec un taux appliqué de 10 460 (il inclut l'arrondi du centime) : normal.

## ORDRE DE MISE EN LIGNE
1. D'abord le BACKEND (Render), 2. ensuite l'app. Une app à jour sur un ancien serveur n'obtiendrait pas la garantie de taux.

## Fichiers (chemins identiques au dépôt)
Backend (`apps/backend/src/growth/`) : `growth.rules.ts`, `growth.rules.spec.ts` (nouveaux tests), `growth.service.ts`, `growth.controller.ts`, `dto/growth.dto.ts`
Mobile (`apps/direct-transfair-mobile/`) : `services/api.ts`, `hooks/useRateLock.ts` (v1.1), `app/(tabs)/send.tsx` (v7.5)

## Vérifications
- `tsc --noEmit` mobile : 0 erreur. Backend : aucune erreur sur les fichiers modifiés (dépendances non installées ici : tests Jest non lancés ; le calcul clé a été vérifié à part : 10 479 → 4,78 € → crédit 50 000).
- Non testé ici : appareil réel, serveur en ligne.

## Gagner sur le taux de change (administrateur société, frais à 0)
Voir la réponse dans la conversation : l'écart entre le taux du marché et le taux que vous publiez (Taux de change › votre paire) + la marge de garantie (0,2 %, `RATE_LOCK_MARGIN_PCT`).
