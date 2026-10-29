// apps/direct-transfair-mobile/app/(tabs)/send.tsx
// =========================================================
// SEND MONEY v5.3 — Direct Transf'air
// ✅ v5.3 : REFONTE DE L'ENVOI D'ARGENT (écran plus compact, plus intuitif, sans erreur de saisie).
//  1) CARTE DE SAISIE : deux lignes compactes (≈ 60 px chacune) au lieu d'une grande carte ; devise toujours visible.
//  2) FLÈCHES D'INVERSION FONCTIONNELLES : on peut saisir le montant À LA RÉCEPTION (« Omar reçoit ») ; le montant à
//     envoyer est calculé (arrondi au centime supérieur) ; un second appui revient à la saisie « Vous envoyez ».
//     Le champ inactif est calculé à l'affichage (plus d'effets de synchronisation, plus de boucle).
//  3) DÉCIMALES : EUR/USD… gardent 2 chiffres après la virgule (7,63 € et non 8 €) ; XOF/GNF restent entiers, comme le
//     crédit réel côté serveur (utils/amount.ts). Plus aucun Math.round à l'entier ; reçu et récapitulatif alignés.
//  4) INDICATIF TÉLÉPHONE : le champ ne contient que le numéro national ; l'indicatif n'apparaît qu'UNE fois (bouton pays).
//     Un numéro collé « +224… » / « 00224… » change le pays tout seul ; un indicatif répété est retiré. La recherche envoie
//     « +<indicatif><numéro> » (E.164) puis, à défaut, la variante historique à indicatif doublé (utils/phone.ts).
//  5) DÉTECTION SÛRE : un contact n'est confirmé automatiquement que sur un numéro complet (≥ 7 chiffres) ou un nom /
//     e-mail exact ; les saisies partielles passent par la liste de suggestions. Recherche annulable (réponse tardive ignorée).
//  6) TAUX : calculé dès l'ouverture avec le pays par défaut (avant, il restait à 1 tant qu'aucun destinataire n'était choisi).
//  7) INTERFACE : en-tête compact (solde sur une ligne), contacts d'un tap quand le champ est vide, blocs resserrés, bouton
//     « Confirmer » FIXE en bas avec le total, message d'aide indiquant ce qu'il manque. Aucun texte tronqué.
//  LOGIQUE D'ENVOI (idempotence, payloads, reçu, solde insuffisant) INCHANGÉE.
// ✅ v5.2 : IDEMPOTENCE — chaque envoi porte une clé (services/idempotency.ts, champ `idempotencyKey`). Un double-tap, ou un
//    nouvel essai après une coupure réseau / un délai dépassé, renvoie l'envoi déjà créé au lieu de débiter une seconde fois.
//    Une clé est conservée tant que l'issue est incertaine, puis oubliée dès qu'une réponse définitive arrive. LOGIQUE D'ENVOI INCHANGÉE.
// ✅ v5.1 : FIX — on peut de nouveau choisir un autre bénéficiaire (Cash Pickup) que celui passé dans l'URL
//    (`beneficiaryId`) : les paramètres de route n'étaient pas appliqués une fois mais à chaque rendu,
//    ce qui réinitialisait la sélection. Voir « v3.2 » au-dessus de l'effet des paramètres. LOGIQUE D'ENVOI INCHANGÉE.
// ✅ v5.0 : DESIGN « CORRIDOR » — palette/polices issues du design system (feuille, forêt, brume), bouton d'envoi jaune
//    soleil (coins 20, 60 px), polices Manrope/Fraunces, icônes Lucide. Nouveau paramètre de route `amount` : le
//    montant saisi sur l'accueil arrive déjà rempli. LOGIQUE INCHANGÉE.
// ✅ v4.0 : 🔥 REFONTE TOTALE en thème clair (maquette « Flash Transfert / Transfert »). Fond crème,
//    en-tête allégé (retour, titre, solde en gros chiffres), onglets Wallet | Cash Pickup soulignés,
//    blocs blancs très arrondis, montants en gros chiffres, CTA en pilule à la couleur d'accent de la
//    société (texte auto-contrasté). Palette issue du design system components/ui (plus aucun vert,
//    ni nom de société codé en dur). LOGIQUE INCHANGÉE : modes WALLET / CASH, montants bidirectionnels,
//    détection du bénéficiaire, frais dynamiques, motif, reçu, chargement borné.
// ✅ v3.0 : REFONTE — écran qui ne reste plus bloqué sur « Chargement… »
//
//   CAUSE RACINE : l'écran entier était masqué par un `if (loading)`
//   tant que GET /exchange-rates ET GET /beneficiaries n'avaient pas
//   répondu (Promise.all, sans limite de temps). Sur un hébergeur qui
//   se réveille (Render Free : 30 à 60 s) ou un appel qui échoue, le
//   spinner tournait indéfiniment et l'utilisateur ne pouvait rien faire.
//   CORRECTIF :
//   - l'écran s'affiche tout de suite ; contacts et taux se chargent en
//     arrière-plan (Promise.allSettled + withTimeout, 20 s par défaut,
//     EXPO_PUBLIC_LOAD_TIMEOUT_MS) ; un bandeau « Réessayer » apparaît en
//     cas d'échec, un message rassurant si le serveur est lent ;
//   - le solde est lui aussi borné (repli sur le solde du profil) ;
//   - toute la logique d'envoi (modes Wallet/Cash, saisie bidirectionnelle,
//     détection du bénéficiaire, frais, reçu) est STRICTEMENT inchangée.
//   DESIGN (white-label) : toutes les couleurs vertes codées en dur sont
//   remplacées par la palette dérivée de la couleur de marque du tenant
//   (useWalletTheme) ; chiffres en police système (lisibles, alignés).
//   Nom de la société = branding.name du tenant (reçu, badge « utilisateur ») —
//   était « Direct Transf'air » écrit en dur.
//   Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================
// ── Historique ──
// SEND MONEY v2.15 — Direct Transf'air
// ✅ v2.15 : NOUVEAU — Saisie bidirectionnelle du montant
//
//   Avant : seul le champ "VOUS ENVOYEZ" (rawAmount) était éditable ;
//   le champ "REÇOIT" n'était qu'un <Text> en lecture seule, calculé
//   comme sendAmount * rate.
//
//   Maintenant : le champ "REÇOIT" est lui aussi un <TextInput>
//   (rawReceivedAmount), et un état amountSource ("SEND" | "RECEIVED")
//   retient lequel des deux champs l'utilisateur est en train de
//   saisir. sendAmount est dérivé dans le sens correspondant :
//     - amountSource === "SEND"     → sendAmount = rawAmount (inchangé)
//     - amountSource === "RECEIVED" → sendAmount = rawReceivedAmount / rate
//   Deux useEffect synchronisent le champ INACTIF à chaque frappe dans
//   le champ ACTIF (jamais l'inverse) — c'est ce garde qui empêche une
//   boucle infinie entre les deux champs et évite que le curseur saute
//   pendant la saisie.
//   Aucun autre calcul touché : frais (feesAmt), total (totalAmt),
//   solde insuffisant (insufficient), création de transaction
//   (handleAction) — tous continuent de lire sendAmount, qui reste le
//   seul point d'entrée unique vers le reste de l'écran, quel que soit
//   le champ utilisé pour la saisie.
// ✅ v2.14 : 🚨 3 correctifs + 1 nouvelle fonctionnalité
//
//   NOUVEAU — Autocomplétion téléphone (mode Wallet)
//     Dès que l'utilisateur tape ≥2 chiffres dans le champ téléphone,
//     une liste déroulante propose les bénéficiaires SAUVEGARDÉS dont
//     le numéro contient ces chiffres (numéros qui COMMENCENT par la
//     saisie affichés en premier), avec nom + numéro complet + drapeau
//     pays. Un tap remplit walletInput avec le numéro complet et
//     confirme detectedBeneficiary immédiatement (sans attendre le
//     debounce de 450ms de la détection existante). Composant
//     PhoneSuggestionsList, purement additif — la détection par
//     suffixe existante (v2.10) et le fallback plateforme ne sont pas
//     touchés, ils continuent de tourner en parallèle et prennent le
//     relais si aucune suggestion n'est sélectionnée.
//
//   FIX 1 — canSend / handleAction incohérents
//     canSend autorisait l'envoi dès walletInput.length >= 3, mais
//     handleAction() rejetait tout ce qui était < 7 caractères sans
//     detectedBeneficiary. Entre 3 et 6, le bouton "CONFIRMER LE
//     TRANSFERT" était cliquable et retournait systématiquement une
//     Alert.alert("Erreur", "Numéro trop court..."). Les deux
//     utilisent maintenant EXACTEMENT la même condition
//     (detectedBeneficiary || walletInputDigits.length >= 7).
//
//   FIX 2 — walletInput.length comptait les caractères bruts, pas les
//     chiffres. Un numéro saisi avec espaces/tirets faussait le seuil
//     de 7 dans un sens comme dans l'autre. walletInputDigits
//     (walletInput.replace(/\D/g, "")) est maintenant calculé une
//     seule fois et réutilisé partout (canSend, handleAction, la
//     détection existante, phoneSuggestions) au lieu d'être recalculé
//     différemment à 3 endroits.
//
//   FIX 3 — 🚨 updateCurrencyContext() : taux de change quasiment
//     toujours le fallback codé en dur, jamais le taux réel configuré
//     par l'admin
//     PROBLÈME RÉSOLU (juillet 2026) : getR() cherchait des paires au
//     format underscore ("EUR_XOF") dans allRates — mais
//     RatesService.getAll() (backend, rates.service.ts v3.1) renvoie
//     explicitement ses paires au format SLASH ("EUR/XOF"), précisément
//     pour la rétrocompatibilité avec le frontend mobile (voir son
//     propre changelog v3.1). Résultat : la recherche par égalité
//     stricte ne matchait JAMAIS une paire réelle, et getR() retombait
//     SYSTÉMATIQUEMENT sur le fallback fb — peu importe les taux
//     configurés dans Paramètres > Taux de Change côté admin.
//     Par ailleurs, le fallback de toEurUser ne gérait que le cas XOF
//     ("EUR_XOF" 655.95) — un expéditeur en GNF (Guinée) tombait sur
//     fb=1, alors que toEurTarget gérait déjà GNF (8600) côté
//     destinataire. Cette asymétrie donnait des montants reçus faux
//     dès qu'un des deux côtés (source ou cible) était GNF/USD/GBP.
//     CORRECTIF : getR() vérifie maintenant les deux formats
//     (underscore ET slash, même principe défensif que
//     RatesService.convert() côté backend) ; le fallback de toEurUser
//     couvre désormais XOF et GNF, symétriquement à toEurTarget.
//     ⚠️ Le même bug de format existe dans send-cash.tsx (getR
//     identique) — non corrigé ici, hors périmètre de cette demande.
// ✅ v2.1 : fmt() max 2 décimales
// ✅ v2.2 : fond blanc neutre #FAFAFA
// ✅ v2.3 : FIX taux hardcodé 1,5% → cashFeeRate dynamique
// ✅ v2.4 : Motif du transfert
// ✅ v2.5 : FIX solde avec décimales
// ✅ v2.6 : Bouton "+" AddBeneficiaryCard dans Cash Pickup
// ✅ v2.7 : Layout compact — suppression des espaces vides excessifs
//    - Hero : paddingBottom 28→16, headerTop marginBottom 20→12
//    - balanceVal fontSize 36→30
//    - scroll paddingTop 16→10, gap inter-blocs 14→10
//    - block padding 18→13, blockHeader marginBottom 16→10
//    - ModeTab paddingVertical 12→8
//    - BeneficiaryCard/AddBeneficiaryCard : taille réduite (76→72px)
//    - amountCard padding 16→12, inputs 24→22px
//    - motifRow padding 16→12
// ✅ v2.8 : Remplacement des Alert.alert "succès" (Wallet ET Cash Pickup)
//    par une modale Reçu réutilisable (ReceiptModal) :
//    - Affiche montant, bénéficiaire, code de retrait (Cash Pickup),
//      référence, devise/montant reçu
//    - Bouton "Partager" → sélecteur natif (WhatsApp, email, SMS…)
//      via l'API Share de React Native
//    - Bouton "Copier le code" via expo-clipboard (Cash Pickup uniquement)
//      ⚠️ nécessite `npx expo install expo-clipboard` si pas déjà installé
//    - La navigation vers /(tabs)/transactions se fait à la fermeture
//      de la modale (bouton "Terminé"), au lieu d'être immédiate
//    - Code de retrait lu depuis transaction.providerRef (== reference,
//      confirmé via transactions.service.ts backend tant que
//      senderFirstName n'est pas envoyé), avec découpe défensive du
//      format "code|prénom" utilisé pour les expéditeurs invités
// ✅ v2.9 : HERO SANS VERT + CARTE FLOTTANTE (même traitement que le
//    Client Dashboard v9.4) — PUREMENT PRÉSENTATIONNEL, aucune ligne de
//    logique métier touchée (mêmes states, mêmes calculs, mêmes appels API).
//    - Fond du header : vert (#065F46) → gris clair, fondu avec le fond
//      de page (C.bg), pour ne plus faire "bloc vert" en haut d'écran.
//    - Cercles décoratifs translucides blancs (hdeco1/hdeco2, pensés pour
//      un fond vert) supprimés — plus pertinents sur fond clair.
//    - Bouton retour / bouton œil : cercles "glass" blancs → cercles
//      blancs pleins avec bordure + légère ombre, icônes en encre foncée
//      (au lieu de blanc sur vert).
//    - Titre du header : blanc → encre foncée (C.text).
//    - Bloc solde : devient une carte flottante blanche détachée
//      (`balanceCard`) avec ombre marquée, libellé et montant en encre
//      foncée/sourdine (au lieu de blanc sur vert), + léger filigrane
//      décoratif (icône wallet, opacité quasi nulle), même esprit que le
//      Client Dashboard. Le badge "Solde insuffisant" reste ambre,
//      inchangé.
//    - StatusBar : light-content/vert → dark-content/gris clair.
// ✅ v2.10 : DÉTECTION FACILE NOM/PRÉNOM PAR NUMÉRO DE TÉLÉPHONE
//    - FIX normalisation : la regex fragile qui retirait les 3 premiers
//      chiffres (pensant que c'était l'indicatif pays) est remplacée par
//      une comparaison par SUFFIXE sur tous les chiffres saisis
//      (inputDigits), robuste à n'importe quel indicatif (+221, 00221…).
//    - NOUVEAU : si aucun bénéficiaire SAUVEGARDÉ ne correspond et que
//      l'input contient ≥ 7 chiffres → fallback debouncé (450ms) vers
//      GET /users/by-phone?q=<chiffres> pour détecter un utilisateur
//      Direct Transf'air déjà inscrit mais non enregistré comme contact.
//      Le nom/prénom retournés sont injectés dans `detectedBeneficiary`
//      (même state qu'avant, aucun changement de l'API publique du
//      composant) via un pseudo-bénéficiaire marqué `isFavorite: false`.
//    - UI : badge "TROUVÉ" (vert, contact sauvegardé) vs badge
//      "UTILISATEUR DIRECT TRANSF'AIR" (bleu, détecté sur la plateforme
//      mais pas encore enregistré), avec lien "+ Enregistrer comme
//      contact" sous la carte dans ce second cas.
//    - Aucune autre logique métier touchée (calculs, envoi, devises).
// ✅ v2.11 : REFONTE HEADER — dégradé sombre + solde intégré + sheet
//    arrondie (même traitement que le Client Dashboard v9.8) —
//    PUREMENT PRÉSENTATIONNEL, aucune ligne de logique métier touchée
//    (mêmes states, mêmes calculs, mêmes appels API, mêmes routes, la
//    détection bénéficiaire v2.10 intacte, les 4 modales — Motif, pays,
//    Fallback, Reçu — intactes au caractère près).
//    - Header : fond C.bg plat → dégradé sombre (expo-linear-gradient,
//      C.g1 → C.g3, déjà présents dans la palette de ce fichier, aucune
//      couleur inventée).
//    - La carte solde flottante (balanceCard) est supprimée : le solde
//      vit maintenant à même le header, comme le Client Dashboard.
//      fontSize du montant INCHANGÉ (30) — contrairement au Dashboard,
//      cet écran reste volontairement compact (cf. v2.7).
//    - Filigrane wallet : couleur adaptée (vert translucide au lieu du
//      brun, illisible sur fond sombre).
//    - Bouton retour / bouton œil : cercles blancs pleins → style
//      "verre" (fond blanc à 10 % d'opacité), icônes en blanc. Forme
//      inchangée (carré arrondi 12, pas de cercle — c'était déjà la
//      convention de cet écran, différente du Dashboard).
//    - Titre du header : encre foncée → blanc.
//    - paddingBottom du header : 14 → 32 (place pour le chevauchement
//      de la sheet). paddingTop du header INCHANGÉ — le
//      `Platform.OS === "android" ? 44 : 10` existant n'est pas touché,
//      ce n'est pas lié au visuel et je préfère ne pas toucher un
//      réglage qui n'a pas été demandé.
//    - NOUVEAU : KeyboardAvoidingView + ScrollView enveloppés dans une
//      sheet à coins arrondis (24) qui chevauche le header (marginTop
//      -20). Fond de la sheet : C.bg (inchangé) → AUCUN changement sur
//      les blocks existants (Bénéficiaire, Montant, Motif,
//      Récapitulatif, CTA, les 4 modales). scroll.paddingTop 10 → 16
//      pour respirer sous l'arrondi.
//      ⚠️ Si jamais tu observes un souci d'affichage à l'ouverture du
//      clavier (peu probable), le premier réflexe est de retirer
//      `overflow:"hidden"` de `s.sheet` — c'est le seul point de
//      contact entre ce changement et le clavier.
//    - StatusBar : dark-content → light-content, backgroundColor aligné
//      sur C.g1.
//    - Réutilise expo-linear-gradient (déjà installé pour le Client
//      Dashboard v9.8) — aucune nouvelle dépendance ici.
// ✅ v2.12 : 🚨 FIX — getCountryData() retournait le mauvais pays sur
//    collision de préfixe textuel, + devise cible mal déduite pour la
//    plupart des pays
//
//   PROBLÈME 1 RÉSOLU — getCountryData("Guinée") → Guinée-Bissau (+245)
//     "Guinée" est un préfixe textuel de "Guinée-Bissau", qui apparaît
//     AVANT "Guinée" dans countriesList. L'ancien getCountryData()
//     faisait un simple .includes() sur toute la liste dans l'ordre —
//     donc chercher "Guinée" tombait systématiquement sur l'entrée
//     "Guinée-Bissau" (+245 🇬🇼) avant d'atteindre la vraie entrée
//     "Guinée" (+224 🇬🇳) plus bas dans le tableau. Repro exacte
//     observée : taper sur "Guinée" dans le picker Indicatif pays fixe
//     d'abord targetCountryData correctement (l'item tapé, exact), mais
//     l'appel juste après à updateCurrencyContext(item.name) rappelle
//     getCountryData("Guinée") en interne, qui écrasait aussitôt ce
//     choix correct avec Guinée-Bissau. D'où le +245 affiché malgré la
//     sélection explicite de la Guinée.
//     CORRECTIF : getCountryData() cherche maintenant une correspondance
//     EXACTE (nom normalisé, casse + espaces ignorés) en priorité ; le
//     .includes() d'origine devient un simple repli, conservé pour
//     tolérer des données bénéficiaire imparfaites.
//
//   PROBLÈME 2 RÉSOLU — devise cible mal déduite pour la plupart des pays
//     updateCurrencyContext() déduisait la devise via une chaîne de
//     .includes() codée en dur qui ne couvrait que Guinée/Maroc/France/
//     Belgique/Allemagne/Espagne/Italie/Portugal — et ratait même le
//     Luxembourg dans son propre groupe EUR. Tout le reste (Gambie,
//     Liberia, Sierra Leone, Cameroun, Algérie, Tunisie, Angola,
//     Mauritanie, Suisse, Royaume-Uni, États-Unis, Canada, Émirats
//     Arabes Unis, Chine) retombait silencieusement sur XOF — alors que
//     countriesList contient déjà le bon code ISO pour chacun
//     (cd.currency). CORRECTIF : réutilisation directe de cd.currency au
//     lieu de la liste .includes() partielle.
// ✅ v2.13 : 🚨 FIX — code de retrait jamais affiché en mode Wallet pour
//    un transfert non réclamé immédiatement
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   En mode Wallet, si aucun destinataire n'est résolu immédiatement
//   (numéro non reconnu par la plateforme, mais ≥7 chiffres donc envoi
//   autorisé), le backend (transactions.service.ts create()) traite ce
//   cas exactement comme un Cash Pickup non réclamé : transaction
//   PENDING/VALIDATED avec un code de retrait généré (transactionRef,
//   dans providerRef/reference). Mais ReceiptData.code n'était rempli
//   QUE dans la branche Cash — jamais en mode Wallet. Résultat concret :
//   l'argent est bien débité, la transaction existe bien côté serveur
//   avec un vrai code de retrait, mais le reçu affiché à l'expéditeur
//   ne montre ce code nulle part — aucun moyen pour lui de savoir
//   comment le destinataire pourra réclamer les fonds.
//   CORRECTIF : après la création, on vérifie tx.recipientId. S'il est
//   absent (transfert non réclamé), le code est extrait exactement
//   comme en mode Cash (providerRef ?? reference, découpe défensive du
//   format "code|prénom") et injecté dans ReceiptData.code. Si
//   recipientId est présent (destinataire résolu, crédité
//   immédiatement), code reste undefined — comportement inchangé.
// =========================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal, FlatList, StatusBar, Animated, Share, LayoutAnimation, UIManager,
} from 'react-native';
import * as Clipboard from "expo-clipboard";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from '../../components/ui/Icon';
import { api } from "../../services/api";
import { runOnce } from "../../services/idempotency";
import { useAuth } from "../../providers/AuthProvider";
import type { Beneficiary, ExchangeRate } from "../../services/types";
import { countriesList, CountryData } from "../../data/countries";
import { useTenant } from "../../providers/TenantProvider";
import { useUI, buildColors, type UIColors } from "../../components/ui/theme";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../components/wallet/useLoader";
import {
  MIN_FULL_NUMBER, countryOfPhone, formatPhone, isNumericLike, nationalOf, onlyDigits, parseInternational, stripDial, toE164, toLegacyDoubled,
} from "../../utils/phone";
import {
  ceilTo, decimalsFor, fmtMoney, fmtRate, parseAmount, roundTo, sanitizeAmountInput, toInputText,
} from "../../utils/amount";

import { Text, TextInput } from '../../components/ui/Text';
import { SANS, SERIF } from '../../components/ui/fonts';

// Animation de l'échange des deux champs (Android : à activer explicitement ; sans effet si déjà géré par le système).
if (Platform.OS === "android") {
  try { UIManager.setLayoutAnimationEnabledExperimental?.(true); } catch { /* ignoré */ }
}

// ✅ v3.0 — police des chiffres : système (lisible, chiffres alignés) ;
// plus de Georgia/serif pour les montants.
const F = {
  display: SANS as string,
  body:    SANS as string,
};

// ✅ v3.0 — palette dynamique : les tons « g* » dérivent de la couleur de
// marque du tenant (white-label), plus aucun vert codé en dur.
function makeColors(U: UIColors) {
  return {
    // « g* » : tons de marque lisibles sur fond clair (g4 = accent foncé, g5 = accent pur)
    g1: U.bg, g2: U.bg, g3: U.bg, g4: U.accentDeep,
    g5: U.accent, g6: U.accentLine, gSoft: U.accentSoft, gBorder: U.accentLine,
    accent: U.sun, accentInk: U.sunInk, ink: U.ink, field: U.field, beige: U.beige,
    white: "#FFFFFF",
    bg: U.bg,
    surface: U.surface,
    border: U.line,
    borderLight: U.line,
    text: U.ink, textSub: U.text, textMuted: U.muted, textFaint: U.faint,
    danger: U.danger, dangerSoft: U.dangerBg,
    amber: U.warn, amberSoft: U.warnBg, amberLine: U.warnLine,
    blue: U.info, blueSoft: U.infoBg, blueLine: U.infoLine,
    orange: "#EA580C", orangeSoft: "#FFF7ED",
    heroMuted: U.muted,
  };
}
type Colors = ReturnType<typeof makeColors>;

// ─── Motifs du transfert ──────────────────────────────────
const MOTIFS = [
  { icon: "👨‍👩‍👧", label: "Assistance familiale" },
  { icon: "🪙",    label: "Épargne / Investissements" },
  { icon: "💗",    label: "Oeuvre caritative / Don" },
  { icon: "🛒",    label: "Paiement de marchandises" },
  { icon: "✈️",    label: "Frais de voyage" },
  { icon: "📚",    label: "Frais scolaires" },
  { icon: "🏠",    label: "Loyer / Hypothèque" },
  { icon: "🏥",    label: "Assistance médicale" },
  { icon: "💳",    label: "Paiement de taxes" },
] as const;

// ─── Helpers ──────────────────────────────────────────────
// ✅ v2.12 — FIX : match EXACT en priorité (voir changelog en tête de
// fichier). L'ancien comportement (.includes() seul) faisait retomber
// "Guinée" sur "Guinée-Bissau".
const getCountryData = (countryName: string): CountryData => {
  const normalized = (countryName || "").toLowerCase().trim();
  if (!normalized) return countriesList.find((c) => c.code === "SN")!;

  const exact = countriesList.find((c) => c.name.toLowerCase() === normalized);
  if (exact) return exact;

  // Repli tolérant (sous-chaîne) — conservé pour les données
  // bénéficiaire imparfaites (variantes de saisie, espace en trop…).
  return (
    countriesList.find((c) => c.name.toLowerCase().includes(normalized)) ||
    countriesList.find((c) => c.code === "SN")!
  );
};

// Taille des chiffres d'un montant : réduite quand le nombre s'allonge, pour qu'il reste lisible
// sans jamais repousser la pastille de devise.
const amountFontSize = (text: string, base: number): number => {
  const n = text.length;
  if (n <= 9) return base;
  if (n <= 12) return Math.round(base * 0.8);
  return Math.round(base * 0.62);
};

// ✅ v5.3 — formatage des montants centralisé (utils/amount.ts) : 2 décimales pour EUR/USD…, entiers pour XOF/GNF.
const fmt = (val: number, currency?: string): string => fmtMoney(val, currency);

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

const initialOf = (name: string): string => (name?.trim()?.[0] ?? "?").toUpperCase();
const initialsOf = (name: string): string =>
  (name ?? "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// ─── Mode Tab (contrôle segmenté) ─────────────────────────
function ModeTab({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  const { C, tS } = useSendTheme();
  return (
    <TouchableOpacity
      style={[tS.tab, active && tS.tabActive]}
      onPress={onPress} activeOpacity={0.85}
      accessibilityRole="tab" accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon as any} size={16} color={active ? C.ink : C.textMuted} />
      <Text style={[tS.txt, { fontFamily: F.body }, active && tS.txtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
const make_tS = (C: Colors) => StyleSheet.create({
  tab:       { flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 11 },
  tabActive: { backgroundColor: C.surface, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  txt:       { fontSize: 14, fontWeight: "600", color: C.textMuted },
  txtActive: { color: C.ink, fontWeight: "800" },
});

// ─── Beneficiary Card ─────────────────────────────────────
function BeneficiaryCard({ item, selected, onPress }: {
  item: Beneficiary; selected: boolean; onPress: () => void;
}) {
  const { C, bS } = useSendTheme();
  const scale    = useRef(new Animated.Value(1)).current;
  const cd       = getCountryData(item.country);
  const initials = initialsOf(item.fullName);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[bS.card, selected && bS.cardSelected]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
        accessibilityLabel={item.fullName}
      >
        <View style={[bS.avatar, selected && bS.avatarSelected]}>
          <Text style={[bS.avatarTxt, { fontFamily: F.display }, selected && { color: C.g4 }]}>{initials}</Text>
        </View>
        <Text style={[bS.name, { fontFamily: F.body }, selected && { color: C.g4 }]}>
          {item.fullName.split(" ")[0]}
        </Text>
        <Text style={bS.flag}>{cd.flag}</Text>
        {selected && (
          <View style={bS.check}><Ionicons name="checkmark" size={10} color={C.white} /></View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const make_bS = (C: Colors) => StyleSheet.create({
  card:           { width: 76, alignItems: "center", marginRight: 8, paddingVertical: 8, paddingHorizontal: 6, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border },
  cardSelected:   { borderColor: C.g4, backgroundColor: C.gSoft },
  avatar:         { width: 38, height: 38, borderRadius: 12, backgroundColor: C.beige, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  avatarSelected: { backgroundColor: `${C.g4}20` },
  avatarTxt:      { fontSize: 15, fontWeight: "900", color: C.textSub },
  name:           { fontSize: 11.5, fontWeight: "700", color: C.textSub, textAlign: "center" },
  flag:           { fontSize: 13, marginTop: 2 },
  check:          { position: "absolute", top: -5, right: -5, backgroundColor: C.g4, borderRadius: 99, width: 20, height: 20, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: C.white },
});

// ─── ✅ v2.6 — Add Beneficiary Card (bouton "+") ──────────
function AddBeneficiaryCard({ onPress }: { onPress: () => void }) {
  const { C, abS } = useSendTheme();
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={abS.card}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
        accessibilityLabel="Ajouter un bénéficiaire"
      >
        <View style={abS.iconBox}>
          <Ionicons name="add" size={24} color={C.g4} />
        </View>
        <Text style={[abS.label, { fontFamily: F.body }]}>Nouveau</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const make_abS = (C: Colors) => StyleSheet.create({
  card:    {
    width: 76, alignItems: "center", marginRight: 8, paddingVertical: 8, paddingHorizontal: 6,
    backgroundColor: C.gSoft, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.g4,
    borderStyle: "dashed",
  },
  iconBox: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: `${C.g4}18`,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  label:   { fontSize: 11.5, fontWeight: "700", color: C.g4, textAlign: "center", marginBottom: 14 },
});

// ─── ✅ v2.14 — Suggestions (autocomplétion) ──────────────
// Liste affichée sous le champ dès que la saisie correspond à un ou plusieurs contacts enregistrés.
// Un tap remplit le champ avec le numéro national, confirme le bénéficiaire immédiatement (pas d'attente du
// debounce) et règle le pays. ✅ v5.3 : le numéro est affiché avec l'indicatif UNE seule fois.
function PhoneSuggestionsList({ suggestions, onSelect }: {
  suggestions: Beneficiary[]; onSelect: (b: Beneficiary) => void;
}) {
  const { C, psS } = useSendTheme();
  return (
    <View style={psS.wrap}>
      {suggestions.map((b, i) => {
        const cd     = getCountryData(b.country);
        const isLast = i === suggestions.length - 1;
        return (
          <TouchableOpacity
            key={String(b.id)}
            style={[psS.row, isLast && { borderBottomWidth: 0 }]}
            onPress={() => onSelect(b)}
            activeOpacity={0.75}
          >
            <View style={psS.avatar}>
              <Text style={[psS.avatarTxt, { fontFamily: F.display }]}>{initialsOf(b.fullName)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[psS.name, { fontFamily: F.body }]}>{b.fullName}</Text>
              {!!b.phone && (
                <Text style={[psS.phone, { fontFamily: F.body }]}>{formatPhone(b.phone)}</Text>
              )}
            </View>
            <Text style={psS.flag}>{cd.flag}</Text>
            <Ionicons name="arrow-forward-circle-outline" size={16} color={C.g4} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const make_psS = (C: Colors) => StyleSheet.create({
  wrap:      { marginTop: 8, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  avatar:    { width: 32, height: 32, borderRadius: 10, backgroundColor: C.gSoft, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 13, fontWeight: "900", color: C.g4 },
  name:      { fontSize: 13.5, fontWeight: "700", color: C.text },
  phone:     { fontSize: 12, color: C.textMuted, fontWeight: "600", marginTop: 1 },
  flag:      { fontSize: 16 },
});

// ─── Summary Row ──────────────────────────────────────────
function SummaryRow({ label, value, valueColor, large }: {
  label: string; value: string; valueColor?: string; large?: boolean;
}) {
  const { srS } = useSendTheme();
  return (
    <View style={srS.row}>
      <Text style={[srS.label, { fontFamily: F.body }, large && srS.labelLarge]}>{label}</Text>
      <Text style={[srS.value, { fontFamily: large ? F.display : F.body }, large && srS.valueLarge, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}
const make_srS = (C: Colors) => StyleSheet.create({
  row:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 7 },
  label:      { flexShrink: 1, fontSize: 13, color: C.textMuted, fontWeight: "600" },
  value:      { flexShrink: 1, textAlign: "right", fontSize: 14, color: C.text, fontWeight: "700" },
  labelLarge: { fontSize: 14, color: C.text, fontWeight: "800" },
  valueLarge: { fontSize: 22, color: C.g4, letterSpacing: -0.4 },
});

// ─── Fallback Modal ───────────────────────────────────────
function FallbackModal({ visible, missing, currency, onClose, onOrangeMoney, onCard }: {
  visible: boolean; missing: number; currency: string;
  onClose: () => void; onOrangeMoney: () => void; onCard: () => void;
}) {
  const { C, fbS } = useSendTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fbS.overlay}>
        <View style={fbS.sheet}>
          <View style={fbS.handle} />
          <View style={fbS.warningBox}>
            <Ionicons name="wallet-outline" size={24} color={C.amber} />
            <View style={{ flex: 1 }}>
              <Text style={[fbS.warnTitle, { fontFamily: F.body }]}>Solde insuffisant</Text>
              <Text style={[fbS.warnSub, { fontFamily: F.body }]}>
                Il vous manque <Text style={fbS.warnAmount}>{fmt(missing, currency)} {currency}</Text>
              </Text>
            </View>
          </View>
          <Text style={[fbS.chooseTitle, { fontFamily: F.body }]}>Choisissez un moyen de paiement</Text>
          <TouchableOpacity style={[fbS.option, { borderColor: "#F97316" }]} onPress={onOrangeMoney} activeOpacity={0.85}>
            <View style={[fbS.optIcon, { backgroundColor: "#FFF7ED" }]}><Text style={{ fontSize: 24 }}>🟠</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[fbS.optTitle, { fontFamily: F.body, color: C.orange }]}>Orange Money</Text>
              <Text style={[fbS.optSub, { fontFamily: F.body }]}>Payer depuis votre compte Orange</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.orange} />
          </TouchableOpacity>
          <TouchableOpacity style={[fbS.option, { borderColor: C.blue }]} onPress={onCard} activeOpacity={0.85}>
            <View style={[fbS.optIcon, { backgroundColor: C.blueSoft }]}><Ionicons name="card-outline" size={22} color={C.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[fbS.optTitle, { fontFamily: F.body, color: C.blue }]}>Carte bancaire</Text>
              <Text style={[fbS.optSub, { fontFamily: F.body }]}>Visa, Mastercard, CB</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity style={fbS.cancelBtn} onPress={onClose}>
            <Text style={[fbS.cancelTxt, { fontFamily: F.body }]}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: Platform.OS === "ios" ? 24 : 12 }} />
        </View>
      </View>
    </Modal>
  );
}
const make_fbS = (C: Colors) => StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  handle:     { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.amberSoft, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" },
  warnTitle:  { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 3 },
  warnSub:    { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  warnAmount: { color: C.amber, fontWeight: "900" },
  chooseTitle:{ fontSize: 13, fontWeight: "900", color: C.textMuted, letterSpacing: 0.8, marginBottom: 12 },
  option:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 10, backgroundColor: C.white },
  optIcon:    { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  optTitle:   { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  optSub:     { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  cancelBtn:  { alignItems: "center", paddingVertical: 12 },
  cancelTxt:  { fontSize: 15, fontWeight: "700", color: C.textMuted },
});

// ─── Motif Modal ──────────────────────────────────────────
function MotifModal({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: string | null;
  onSelect: (m: string) => void;
  onClose: () => void;
}) {
  const { C, mmS } = useSendTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mmS.overlay}>
        <View style={mmS.sheet}>
          <View style={mmS.handle} />
          <View style={mmS.head}>
            <View style={{ flex: 1 }}>
              <Text style={[mmS.title, { fontFamily: F.display }]}>Motif du transfert</Text>
              <Text style={[mmS.sub, { fontFamily: F.body }]}>
                Choisissez un motif ci-dessous. Cette information restera confidentielle.
              </Text>
            </View>
            <TouchableOpacity style={mmS.closeBtn} onPress={onClose} accessibilityLabel="Fermer">
              <Ionicons name="close" size={18} color={C.textSub} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            {MOTIFS.map((m) => {
              const isSelected = selected === m.label;
              return (
                <TouchableOpacity
                  key={m.label}
                  style={[mmS.item, isSelected && mmS.itemSelected]}
                  onPress={() => { onSelect(m.label); onClose(); }}
                  activeOpacity={0.75}
                >
                  <Text style={mmS.itemIcon}>{m.icon}</Text>
                  <Text style={[
                    mmS.itemLabel, { fontFamily: F.body },
                    isSelected && { color: C.g4, fontWeight: "800" },
                  ]}>
                    {m.label}
                  </Text>
                  <View style={[mmS.radio, isSelected && mmS.radioSelected]}>
                    {isSelected && <View style={mmS.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const make_mmS = (C: Colors) => StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingHorizontal: 20, paddingTop: 0, paddingBottom: 0 },
  handle:       { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 6 },
  head:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight, marginBottom: 4 },
  title:        { fontSize: 19, color: C.text, fontWeight: "700", marginBottom: 4 },
  sub:          { fontSize: 13, color: C.textMuted, fontWeight: "500", lineHeight: 19 },
  closeBtn:     { width: 34, height: 34, borderRadius: 10, backgroundColor: C.field, justifyContent: "center", alignItems: "center", marginTop: 2 },
  item:         { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  itemSelected: {},
  itemIcon:     { fontSize: 22, width: 32, textAlign: "center" },
  itemLabel:    { flex: 1, fontSize: 15, color: C.text, fontWeight: "600" },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  radioSelected:{ borderColor: C.g4 },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.g4 },
});

// ─── Receipt Modal — ✅ v2.8 ────────────────────────────────
type ReceiptData = {
  mode: "WALLET" | "CASH";
  sentAmount: number;
  sentCurrency: string;
  fees: number;
  total: number;
  receivedAmount: number;
  receivedCurrency: string;
  beneficiaryName: string;
  reference: string;
  code?: string;       // code de retrait (Cash Pickup ET Wallet non réclamé — ✅ v2.13)
  motif?: string | null;
  date: Date;
};

function buildReceiptText(r: ReceiptData, brandName: string): string {
  const lines = [
    `🧾 Reçu ${brandName}`,
    "",
    `Type : ${r.mode === "WALLET" ? "Transfert Wallet" : "Cash Pickup"}`,
    `Bénéficiaire : ${r.beneficiaryName}`,
    `Montant envoyé : ${fmt(r.sentAmount, r.sentCurrency)} ${r.sentCurrency}`,
  ];
  if (r.fees > 0) lines.push(`Frais : ${fmt(r.fees, r.sentCurrency)} ${r.sentCurrency}`);
  lines.push(`Total payé : ${fmt(r.total, r.sentCurrency)} ${r.sentCurrency}`);
  // ✅ v5.3 — plus d'arrondi à l'entier : le montant reçu suit les décimales de sa devise (fmtMoney)
  lines.push(`${r.beneficiaryName.split(" ")[0]} reçoit : ${fmt(r.receivedAmount, r.receivedCurrency)} ${r.receivedCurrency}`);
  if (r.code) lines.push("", `🔐 Code de retrait : ${r.code}`, "Ce code permet de retirer l'argent en agence.");
  if (r.motif) lines.push("", `Motif : ${r.motif}`);
  lines.push("", `Réf. : ${r.reference}`, `Date : ${r.date.toLocaleString("fr-FR")}`);
  return lines.join("\n");
}

function ReceiptModal({ visible, data, onClose }: {
  visible: boolean; data: ReceiptData | null; onClose: () => void;
}) {
  const { C, rcS, s } = useSendTheme();
  const { branding } = useTenant();
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const handleShare = async () => {
    try {
      await Share.share({ message: buildReceiptText(data, branding.name) });
    } catch {}
  };

  const handleCopyCode = async () => {
    if (!data.code) return;
    try {
      await Clipboard.setStringAsync(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rcS.overlay}>
        <View style={rcS.sheet}>
          <View style={rcS.handle} />

          <View style={rcS.successIconWrap}>
            <Ionicons name="checkmark-circle" size={52} color={C.g4} />
          </View>
          <Text style={[rcS.title, { fontFamily: F.display }]}>
            {data.mode === "WALLET" ? "Transfert effectué" : "Code généré"}
          </Text>
          <Text style={[rcS.subtitle, { fontFamily: F.body }]}>
            {data.mode === "WALLET"
              ? `Envoyé à ${data.beneficiaryName}`
              : "Le bénéficiaire peut retirer l'argent avec ce code"}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {data.code && (
              <View style={rcS.codeBox}>
                <Text style={[rcS.codeLabel, { fontFamily: F.body }]}>CODE DE RETRAIT</Text>
                <Text style={[rcS.codeValue, { fontFamily: F.display }]}>{data.code}</Text>
                <TouchableOpacity style={rcS.copyBtn} onPress={handleCopyCode} activeOpacity={0.8}>
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={C.g4} />
                  <Text style={[rcS.copyTxt, { fontFamily: F.body }]}>{copied ? "Copié !" : "Copier le code"}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={rcS.recapBox}>
              <SummaryRow label="Bénéficiaire" value={data.beneficiaryName} />
              <View style={s.summaryDivider} />
              <SummaryRow label="Montant envoyé" value={`${fmt(data.sentAmount, data.sentCurrency)} ${data.sentCurrency}`} />
              {data.fees > 0 && (
                <>
                  <View style={s.summaryDivider} />
                  <SummaryRow label="Frais" value={`${fmt(data.fees, data.sentCurrency)} ${data.sentCurrency}`} />
                </>
              )}
              <View style={s.summaryDivider} />
              <SummaryRow
                label={`${data.beneficiaryName.split(" ")[0]} reçoit`}
                value={`${fmt(data.receivedAmount, data.receivedCurrency)} ${data.receivedCurrency}`}
                valueColor={C.blue}
              />
              <View style={s.summaryDivider} />
              <SummaryRow label="Référence" value={data.reference} />
            </View>
          </ScrollView>

          <TouchableOpacity style={rcS.shareBtn} onPress={handleShare} activeOpacity={0.88}>
            <Ionicons name="share-social-outline" size={18} color={C.white} />
            <Text style={[rcS.shareTxt, { fontFamily: F.body }]}>PARTAGER LE REÇU</Text>
          </TouchableOpacity>

          <TouchableOpacity style={rcS.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={[rcS.doneTxt, { fontFamily: F.body }]}>Terminé</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === "ios" ? 24 : 12 }} />
        </View>
      </View>
    </Modal>
  );
}
const make_rcS = (C: Colors) => StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:            { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "88%" },
  handle:           { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 },
  successIconWrap:  { alignSelf: "center", marginBottom: 6 },
  title:            { fontSize: 20, color: C.text, textAlign: "center", marginBottom: 4 },
  subtitle:         { fontSize: 13, color: C.textMuted, textAlign: "center", fontWeight: "600", marginBottom: 14 },
  codeBox:          { backgroundColor: C.gSoft, borderRadius: 18, borderWidth: 1.5, borderColor: C.gBorder, padding: 16, alignItems: "center", marginBottom: 12 },
  codeLabel:        { fontSize: 10, fontWeight: "900", color: C.g4, letterSpacing: 1.2, marginBottom: 6 },
  codeValue:        { fontSize: 30, fontWeight: "700", color: C.text, letterSpacing: 4, marginBottom: 10 },
  copyBtn:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.white, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.gBorder },
  copyTxt:          { fontSize: 12, fontWeight: "700", color: C.g4 },
  recapBox:         { backgroundColor: C.bg, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14 },
  shareBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.g4, borderRadius: 16, paddingVertical: 15, marginBottom: 6 },
  shareTxt:         { fontSize: 14, fontWeight: "900", color: C.white, letterSpacing: 0.4 },
  doneBtn:          { alignItems: "center", paddingVertical: 12 },
  doneTxt:          { fontSize: 14, fontWeight: "700", color: C.textMuted },
});

// ─── Main ─────────────────────────────────────────────────
export default function SendMoneyScreen() {
  const { C, s } = useSendTheme();
  const { branding } = useTenant();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  // ✅ v3.0 — chargement non bloquant : l'écran est utilisable tout de suite
  const [loadState,  setLoadState]  = useState<"loading" | "ready" | "error">("loading");
  const [loadError,  setLoadError]  = useState<LoadError | null>(null);
  const [slowLoad,   setSlowLoad]   = useState(false);
  const [beneficiaries,    setBeneficiaries]    = useState<Beneficiary[]>([]);
  const [allRates,         setAllRates]         = useState<ExchangeRate[]>([]);
  const [sending,          setSending]          = useState(false);
  const [showBalance,      setShowBalance]      = useState(true);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showFallback,     setShowFallback]     = useState(false);
  const [walletBalance,    setWalletBalance]    = useState(0);
  const [loadingWallet,    setLoadingWallet]    = useState(true);

  const [motif,          setMotif]          = useState<string | null>(null);
  const [showMotifModal, setShowMotifModal] = useState(false);

  // ✅ v2.8 — Reçu transférable (Wallet & Cash Pickup)
  const [receiptData,  setReceiptData]  = useState<ReceiptData | null>(null);
  const [showReceipt,  setShowReceipt]  = useState(false);

  const userCurrency = (user as any)?.primaryCurrency || (user as any)?.currency || "XOF";

  const [mode,         setMode]        = useState<"WALLET" | "CASH">("WALLET");
  const [isModeLocked, setIsModeLocked]= useState(false);
  // ✅ v5.3 — `walletInput` ne contient QUE le numéro national (sans indicatif ni 0 de tête) : l'indicatif est
  //   dans le bouton pays. Un nom ou un e-mail collé reste tel quel.
  const [walletInput,         setWalletInput]        = useState("");
  const [detectedBeneficiary, setDetectedBeneficiary]= useState<Beneficiary | null>(null);
  const [pickedId,            setPickedId]           = useState<string | null>(null);
  const [lookingUp,           setLookingUp]          = useState(false);
  const [dialNonce,           setDialNonce]          = useState(0);
  const [selectedCashId,      setSelectedCashId]     = useState<string | null>(null);
  const [targetCurrency,    setTargetCurrency]   = useState("XOF");
  const [targetCountryData, setTargetCountryData]= useState<CountryData>(getCountryData("Sénégal"));
  const [rate,              setRate]             = useState<number>(1);
  const [rawAmount,         setRawAmount]        = useState("");
  // ✅ v2.15 — saisie bidirectionnelle du montant : `amountSource` retient le champ que l'utilisateur est en train de
  // saisir. ✅ v5.3 — le champ INACTIF n'est plus synchronisé par des effets : il est CALCULÉ à l'affichage
  // (sendText / receivedText), donc plus de boucle entre les deux champs, plus de curseur qui saute.
  const [rawReceivedAmount, setRawReceivedAmount] = useState("");
  const [amountSource,      setAmountSource]      = useState<"SEND" | "RECEIVED">("SEND");
  // ✅ v5.3 — flèche d'inversion : `swapped` place le champ « reçoit » en haut (c'est celui qu'on saisit).
  const [swapped,           setSwapped]           = useState(false);
  const [focusedField,      setFocusedField]      = useState<"SEND" | "RECEIVED" | null>(null);
  const sendRef = useRef<TextInput>(null);
  const recvRef = useRef<TextInput>(null);
  const [countrySearch,     setCountrySearch]    = useState("");

  const [cashFeeRate,  setCashFeeRate]  = useState(0.015);
  const [cashFeeLabel, setCashFeeLabel] = useState("1,5");

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.spring(cardAnim,   { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  }, []);

  const dS = decimalsFor(userCurrency);
  const dR = decimalsFor(targetCurrency);

  // ✅ v3.2 — FIX : impossible de choisir un autre bénéficiaire que celui reçu dans l'URL.
  //   CAUSE : cet effet dépendait de l'objet `params`, que expo-router renvoie sous une NOUVELLE
  //   référence à chaque rendu. Dès qu'on touchait Alghassimou ou Djamilatou, le rendu relançait
  //   l'effet, qui remettait aussitôt `beneficiaryId` (Omar) dans selectedCashId (idem pour le
  //   téléphone et le montant). CORRECTIF : on ne dépend plus que des VALEURS des paramètres
  //   (texte), donc les paramètres de route ne sont appliqués qu'une fois, ou quand ils changent
  //   vraiment (nouvelle navigation vers l'écran).
  const firstParam = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const pMode          = firstParam(params.mode);
  const pPhone         = firstParam(params.phone);
  const pBeneficiaryId = firstParam(params.beneficiaryId);
  const pAmount        = firstParam(params.amount);

  useEffect(() => {
    if (pMode) {
      const m = pMode as "WALLET" | "CASH";
      setMode(m); setIsModeLocked(true);
      if (m === "WALLET" && pPhone) {
        // ✅ v5.3 — le numéro reçu peut être international (« +221… ») : on garde le national et on règle le pays.
        const intl = parseInternational(pPhone.trim().startsWith("+") || pPhone.trim().startsWith("00") ? pPhone : `+${onlyDigits(pPhone)}`);
        if (intl) { setTargetCountryData(intl.country); setWalletInput(intl.national); }
        else setWalletInput(pPhone);
      }
      if (m === "CASH" && pBeneficiaryId) setSelectedCashId(pBeneficiaryId);
    }
    // ✅ v3.1 — montant pré-rempli depuis l'accueil « Corridor » (champ « Tu envoies »)
    if (pAmount) {
      const a = sanitizeAmountInput(String(pAmount), dS);
      if (parseAmount(a) > 0) { setRawAmount(a); setAmountSource("SEND"); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pMode, pPhone, pBeneficiaryId, pAmount]);

  useEffect(() => {
    (api.http as any).get("/commissions/fees")
      .then((res: any) => {
        const list: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const r = list.find((c: any) => c.payoutMethod === "CASH_PICKUP");
        if (r) {
          const raw = Number(r.feeRate ?? 1.5);
          setCashFeeRate(raw / 100);
          setCashFeeLabel(raw.toFixed(1).replace(".", ","));
        }
      })
      .catch(() => {});
  }, []);

  const fetchWalletBalance = useCallback(async () => {
    setLoadingWallet(true);
    const fromProfile = () => {
      const uw = ((user as any)?.wallets ?? []).find((w: any) => w.currency === userCurrency) ?? (user as any)?.wallets?.[0];
      setWalletBalance(uw ? toNum(uw.balance) - toNum(uw.reservedBalance ?? 0) : 0);
    };
    try {
      // ✅ v3.0 — borné : si le serveur ne répond pas, on retombe sur le
      // solde du profil au lieu d'attendre indéfiniment.
      const wallets = await withTimeout(api.getMyWallets(), defaultTimeoutMs());
      const w = wallets.find((w) => w.currency === userCurrency) ?? wallets.find((w) => (w as any).isDefault) ?? wallets[0];
      if (w) setWalletBalance(toNum(w.balance) - toNum((w as any).reservedBalance ?? 0));
      else fromProfile();
    } catch {
      fromProfile();
    } finally { setLoadingWallet(false); }
  }, [userCurrency, user]);

  // ✅ v3.0 — taux + contacts : en parallèle, chacun borné, sans jamais
  // masquer l'écran. Un échec partiel garde ce qui a répondu.
  const initSeq = useRef(0);
  const loadData = useCallback(async () => {
    const id = ++initSeq.current;
    setLoadState((prev) => (prev === "ready" ? prev : "loading"));
    const ms = defaultTimeoutMs();
    const [r, b] = await Promise.allSettled([
      withTimeout(api.getExchangeRates(), ms),
      withTimeout(api.getBeneficiaries(), ms),
    ]);
    if (id !== initSeq.current) return;
    if (r.status === "fulfilled") setAllRates(r.value);
    if (b.status === "fulfilled") setBeneficiaries(b.value);
    if (r.status === "rejected" || b.status === "rejected") {
      setLoadError(explainLoadError(b.status === "rejected" ? b.reason : (r as PromiseRejectedResult).reason));
      setLoadState("error");
    } else {
      setLoadError(null);
      setLoadState("ready");
    }
  }, []);

  // Message rassurant si le chargement dépasse 4 s
  useEffect(() => {
    if (loadState !== "loading") { setSlowLoad(false); return; }
    const timer = setTimeout(() => setSlowLoad(true), 4000);
    return () => clearTimeout(timer);
  }, [loadState]);

  useFocusEffect(useCallback(() => {
    void loadData();
    void fetchWalletBalance();
  }, [loadData, fetchWalletBalance]));

  // ✅ v2.14 — FIX 3 (voir changelog en tête de fichier) : getR()
  // vérifie maintenant le format underscore ET le format slash — voir
  // RatesService.getAll() (backend), qui renvoie explicitement ses
  // paires au format slash ("EUR/XOF"). Avant ce fix, la recherche par
  // égalité stricte sur le format underscore ne matchait JAMAIS une
  // paire réelle, et retombait systématiquement sur le fallback fb.
  // Fallback de toEurUser étendu à GNF (symétrique à toEurTarget,
  // qui gérait déjà ce cas) — un expéditeur en GNF tombait sur fb=1
  // (faux) au lieu de ≈8600.
  const updateCurrencyContext = useCallback((countryName: string) => {
    const cd = getCountryData(countryName);
    setTargetCountryData(cd);
    const tCurr = cd.currency || "XOF";
    setTargetCurrency(tCurr);
    const getR = (pair: string, fb: number) => {
      const [a, b] = pair.split("_");
      const slashPair = `${a}/${b}`;
      const found = allRates.find((r) => r.pair === pair || r.pair === slashPair);
      return found?.rate ?? fb;
    };
    const toEurUser   = userCurrency === "EUR" ? 1 : getR(`EUR_${userCurrency}`, userCurrency === "XOF" ? 655.95 : userCurrency === "GNF" ? 8600 : 1);
    const toEurTarget = tCurr === "EUR" ? 1 : getR(`EUR_${tCurr}`, tCurr === "XOF" ? 655.95 : tCurr === "GNF" ? 8600 : 1);
    setRate(toEurTarget / toEurUser);
  }, [allRates, userCurrency]);

  // ✅ v5.3 — le taux est calculé dès l'ouverture avec le pays par défaut (indicatif affiché). Avant, tant qu'aucun
  //   destinataire n'était choisi, le taux restait à 1 : le champ « reçoit » affichait le même nombre que
  //   « vous envoyez », avec la devise du pays (ex. 8 EUR → « 8 XOF »).
  useEffect(() => {
    if (detectedBeneficiary || selectedCashId) return;
    updateCurrencyContext(targetCountryData.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCurrencyContext]);

  // ✅ v5.3 — numéro national saisi (chiffres seuls, sans indicatif) ; vide pour un nom / un e-mail.
  const isTextQuery = walletInput.trim() !== "" && !isNumericLike(walletInput);
  const walletInputDigits = isTextQuery ? "" : nationalOf(walletInput, targetCountryData.dialCode);
  const dialRef = useRef(targetCountryData.dialCode);
  dialRef.current = targetCountryData.dialCode;

  // ✅ v2.10 — Détection bénéficiaire par téléphone/email/nom
  //   1) Recherche dans les bénéficiaires SAUVEGARDÉS (comparaison par SUFFIXE, robuste à l'indicatif).
  //   2) Si rien trouvé ET numéro complet → fallback debouncé (450ms) vers GET /users/by-phone pour détecter un
  //      utilisateur déjà inscrit mais non sauvegardé comme contact (badge différencié via isFavorite: false).
  // ✅ v5.3 — durcissements :
  //   • un contact n'est confirmé automatiquement que sur un numéro COMPLET (≥ 7 chiffres) ou un nom / e-mail EXACT :
  //     avant, taper les 3 derniers chiffres d'un contact (ou 3 lettres de son nom) le sélectionnait tout seul, avec
  //     le risque d'envoyer à la mauvaise personne. Les saisies partielles passent par la liste de suggestions ;
  //   • la recherche plateforme envoie le numéro COMPLET « +<indicatif><national> » (le serveur compare en E.164 exact),
  //     puis, à défaut, la variante historique à indicatif doublé ;
  //   • réponse tardive ignorée si la saisie a changé entre-temps.
  useEffect(() => {
    if (mode !== "WALLET" || walletInput.trim().length < 3) {
      setDetectedBeneficiary(null);
      setLookingUp(false);
      return;
    }

    const q = walletInput.toLowerCase().trim();

    // ── Étape 1 : Recherche dans les bénéficiaires sauvegardés ──
    const found = beneficiaries.find((b) => {
      if (isTextQuery) {
        return (b.email ? b.email.toLowerCase() === q : false) ||
               (b.fullName ? b.fullName.toLowerCase().trim() === q : false);
      }
      const storedDigits = onlyDigits(b.phone);
      if (!storedDigits || !walletInputDigits) return false;
      if (!storedDigits.endsWith(walletInputDigits)) return false;
      return walletInputDigits.length >= MIN_FULL_NUMBER || (pickedId !== null && String(b.id) === pickedId);
    });

    if (found) {
      setDetectedBeneficiary(found);
      setLookingUp(false);
      updateCurrencyContext(found.country);
      return;
    }

    // Aucun bénéficiaire sauvegardé trouvé → reset
    setDetectedBeneficiary(null);

    // ── Étape 2 : Fallback plateforme (debounce 450ms) ──────────
    if (isTextQuery || walletInputDigits.length < MIN_FULL_NUMBER) {
      setLookingUp(false);
      return;
    }

    let cancelled = false;
    setLookingUp(true);
    const timer = setTimeout(async () => {
      const dial = dialRef.current;
      const candidates = [toE164(dial, walletInputDigits), toLegacyDoubled(dial, walletInputDigits)];
      for (const candidate of candidates) {
        try {
          const res = await (api.http as any).get(`/users/by-phone?q=${encodeURIComponent(candidate)}`);
          if (cancelled) return;
          const platformUser = res.data;
          if (platformUser?.id) {
            // ── Pseudo-bénéficiaire pour réutiliser l'UI existante ──
            // isFavorite: false = signal "utilisateur plateforme non
            // sauvegardé" → testé dans le JSX pour le badge différencié.
            setDetectedBeneficiary({
              id:         platformUser.id,
              fullName:   [platformUser.firstName, platformUser.lastName]
                            .filter(Boolean).join(" ") || "Utilisateur",
              phone:      platformUser.phone ?? candidate,
              email:      undefined as any,
              country:    platformUser.country ?? "Sénégal",
              city:       undefined as any,
              isFavorite: false,
            } as any);

            if (platformUser.country) {
              updateCurrencyContext(platformUser.country);
            }
            setLookingUp(false);
            return;
          }
        } catch {
          // Endpoint non dispo ou erreur réseau → on tente la variante suivante, sinon silence
          // (l'UI retombe sur le message « Aucun membre trouvé »)
        }
      }
      if (!cancelled) setLookingUp(false);
    }, 450);

    return () => { cancelled = true; clearTimeout(timer); };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletInput, beneficiaries, mode, updateCurrencyContext, dialNonce, pickedId]);

  useEffect(() => {
    if (mode === "CASH" && selectedCashId) {
      const found = beneficiaries.find((b) => String(b.id) === selectedCashId);
      if (found) updateCurrencyContext(found.country);
    }
  }, [selectedCashId, mode, beneficiaries, updateCurrencyContext]);

  // ✅ v2.14 — autocomplétion. ✅ v5.3 : couvre aussi le nom / l'e-mail, et ne propose que si le contact n'est pas
  // déjà confirmé. Les numéros qui COMMENCENT par la saisie remontent en premier.
  const suggestions = useMemo(() => {
    if (mode !== "WALLET" || detectedBeneficiary) return [];
    const q = walletInput.toLowerCase().trim();
    if (isTextQuery) {
      if (q.length < 2) return [];
      return beneficiaries
        .filter((b) => (b.fullName ?? "").toLowerCase().includes(q) || (b.email ?? "").toLowerCase().includes(q))
        .slice(0, 5);
    }
    if (walletInputDigits.length < 2) return [];
    return beneficiaries
      .filter((b) => onlyDigits(b.phone).includes(walletInputDigits))
      .sort((a, b) => {
        const aStarts = onlyDigits(a.phone).startsWith(walletInputDigits) ? 0 : 1;
        const bStarts = onlyDigits(b.phone).startsWith(walletInputDigits) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 5);
  }, [beneficiaries, walletInput, walletInputDigits, isTextQuery, mode, detectedBeneficiary]);

  // Contacts proposés quand le champ est vide : un tap suffit pour choisir le destinataire.
  const quickContacts = useMemo(
    () => beneficiaries.filter((b) => !!onlyDigits(b.phone)).slice(0, 10),
    [beneficiaries],
  );

  // ✅ v2.14 — Sélection d'une suggestion : complète le numéro (national, sans indicatif), règle le pays et
  // confirme immédiatement le bénéficiaire, sans attendre le debounce.
  const handleSelectSuggestion = useCallback((b: Beneficiary) => {
    const digits = onlyDigits(b.phone);
    if (digits) {
      const intl = parseInternational(`+${digits}`);
      setWalletInput(intl ? intl.national : digits);
    } else {
      setWalletInput(b.fullName);
    }
    setPickedId(String(b.id));
    setDetectedBeneficiary(b);
    updateCurrencyContext(b.country);
  }, [updateCurrencyContext]);

  // ✅ v5.3 — saisie du champ destinataire : jamais d'indicatif dans le champ (déjà dans le bouton pays).
  const handlePhoneChange = (t: string) => {
    setPickedId(null);
    if (!isNumericLike(t)) { setWalletInput(t); return; }              // nom / e-mail
    const intl = parseInternational(t);
    if (intl) {                                                         // « +224 6… » ou « 00224… » collé / tapé
      if (intl.country.code !== targetCountryData.code) updateCurrencyContext(intl.country.name);
      setWalletInput(intl.national);
      return;
    }
    const trimmed = t.trim();
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) { setWalletInput(t); return; } // indicatif en cours de frappe
    setWalletInput(stripDial(onlyDigits(t), targetCountryData.dialCode));
  };

  // ✅ v5.3 — montants (voir utils/amount.ts) :
  //   SEND     → vous envoyez = ce qui est tapé ; reçu = envoi × taux, arrondi comme le serveur (XOF/GNF entiers, sinon 2 décimales) ;
  //   RECEIVED → reçu = ce qui est tapé ; envoi = reçu ÷ taux, arrondi au centime SUPÉRIEUR (le bénéficiaire reçoit au moins ce montant).
  //   `sendAmount` reste le SEUL point d'entrée vers le reste de l'écran (frais, total, solde, création de transaction).
  const parsedSendRaw     = parseAmount(rawAmount);
  const parsedReceivedRaw = parseAmount(rawReceivedAmount);

  const sendAmount = amountSource === "RECEIVED"
    ? (rate > 0 ? ceilTo(parsedReceivedRaw / rate, dS) : 0)
    : roundTo(parsedSendRaw, dS);
  const receivedAmt = roundTo(sendAmount * rate, dR);

  const sendText     = amountSource === "SEND"     ? rawAmount         : toInputText(sendAmount, dS);
  const receivedText = amountSource === "RECEIVED" ? rawReceivedAmount : toInputText(receivedAmt, dR);

  const onSendChange = (t: string) => { setAmountSource("SEND");     setRawAmount(sanitizeAmountInput(t, dS)); };
  const onRecvChange = (t: string) => { setAmountSource("RECEIVED"); setRawReceivedAmount(sanitizeAmountInput(t, dR)); };

  // ✅ v5.3 — flèche d'inversion (auparavant décorative) : le champ « reçoit » passe en haut et devient celui qu'on
  // saisit (clavier ouvert dessus) ; un second appui revient à « vous envoyez ». Les valeurs déjà saisies sont conservées.
  const handleSwap = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !swapped;
    setSwapped(next);
    if (next) {
      setRawReceivedAmount(receivedText);
      setAmountSource("RECEIVED");
    } else {
      setRawAmount(sendText);
      setAmountSource("SEND");
    }
    setTimeout(() => (next ? recvRef : sendRef).current?.focus(), 60);
  };

  const beneficiaryLabel = useMemo(() => {
    if (mode === "WALLET") {
      return detectedBeneficiary?.fullName?.split(" ")[0] ?? "Le bénéficiaire";
    }
    const sel = beneficiaries.find(b => String(b.id) === selectedCashId);
    return sel?.fullName?.split(" ")[0] ?? "Le bénéficiaire";
  }, [mode, detectedBeneficiary, beneficiaries, selectedCashId]);

  const feesRate    = mode === "WALLET" ? 0 : cashFeeRate;
  const feesAmt     = roundTo(sendAmount * feesRate, dS);
  const totalAmt    = roundTo(sendAmount + feesAmt, dS);
  const insufficient   = totalAmt > roundTo(walletBalance, dS) && sendAmount > 0;
  const missingAmount  = Math.max(0, roundTo(totalAmt - walletBalance, dS));
  // ✅ v2.14 — FIX 1 : même condition EXACTE que le contrôle équivalent dans handleAction, pour que le bouton ne
  // soit jamais actif sur une saisie que handleAction rejetterait ensuite.
  const recipientReady = mode === "WALLET" ? (!!detectedBeneficiary || walletInputDigits.length >= MIN_FULL_NUMBER) : !!selectedCashId;
  const canSend = sendAmount > 0 && !insufficient && recipientReady;
  const missingHint = !recipientReady
    ? (mode === "WALLET" ? "Saisissez le numéro du destinataire" : "Choisissez un bénéficiaire")
    : sendAmount <= 0 ? "Saisissez un montant" : null;

  const handleAction = async () => {
    if (insufficient) { setShowFallback(true); return; }
    if (sendAmount <= 0) return Alert.alert("Montant invalide", "Saisissez un montant valide.");
    setSending(true);
    try {
      if (mode === "WALLET") {
        // ✅ v2.14 — FIX 1/2 : chiffres uniquement, même condition que canSend ci-dessus.
        if (!detectedBeneficiary && walletInputDigits.length < MIN_FULL_NUMBER) {
          setSending(false);
          return Alert.alert("Erreur", "Numéro trop court ou contact introuvable.");
        }
        const walletPayload = {
          amount:          sendAmount,
          currency:        userCurrency,
          beneficiaryId:   detectedBeneficiary ? String(detectedBeneficiary.id) : undefined,
          payoutMethod:    "MOBILE_MONEY" as const,
          note:            motif ?? undefined,
        };
        const tx: any = await runOnce(JSON.stringify(walletPayload), (idempotencyKey) =>
          api.createTransaction({ ...walletPayload, idempotencyKey }));
        // ✅ "id" confirmé comme champ de référence (utilisé par cancelTransaction/getTransaction dans api.ts)
        const reference = tx?.reference ?? tx?.id ?? `TX-${Date.now()}`;
        // ✅ v2.13 — FIX : si le backend n'a pas pu créditer immédiatement un wallet (aucun recipientId résolu —
        // numéro non reconnu par la plateforme), la transaction reste « en attente » avec un code de retrait
        // généré côté backend (même mécanisme que Cash Pickup) : on l'extrait pour l'afficher sur le reçu.
        const walletClaimed = !!tx?.recipientId;
        let walletCode: string | undefined;
        if (!walletClaimed) {
          walletCode = String(tx?.providerRef ?? tx?.reference ?? "—");
          if (walletCode.includes("|")) walletCode = walletCode.split("|")[0];
        }
        setReceiptData({
          mode: "WALLET",
          sentAmount: sendAmount,
          sentCurrency: userCurrency,
          fees: 0,
          total: totalAmt,
          receivedAmount: receivedAmt,
          receivedCurrency: targetCurrency,
          beneficiaryName: detectedBeneficiary?.fullName ?? `${formatPhone(toE164(targetCountryData.dialCode, walletInputDigits))}`,
          reference: String(reference),
          code: walletCode, // ✅ v2.13 — undefined si déjà crédité (comportement inchangé)
          motif,
          date: new Date(),
        });
      } else {
        if (!selectedCashId) {
          setSending(false);
          return Alert.alert("Erreur", "Sélectionnez un bénéficiaire.");
        }
        const cashPayload = {
          amount:        sendAmount,
          currency:      userCurrency,
          beneficiaryId: selectedCashId,
          payoutMethod:  "CASH_PICKUP" as const,
          note:          motif ?? undefined,
        };
        const tx: any = await runOnce(JSON.stringify(cashPayload), (idempotencyKey) =>
          api.createTransaction({ ...cashPayload, idempotencyKey }));
        const reference = tx?.reference ?? tx?.id ?? `TX-${Date.now()}`;
        // ✅ Confirmé via transactions.service.ts : storedRef (providerRef)
        // == transactionRef (reference) tant que senderFirstName n'est pas
        // envoyé (jamais le cas ici) → providerRef contient le même code
        // 9 chiffres que reference. Découpe "code|prénom" conservée par
        // robustesse si ce comportement évolue côté backend.
        let code = String(tx?.providerRef ?? tx?.reference ?? tx?.code ?? "—");
        if (code.includes("|")) code = code.split("|")[0];
        const sel = beneficiaries.find((b) => String(b.id) === selectedCashId);
        setReceiptData({
          mode: "CASH",
          sentAmount: sendAmount,
          sentCurrency: userCurrency,
          fees: feesAmt,
          total: totalAmt,
          receivedAmount: receivedAmt,
          receivedCurrency: targetCurrency,
          beneficiaryName: sel?.fullName ?? "Bénéficiaire",
          reference: String(reference),
          code,
          motif,
          date: new Date(),
        });
      }
      void fetchWalletBalance();
      setShowReceipt(true);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Une erreur est survenue.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setSending(false); }
  };

  const filteredCountries = countriesList.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.dialCode.includes(countrySearch.replace("+", "").trim())
  );

  const selectedMotif = MOTIFS.find((m) => m.label === motif);
  // ✅ v2.10 — true si le bénéficiaire détecté est un utilisateur
  // plateforme (non sauvegardé), false/undefined sinon
  const isPlatformOnly = (detectedBeneficiary as any)?.isFavorite === false;
  const detectedCountry = detectedBeneficiary ? (countryOfPhone(detectedBeneficiary.phone) ?? getCountryData(detectedBeneficiary.country)) : null;

  const ctaFg = insufficient ? C.white : (!canSend ? C.textMuted : C.accentInk);
  const ctaLabel = insufficient
    ? "Autre moyen de paiement"
    : mode === "WALLET" ? "Confirmer le transfert" : "Générer le code de retrait";

  const rateVisible = rate !== 1 && targetCurrency !== userCurrency;

  // ── Une ligne de montant (envoi / réception) ──
  const renderAmountRow = (kind: "SEND" | "RECEIVED") => {
    const isSend  = kind === "SEND";
    const text    = isSend ? sendText : receivedText;
    const cur     = isSend ? userCurrency : targetCurrency;
    const dec     = isSend ? dS : dR;
    const derived = amountSource !== kind;
    return (
      <View key={kind} style={[s.amtRow, focusedField === kind && s.amtRowFocus]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.amtLabel, { fontFamily: F.body }]}>
            {isSend ? "Vous envoyez" : `${beneficiaryLabel} reçoit`}
          </Text>
          <TextInput
            ref={isSend ? sendRef : recvRef}
            style={[s.amtInput, { fontFamily: F.display, fontSize: amountFontSize(text, 26) }, derived && s.amtInputDerived]}
            value={text}
            onChangeText={isSend ? onSendChange : onRecvChange}
            onFocus={() => setFocusedField(kind)}
            onBlur={() => setFocusedField((f) => (f === kind ? null : f))}
            keyboardType={dec > 0 ? "decimal-pad" : "number-pad"}
            placeholder={dec > 0 ? "0,00" : "0"}
            placeholderTextColor={C.textFaint}
            selectTextOnFocus
            accessibilityLabel={isSend ? "Montant à envoyer" : "Montant à recevoir"}
          />
        </View>
        <View style={[s.currChip, { backgroundColor: isSend ? C.gSoft : C.blueSoft }]}>
          <Text style={[s.currTxt, { color: isSend ? C.g4 : C.blue, fontFamily: F.body }]}>{cur}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ══ HEADER — v5.3 : compact (retour, titre, œil) + solde sur une ligne ══ */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-12,0] }) }],
      }}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <TouchableOpacity style={s.roundBtn} onPress={() => router.back()} accessibilityLabel="Retour">
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { fontFamily: SERIF }]}>
              {mode === "WALLET" ? "Transfert" : "Envoi d'argent"}
            </Text>
            <TouchableOpacity style={s.roundBtn} onPress={() => setShowBalance(!showBalance)} accessibilityLabel={showBalance ? "Masquer le solde" : "Afficher le solde"}>
              <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={18} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={s.balancePill}>
            <Ionicons name="wallet-outline" size={16} color={C.g4} />
            <Text style={[s.balanceLbl, { fontFamily: F.body }]}>Solde disponible</Text>
            {loadingWallet
              ? <ActivityIndicator color={C.heroMuted} size="small" />
              : <Text style={[s.balanceVal, { fontFamily: F.display }, insufficient && { color: C.amber }]}>
                  {showBalance ? `${fmt(walletBalance, userCurrency)} ${userCurrency}` : "• • • • •"}
                </Text>
            }
          </View>
        </View>
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0,1], outputRange: [16,0] }) }],
          }}>

            {/* ── Onglets mode ── */}
            {!isModeLocked && (
              <View style={s.tabsWrap}>
                <ModeTab label="Wallet"      icon="phone-portrait-outline" active={mode === "WALLET"} onPress={() => setMode("WALLET")} />
                <ModeTab label="Cash Pickup" icon="cash-outline"           active={mode === "CASH"}   onPress={() => setMode("CASH")}   />
              </View>
            )}

            {/* ✅ v3.0 — état du chargement en arrière-plan (jamais bloquant) */}
            {loadState === "loading" && (
              <View style={s.loadNote}>
                <ActivityIndicator size="small" color={C.g4} />
                <Text style={[s.loadNoteTxt, { fontFamily: F.body }]}>
                  {slowLoad
                    ? "Le serveur se réveille, quelques secondes de plus…"
                    : "Chargement de vos contacts et des taux…"}
                </Text>
              </View>
            )}
            {loadState === "error" && loadError && (
              <View style={s.loadErr}>
                <Ionicons name="cloud-offline-outline" size={20} color={C.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.loadErrTitle, { fontFamily: F.body }]}>{loadError.title}</Text>
                  <Text style={[s.loadErrMsg, { fontFamily: F.body }]}>{loadError.message}</Text>
                </View>
                <TouchableOpacity style={s.loadErrBtn} onPress={() => void loadData()} activeOpacity={0.85}>
                  <Text style={[s.loadErrBtnTxt, { fontFamily: F.body }]}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Destinataire ── */}
            <View style={s.block}>
              <Text style={[s.blockTitle, { fontFamily: F.body }]}>DESTINATAIRE</Text>

              {mode === "WALLET" ? (
                <>
                  <View style={s.phoneWrap}>
                    <TouchableOpacity style={s.dialBtn} onPress={() => setShowCountryModal(true)} accessibilityLabel={`Indicatif +${targetCountryData.dialCode}, changer de pays`}>
                      <Text style={s.dialFlag}>{targetCountryData.flag}</Text>
                      <Text style={[s.dialCode, { fontFamily: F.body }]}>+{targetCountryData.dialCode}</Text>
                      <Ionicons name="chevron-down" size={12} color={C.textMuted} />
                    </TouchableOpacity>
                    <TextInput
                      style={[s.phoneInput, { fontFamily: F.body }]}
                      value={walletInput}
                      onChangeText={handlePhoneChange}
                      placeholder="Numéro de téléphone"
                      placeholderTextColor={C.textFaint}
                      keyboardType={walletInput.trim() === "" || isNumericLike(walletInput) ? "phone-pad" : "default"}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="Numéro du destinataire, sans l'indicatif"
                    />
                    {lookingUp ? (
                      <ActivityIndicator size="small" color={C.g4} style={{ marginRight: 12 }} />
                    ) : walletInput.length > 0 ? (
                      <TouchableOpacity style={s.clearInputBtn} onPress={() => { setWalletInput(""); setPickedId(null); }} accessibilityLabel="Effacer">
                        <Ionicons name="close-circle" size={18} color={C.textFaint} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {detectedBeneficiary ? (
                    <>
                      <View style={[s.detectedCard, isPlatformOnly && s.detectedCardPlatform]}>
                        <View style={[s.detectedAvatar, isPlatformOnly && s.detectedAvatarPlatform]}>
                          <Text style={[
                            s.detectedAvatarTxt, { fontFamily: F.display },
                            isPlatformOnly && { color: C.blue },
                          ]}>
                            {initialOf(detectedBeneficiary.fullName)}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[
                            s.detectedLabel, { fontFamily: F.body },
                            isPlatformOnly && { color: C.blue },
                          ]}>
                            {isPlatformOnly ? `MEMBRE ${branding.name.toUpperCase()}` : "CONTACT ENREGISTRÉ"}
                          </Text>
                          <Text style={[s.detectedName,  { fontFamily: F.body }]}>{detectedBeneficiary.fullName}</Text>
                          {!!detectedBeneficiary.phone && (
                            <Text style={[s.detectedPhone, { fontFamily: F.body }]}>{formatPhone(detectedBeneficiary.phone)}</Text>
                          )}
                        </View>
                        {detectedCountry && <Text style={s.detectedFlag}>{detectedCountry.flag}</Text>}
                        <View style={[s.detectedCheck, isPlatformOnly && s.detectedCheckPlatform]}>
                          <Ionicons
                            name={isPlatformOnly ? "person-outline" : "checkmark"}
                            size={14} color={C.white}
                          />
                        </View>
                      </View>

                      {/* ✅ v2.10 — Utilisateur plateforme détecté, pas encore sauvegardé */}
                      {isPlatformOnly && (
                        <TouchableOpacity
                          style={s.platformAddRow}
                          onPress={() => router.push({
                            pathname: "/(tabs)/beneficiaries/create",
                            params: {
                              phone: detectedBeneficiary.phone ?? toE164(targetCountryData.dialCode, walletInputDigits),
                              name:  detectedBeneficiary.fullName,
                            },
                          } as any)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="person-add-outline" size={14} color={C.blue} />
                          <Text style={[s.platformAddTxt, { fontFamily: F.body }]}>
                            Enregistrer comme contact
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Contacts : un tap suffit tant que le champ est vide */}
                      {walletInput.trim() === "" && quickContacts.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                          style={{ marginTop: 10 }}
                          contentContainerStyle={{ paddingBottom: 2 }}
                        >
                          {quickContacts.map((b) => (
                            <BeneficiaryCard key={String(b.id)} item={b} selected={false} onPress={() => handleSelectSuggestion(b)} />
                          ))}
                          <AddBeneficiaryCard onPress={() => router.push("/(tabs)/beneficiaries")} />
                        </ScrollView>
                      )}

                      {/* ✅ v2.14 — suggestions d'autocomplétion, tant qu'aucun bénéficiaire n'est confirmé */}
                      {suggestions.length > 0 && (
                        <PhoneSuggestionsList
                          suggestions={suggestions}
                          onSelect={handleSelectSuggestion}
                        />
                      )}
                      {suggestions.length === 0 && !lookingUp && (isTextQuery ? walletInput.trim().length >= 3 : walletInputDigits.length >= MIN_FULL_NUMBER) && (
                        <View style={s.addHint}>
                          <View style={s.addHintIcon}>
                            <Ionicons name="person-add-outline" size={16} color={C.g4} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.addHintTxt, { fontFamily: F.body }]}>
                              Aucun membre trouvé pour {isTextQuery ? `« ${walletInput.trim()} »` : formatPhone(toE164(targetCountryData.dialCode, walletInputDigits))}
                            </Text>
                            <Text
                              style={[s.addHintLink, { fontFamily: F.body }]}
                              onPress={() => router.push("/(tabs)/beneficiaries")}
                            >
                              + Ajouter comme bénéficiaire
                            </Text>
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* ✅ v2.6 — Liste horizontale + bouton "+" à la fin */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 2 }}
                  >
                    {beneficiaries.map((item) => (
                      <BeneficiaryCard
                        key={String(item.id)}
                        item={item}
                        selected={selectedCashId === String(item.id)}
                        onPress={() => setSelectedCashId(String(item.id))}
                      />
                    ))}
                    <AddBeneficiaryCard
                      onPress={() => router.push("/(tabs)/beneficiaries")}
                    />
                  </ScrollView>

                  {(() => {
                    const sel = beneficiaries.find((b) => String(b.id) === selectedCashId);
                    const cd  = sel ? getCountryData(sel.country) : null;
                    return sel ? (
                      <View style={s.detectedCard}>
                        <View style={s.detectedAvatar}>
                          <Text style={[s.detectedAvatarTxt, { fontFamily: F.display }]}>{initialOf(sel.fullName)}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.detectedLabel, { fontFamily: F.body }]}>SÉLECTIONNÉ</Text>
                          <Text style={[s.detectedName,  { fontFamily: F.body }]}>{sel.fullName}</Text>
                          {!!sel.phone && <Text style={[s.detectedPhone, { fontFamily: F.body }]}>{formatPhone(sel.phone)}</Text>}
                        </View>
                        {cd && <Text style={s.detectedFlag}>{cd.flag}</Text>}
                      </View>
                    ) : null;
                  })()}
                </>
              )}
            </View>

            {/* ── Montant ── */}
            <View style={s.block}>
              <Text style={[s.blockTitle, { fontFamily: F.body }]}>MONTANT</Text>
              <View style={s.amtBox}>
                {renderAmountRow(swapped ? "RECEIVED" : "SEND")}
                <View style={s.amtDivider} />
                {renderAmountRow(swapped ? "SEND" : "RECEIVED")}
                <Pressable
                  style={({ pressed }) => [s.swapBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleSwap}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={swapped ? "Revenir à la saisie du montant à envoyer" : "Saisir le montant à la réception"}
                >
                  <Ionicons name="swap-vertical" size={18} color={C.g4} />
                </Pressable>
              </View>
              <View style={s.amtFoot}>
                {rateVisible ? (
                  <View style={s.footLeft}>
                    <Ionicons name="trending-up-outline" size={13} color={C.textMuted} />
                    <Text style={[s.footTxt, { fontFamily: F.body }]}>
                      1 {userCurrency} = {fmtRate(rate)} {targetCurrency}
                    </Text>
                  </View>
                ) : <View style={{ flex: 1 }} />}
                {feesRate > 0 ? (
                  <Text style={[s.footTxt, { fontFamily: F.body, color: C.amber, fontWeight: "800" }]}>Frais {cashFeeLabel} %</Text>
                ) : (
                  <Text style={[s.footTxt, { fontFamily: F.body, color: C.g4, fontWeight: "800" }]}>Sans frais ✓</Text>
                )}
              </View>
            </View>

            {/* ── Motif du transfert ── */}
            <TouchableOpacity
              style={s.motifRow}
              onPress={() => setShowMotifModal(true)}
              activeOpacity={0.85}
            >
              <View style={s.motifLeft}>
                {selectedMotif ? (
                  <Text style={s.motifEmoji}>{selectedMotif.icon}</Text>
                ) : (
                  <View style={s.motifIconBox}>
                    <Ionicons name="document-text-outline" size={17} color={C.textMuted} />
                  </View>
                )}
                <Text style={[
                  s.motifTxt, { fontFamily: F.body },
                  motif ? { color: C.text, fontWeight: "700" } : { color: C.textMuted },
                ]}>
                  {motif ?? "Motif du transfert (facultatif)"}
                </Text>
                {motif && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); setMotif(null); }}
                    hitSlop={8}
                    style={s.motifClear}
                    accessibilityLabel="Retirer le motif"
                  >
                    <Ionicons name="close-circle" size={16} color={C.textFaint} />
                  </TouchableOpacity>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>

            {/* ── Récapitulatif ── */}
            {sendAmount > 0 && (
              <View style={s.block}>
                <Text style={[s.blockTitle, { fontFamily: F.body }]}>RÉCAPITULATIF</Text>
                <SummaryRow label="Montant envoyé" value={`${fmt(sendAmount, userCurrency)} ${userCurrency}`} />
                <View style={s.summaryDivider} />
                <SummaryRow
                  label="Frais de transfert"
                  value={feesAmt === 0 ? "Offerts ✓" : `${fmt(feesAmt, userCurrency)} ${userCurrency}`}
                  valueColor={feesAmt === 0 ? C.g4 : undefined}
                />
                <View style={s.summaryDivider} />
                <SummaryRow
                  label={`${beneficiaryLabel} reçoit`}
                  value={`${fmt(receivedAmt, targetCurrency)} ${targetCurrency}`}
                  valueColor={C.blue}
                />
                {motif && (
                  <>
                    <View style={s.summaryDivider} />
                    <SummaryRow label="Motif" value={`${selectedMotif?.icon ?? ""} ${motif}`} />
                  </>
                )}
                <View style={[s.summaryDivider, { backgroundColor: C.gBorder, height: 1.5, marginVertical: 4 }]} />
                <SummaryRow
                  label="TOTAL À PAYER"
                  value={`${fmt(totalAmt, userCurrency)} ${userCurrency}`}
                  valueColor={insufficient ? C.danger : C.g4}
                  large
                />
                {insufficient && (
                  <View style={s.insufficientBar}>
                    <Ionicons name="wallet-outline" size={16} color={C.amber} />
                    <Text style={[s.insufficientBarTxt, { fontFamily: F.body }]}>
                      Il vous manque <Text style={{ fontWeight: "800" }}>{fmt(missingAmount, userCurrency)} {userCurrency}</Text>
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.secNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.g5} />
              <Text style={[s.secTxt, { fontFamily: F.body }]}>Transfert sécurisé · Crypté de bout en bout</Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* ── CTA — fixé en bas : toujours visible, même clavier ouvert ── */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {!!missingHint && !insufficient && (
            <Text style={[s.hintTxt, { fontFamily: F.body }]}>{missingHint}</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              s.cta,
              insufficient && s.ctaAlt,
              !canSend && !insufficient && s.ctaDisabled,
              pressed && { opacity: 0.92 },
            ]}
            onPress={handleAction}
            disabled={sending || (!canSend && !insufficient)}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            {sending ? (
              <ActivityIndicator color={ctaFg} />
            ) : (
              <>
                <View style={s.ctaIcon}>
                  <Ionicons
                    name={insufficient ? "options-outline" : mode === "WALLET" ? "phone-portrait-outline" : "cash-outline"}
                    size={19} color={ctaFg}
                  />
                </View>
                <Text style={[s.ctaTxt, { fontFamily: F.body, color: ctaFg }]}>{ctaLabel}</Text>
                {sendAmount > 0 && !insufficient ? (
                  <View style={s.ctaAmount}>
                    <Text style={[s.ctaAmountTxt, { fontFamily: F.body, color: ctaFg }]}>{fmt(totalAmt, userCurrency)} {userCurrency}</Text>
                  </View>
                ) : (
                  <Ionicons name="arrow-forward" size={18} color={ctaFg} style={{ opacity: 0.7 }} />
                )}
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Motif Modal ── */}
      <MotifModal
        visible={showMotifModal}
        selected={motif}
        onSelect={setMotif}
        onClose={() => setShowMotifModal(false)}
      />

      {/* ── Country Picker ── */}
      <Modal visible={showCountryModal} animationType="slide" transparent onRequestClose={() => { setShowCountryModal(false); setCountrySearch(""); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { fontFamily: F.display }]}>Indicatif pays</Text>
              <TouchableOpacity style={s.modalClose} onPress={() => { setShowCountryModal(false); setCountrySearch(""); }} accessibilityLabel="Fermer">
                <Ionicons name="close" size={18} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={s.modalSearch}>
              <Ionicons name="search-outline" size={15} color={C.textFaint} />
              <TextInput
                style={[s.modalSearchInput, { fontFamily: F.body }]}
                value={countrySearch} onChangeText={setCountrySearch}
                placeholder="Rechercher un pays ou un indicatif" placeholderTextColor={C.textFaint}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries} keyExtractor={(item) => item.code}
              style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setTargetCountryData(item);
                    updateCurrencyContext(item.name);
                    setDialNonce((n) => n + 1);   // relance la recherche du destinataire avec le nouvel indicatif
                    setPickedId(null);
                    setShowCountryModal(false);
                    setCountrySearch("");
                  }}
                >
                  <Text style={s.modalItemFlag}>{item.flag}</Text>
                  <Text style={[s.modalItemName, { fontFamily: F.body }]}>{item.name}</Text>
                  <Text style={[s.modalItemCode, { fontFamily: F.body }]}>+{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <FallbackModal
        visible={showFallback} missing={missingAmount} currency={userCurrency}
        onClose={() => setShowFallback(false)}
        onOrangeMoney={() => { setShowFallback(false); router.push("/topup?method=orange" as any); }}
        onCard={() => { setShowFallback(false); router.push("/topup?method=card" as any); }}
      />

      {/* ✅ v2.8 — Reçu transférable */}
      <ReceiptModal
        visible={showReceipt}
        data={receiptData}
        onClose={() => {
          setShowReceipt(false);
          router.push("/(tabs)/transactions");
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const make_s = (C: Colors) => StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  // ✅ v3.0 — bandeaux de chargement / d'erreur non bloquants
  loadNote:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.gSoft, borderWidth: 1, borderColor: C.gBorder, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10 },
  loadNoteTxt: { flex: 1, fontSize: 12.5, color: C.textSub, fontWeight: "600" },
  loadErr:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amberLine, borderRadius: 14, padding: 10, marginBottom: 10 },
  loadErrTitle: { fontSize: 13, color: C.text, fontWeight: "800" },
  loadErrMsg:   { fontSize: 12, color: C.textSub, marginTop: 2, lineHeight: 16 },
  loadErrBtn:   { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14 },
  loadErrBtnTxt:{ color: "#fff", fontSize: 12.5, fontWeight: "800" },

  // ── Header v5.3 (compact) ──
  header:      { paddingTop: Platform.OS === "android" ? 30 : 4, paddingBottom: 6, paddingHorizontal: 16 },
  headerRow:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  roundBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 25, fontWeight: "700", color: C.g4, letterSpacing: -0.4 },
  balancePill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 9 },
  balanceLbl:  { flex: 1, color: C.textMuted, fontSize: 13, fontWeight: "600" },
  balanceVal:  { color: C.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },

  // scroll compact : plus d'espace perdu sous l'en-tête
  scroll:   { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  tabsWrap: { flexDirection: "row", backgroundColor: C.field, borderRadius: 14, padding: 3, marginBottom: 10 },

  block: {
    backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, marginBottom: 10,
  },
  blockTitle:  { fontSize: 11, fontWeight: "800", color: C.textMuted, letterSpacing: 0.9, marginBottom: 8 },

  phoneWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: C.field, borderRadius: 14, overflow: "hidden" },
  dialBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: C.border, height: 50 },
  dialFlag:      { fontSize: 18 },
  dialCode:      { fontSize: 14, fontWeight: "800", color: C.text },
  phoneInput:    { flex: 1, minWidth: 0, paddingHorizontal: 12, height: 50, fontSize: 16, fontWeight: "600", color: C.text, paddingVertical: 0 },
  clearInputBtn: { paddingHorizontal: 12, height: 50, justifyContent: "center" },

  detectedCard:      { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, backgroundColor: C.gSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: C.gBorder },
  // ✅ v2.10 — variante "utilisateur plateforme détecté, non sauvegardé"
  detectedCardPlatform:   { backgroundColor: C.blueSoft, borderColor: C.blueLine },
  detectedAvatar:    { width: 38, height: 38, borderRadius: 12, backgroundColor: `${C.g4}20`, justifyContent: "center", alignItems: "center" },
  detectedAvatarPlatform: { backgroundColor: `${C.blue}20` },
  detectedAvatarTxt: { fontSize: 17, fontWeight: "900", color: C.g4 },
  detectedLabel:     { fontSize: 10, fontWeight: "900", color: C.g4, letterSpacing: 0.7, marginBottom: 1 },
  detectedName:      { fontSize: 14.5, fontWeight: "800", color: C.text },
  detectedPhone:     { fontSize: 12.5, color: C.textMuted, fontWeight: "600", marginTop: 1 },
  detectedCheck:     { width: 26, height: 26, borderRadius: 99, backgroundColor: C.g4, justifyContent: "center", alignItems: "center" },
  detectedCheckPlatform:  { backgroundColor: C.blue },
  detectedFlag:      { fontSize: 22 },
  // ✅ v2.10 — lien "Enregistrer comme contact" sous la carte plateforme
  platformAddRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 2, alignSelf: "flex-start" },
  platformAddTxt:    { fontSize: 13, color: C.blue, fontWeight: "800" },
  addHint:     { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 10, backgroundColor: C.gSoft, borderRadius: 14, borderWidth: 1, borderColor: C.gBorder, borderStyle: "dashed" },
  addHintIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${C.g4}20`, justifyContent: "center", alignItems: "center" },
  addHintTxt:  { fontSize: 12.5, color: C.textMuted, fontWeight: "600" },
  addHintLink: { fontSize: 13, color: C.g4, fontWeight: "800", marginTop: 1 },

  // ✅ v5.3 — carte de saisie COMPACTE : deux lignes (≈ 60 px chacune) séparées d'un filet, flèche d'inversion
  //    posée sur le filet. Chaque ligne : libellé + montant à gauche, pastille de devise à droite (jamais repoussée).
  amtBox:      { backgroundColor: C.field, borderRadius: 16, borderWidth: 1.5, borderColor: "transparent", overflow: "visible" },
  amtRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, borderWidth: 1.5, borderColor: "transparent" },
  amtRowFocus: { borderColor: C.g4, backgroundColor: C.surface },
  amtLabel:    { fontSize: 11.5, fontWeight: "700", color: C.textMuted },
  amtInput:    { minWidth: 0, fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.6, padding: 0, height: 36 },
  amtInputDerived: { color: C.textSub },
  amtDivider:  { height: 1, marginHorizontal: 14, backgroundColor: C.border },
  swapBtn:     { position: "absolute", right: 22, top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  currChip:    { flexShrink: 0, minWidth: 56, alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  currTxt:     { fontSize: 13, fontWeight: "900", letterSpacing: 0.4 },
  amtFoot:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, paddingHorizontal: 2 },
  footLeft:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  footTxt:     { fontSize: 12.5, color: C.textMuted, fontWeight: "600", flexShrink: 1 },

  motifRow:    {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
  },
  motifLeft:   { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  motifEmoji:  { fontSize: 20, width: 28, textAlign: "center" },
  motifIconBox:{ width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  motifTxt:    { fontSize: 14, flex: 1 },
  motifClear:  { padding: 2 },

  summaryDivider:     { height: 1, backgroundColor: C.borderLight, marginVertical: 1 },
  insufficientBar:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amberSoft, borderRadius: 10, padding: 10, marginTop: 8 },
  insufficientBarTxt: { fontSize: 13, color: C.amber, fontWeight: "600", flex: 1 },

  // ✅ v5.3 — pied d'écran fixe : le bouton ne se cache plus derrière le clavier, le total est écrit dessus
  footer:  { paddingHorizontal: 16, paddingTop: 8, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  hintTxt: { fontSize: 12.5, color: C.textMuted, fontWeight: "600", textAlign: "center", marginBottom: 6 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.accent, borderRadius: 18, minHeight: 54, paddingHorizontal: 14,
  },
  ctaAlt:      { backgroundColor: C.ink },
  ctaDisabled: { backgroundColor: C.beige },
  ctaIcon:     { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.08)", justifyContent: "center", alignItems: "center" },
  ctaTxt:      { flex: 1, fontSize: 16, fontWeight: "800", color: C.accentInk, letterSpacing: -0.1 },
  ctaAmount:   { backgroundColor: "rgba(0,0,0,0.09)", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  ctaAmountTxt:{ fontSize: 14, fontWeight: "800" },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  secTxt:  { fontSize: 11, color: C.textFaint, fontWeight: "600" },

  modalOverlay:     { flex: 1, backgroundColor: "rgba(17,18,20,0.45)", justifyContent: "flex-end" },
  modalSheet:       { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, maxHeight: "70%" },
  modalHandle:      { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 },
  modalHeaderRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle:       { fontSize: 18, color: C.text },
  modalClose:       { width: 34, height: 34, borderRadius: 10, backgroundColor: C.field, justifyContent: "center", alignItems: "center" },
  modalSearch:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.field, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  modalSearchInput: { flex: 1, fontSize: 14, color: C.text },
  modalItem:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  modalItemFlag:    { fontSize: 22 },
  modalItemName:    { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  modalItemCode:    { fontSize: 13, color: C.textMuted, fontWeight: "700" },
});


// ─── Thème (couleurs du tenant + styles) ──────────────────
function useSendTheme() {
  const { C: U } = useUI();
  return useMemo(() => {
    const C = makeColors(U);
    return {
      C,
      tS: make_tS(C), bS: make_bS(C), abS: make_abS(C), psS: make_psS(C),
      srS: make_srS(C), fbS: make_fbS(C), mmS: make_mmS(C), rcS: make_rcS(C),
      s: make_s(C),
    };
  }, [U]);
}
