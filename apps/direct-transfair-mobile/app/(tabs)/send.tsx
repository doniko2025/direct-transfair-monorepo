// apps/direct-transfair-mobile/app/(tabs)/send.tsx
// =========================================================
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

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform,
  ScrollView, Alert, Modal, FlatList, StatusBar, Animated,
  Dimensions, Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { Beneficiary, ExchangeRate } from "../../services/types";
import { countriesList, CountryData } from "../../data/countries";

const { width: W } = Dimensions.get("window");

const F = {
  display: Platform.select({ ios: "Georgia",    android: "serif",         default: "serif"      }),
  body:    Platform.select({ ios: "System",      android: "sans-serif",    default: "sans-serif" }),
};

const C = {
  g1: "#022C22", g2: "#064E3B", g3: "#065F46", g4: "#059669",
  g5: "#10B981", g6: "#34D399", gSoft: "#ECFDF5", gBorder: "#A7F3D0",
  white: "#FFFFFF",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  border: "#E5E5EA",
  borderLight: "#F0F0F0",
  text: "#0F172A", textSub: "#374151", textMuted: "#64748B", textFaint: "#9CA3AF",
  danger: "#EF4444", dangerSoft: "#FEF2F2",
  amber: "#D97706", amberSoft: "#FFFBEB",
  blue: "#2563EB", blueSoft: "#EFF6FF",
  orange: "#EA580C", orangeSoft: "#FFF7ED",
  // ✅ v2.11 — texte secondaire sur fond sombre (header en dégradé)
  heroMuted: "rgba(255,255,255,0.55)",
};

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

const fmt = (val: number, currency?: string): string => {
  const d = !currency || currency === "XOF" || currency === "GNF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(val);
  } catch { return val.toFixed(d); }
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

// ✅ v2.15 — texte saisi → nombre, réutilisée par les deux champs de
// montant (envoie / reçoit) pour la saisie bidirectionnelle.
function parseAmount(str: string): number {
  return parseFloat(str.replace(/\s/g, "").replace(",", ".")) || 0;
}

// ─── Mode Tab ─────────────────────────────────────────────
function ModeTab({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[tS.tab, active && tS.tabActive]}
      onPress={onPress} activeOpacity={0.85}
    >
      <Ionicons name={icon as any} size={17} color={active ? C.g4 : C.textMuted} style={{ marginBottom: 4 }} />
      <Text style={[tS.txt, { fontFamily: F.body }, active && tS.txtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
const tS = StyleSheet.create({
  tab:       { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 13, gap: 2 },
  tabActive: {
    backgroundColor: C.white,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  txt:       { fontSize: 12, fontWeight: "600", color: C.textMuted },
  txtActive: { color: C.g4, fontWeight: "800" },
});

// ─── Beneficiary Card ─────────────────────────────────────
function BeneficiaryCard({ item, selected, onPress }: {
  item: Beneficiary; selected: boolean; onPress: () => void;
}) {
  const scale    = useRef(new Animated.Value(1)).current;
  const cd       = getCountryData(item.country);
  const initials = item.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[bS.card, selected && bS.cardSelected]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[bS.avatar, selected && bS.avatarSelected]}>
          <Text style={[bS.avatarTxt, { fontFamily: F.display }, selected && { color: C.g4 }]}>{initials}</Text>
        </View>
        <Text style={[bS.name, { fontFamily: F.body }, selected && { color: C.g4 }]} numberOfLines={1}>
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
const bS = StyleSheet.create({
  card:           { width: 72, alignItems: "center", marginRight: 10, padding: 9, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1.5, borderColor: C.border },
  cardSelected:   { borderColor: C.g4, backgroundColor: C.gSoft },
  avatar:         { width: 40, height: 40, borderRadius: 12, backgroundColor: "#E0F2FE", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  avatarSelected: { backgroundColor: `${C.g4}20` },
  avatarTxt:      { fontSize: 16, fontWeight: "900", color: "#0284C7" },
  name:           { fontSize: 11, fontWeight: "700", color: C.textSub, textAlign: "center" },
  flag:           { fontSize: 14, marginTop: 4 },
  check:          { position: "absolute", top: -5, right: -5, backgroundColor: C.g4, borderRadius: 99, width: 20, height: 20, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: C.white },
});

// ─── ✅ v2.6 — Add Beneficiary Card (bouton "+") ──────────
function AddBeneficiaryCard({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={abS.card}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={abS.iconBox}>
          <Ionicons name="add" size={26} color={C.g4} />
        </View>
        <Text style={[abS.label, { fontFamily: F.body }]}>Nouveau</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const abS = StyleSheet.create({
  card:    {
    width: 72, alignItems: "center", marginRight: 10, padding: 9,
    backgroundColor: C.gSoft, borderRadius: 18,
    borderWidth: 1.5, borderColor: C.g4,
    borderStyle: "dashed",
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${C.g4}18`,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  label:   { fontSize: 11, fontWeight: "700", color: C.g4, textAlign: "center" },
});

// ─── ✅ v2.14 — Phone Suggestions List (autocomplétion) ────
// Liste déroulante affichée sous le champ téléphone dès que la saisie
// matche le numéro d'un ou plusieurs bénéficiaires sauvegardés. Un tap
// complète walletInput avec le numéro entier et confirme
// detectedBeneficiary immédiatement (pas d'attente du debounce de la
// détection existante v2.10, qui continue de tourner en parallèle).
function PhoneSuggestionsList({ suggestions, onSelect }: {
  suggestions: Beneficiary[]; onSelect: (b: Beneficiary) => void;
}) {
  return (
    <View style={psS.wrap}>
      {suggestions.map((b, i) => {
        const cd       = getCountryData(b.country);
        const initials = b.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
        const isLast   = i === suggestions.length - 1;
        return (
          <TouchableOpacity
            key={String(b.id)}
            style={[psS.row, isLast && { borderBottomWidth: 0 }]}
            onPress={() => onSelect(b)}
            activeOpacity={0.75}
          >
            <View style={psS.avatar}>
              <Text style={[psS.avatarTxt, { fontFamily: F.display }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[psS.name, { fontFamily: F.body }]} numberOfLines={1}>{b.fullName}</Text>
              {!!b.phone && (
                <Text style={[psS.phone, { fontFamily: F.body }]} numberOfLines={1}>{b.phone}</Text>
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
const psS = StyleSheet.create({
  wrap:      { marginTop: 10, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  avatar:    { width: 32, height: 32, borderRadius: 10, backgroundColor: C.gSoft, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 13, fontWeight: "900", color: C.g4 },
  name:      { fontSize: 13, fontWeight: "700", color: C.text },
  phone:     { fontSize: 11, color: C.textMuted, fontWeight: "600", marginTop: 1 },
  flag:      { fontSize: 16 },
});

// ─── Summary Row ──────────────────────────────────────────
function SummaryRow({ label, value, valueColor, large }: {
  label: string; value: string; valueColor?: string; large?: boolean;
}) {
  return (
    <View style={srS.row}>
      <Text style={[srS.label, { fontFamily: F.body }, large && srS.labelLarge]}>{label}</Text>
      <Text style={[srS.value, { fontFamily: large ? F.display : F.body }, large && srS.valueLarge, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}
const srS = StyleSheet.create({
  row:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  label:      { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  value:      { fontSize: 14, color: C.text, fontWeight: "700" },
  labelLarge: { fontSize: 14, color: C.text, fontWeight: "800" },
  valueLarge: { fontSize: 26, color: C.g4, letterSpacing: -0.5 },
});

// ─── Fallback Modal ───────────────────────────────────────
function FallbackModal({ visible, missing, currency, onClose, onOrangeMoney, onCard }: {
  visible: boolean; missing: number; currency: string;
  onClose: () => void; onOrangeMoney: () => void; onCard: () => void;
}) {
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
const fbS = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  handle:     { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.amberSoft, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#FDE68A" },
  warnTitle:  { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 3 },
  warnSub:    { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  warnAmount: { color: C.amber, fontWeight: "900" },
  chooseTitle:{ fontSize: 13, fontWeight: "900", color: C.textMuted, letterSpacing: 0.8, marginBottom: 14 },
  option:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 12, backgroundColor: C.white },
  optIcon:    { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  optTitle:   { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  optSub:     { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  cancelBtn:  { alignItems: "center", paddingVertical: 14 },
  cancelTxt:  { fontSize: 15, fontWeight: "700", color: C.textMuted },
});

// ─── Motif Modal ──────────────────────────────────────────
function MotifModal({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: string | null;
  onSelect: (m: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mmS.overlay}>
        <View style={mmS.sheet}>
          <View style={mmS.handle} />
          <View style={mmS.head}>
            <View>
              <Text style={[mmS.title, { fontFamily: F.display }]}>Motif du transfert</Text>
              <Text style={[mmS.sub, { fontFamily: F.body }]}>
                Choisissez un motif ci-dessous.{"\n"}Cette information restera confidentielle.
              </Text>
            </View>
            <TouchableOpacity style={mmS.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={C.textSub} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
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
const mmS = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingHorizontal: 20, paddingTop: 0, paddingBottom: 0 },
  handle:       { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginTop: 14, marginBottom: 8 },
  head:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.borderLight, marginBottom: 8 },
  title:        { fontSize: 20, color: C.text, fontWeight: "700", marginBottom: 6 },
  sub:          { fontSize: 13, color: C.textMuted, fontWeight: "500", lineHeight: 20 },
  closeBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center", marginTop: 2 },
  item:         { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: C.borderLight },
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

function buildReceiptText(r: ReceiptData): string {
  const lines = [
    "🧾 Reçu Direct Transf'air",
    "",
    `Type : ${r.mode === "WALLET" ? "Transfert Wallet" : "Cash Pickup"}`,
    `Bénéficiaire : ${r.beneficiaryName}`,
    `Montant envoyé : ${fmt(r.sentAmount, r.sentCurrency)} ${r.sentCurrency}`,
  ];
  if (r.fees > 0) lines.push(`Frais : ${fmt(r.fees, r.sentCurrency)} ${r.sentCurrency}`);
  lines.push(`Total payé : ${fmt(r.total, r.sentCurrency)} ${r.sentCurrency}`);
  lines.push(`${r.beneficiaryName.split(" ")[0]} reçoit : ${fmt(Math.round(r.receivedAmount), r.receivedCurrency)} ${r.receivedCurrency}`);
  if (r.code) lines.push("", `🔐 Code de retrait : ${r.code}`, "Ce code permet de retirer l'argent en agence.");
  if (r.motif) lines.push("", `Motif : ${r.motif}`);
  lines.push("", `Réf. : ${r.reference}`, `Date : ${r.date.toLocaleString("fr-FR")}`);
  return lines.join("\n");
}

function ReceiptModal({ visible, data, onClose }: {
  visible: boolean; data: ReceiptData | null; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const handleShare = async () => {
    try {
      await Share.share({ message: buildReceiptText(data) });
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
            <Ionicons name="checkmark-circle" size={56} color={C.g4} />
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
                value={`${fmt(Math.round(data.receivedAmount), data.receivedCurrency)} ${data.receivedCurrency}`}
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
const rcS = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:            { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "88%" },
  handle:           { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  successIconWrap:  { alignSelf: "center", marginBottom: 10 },
  title:            { fontSize: 20, color: C.text, textAlign: "center", marginBottom: 4 },
  subtitle:         { fontSize: 13, color: C.textMuted, textAlign: "center", fontWeight: "600", marginBottom: 18 },
  codeBox:          { backgroundColor: C.gSoft, borderRadius: 18, borderWidth: 1.5, borderColor: C.gBorder, padding: 18, alignItems: "center", marginBottom: 14 },
  codeLabel:        { fontSize: 10, fontWeight: "900", color: C.g4, letterSpacing: 1.2, marginBottom: 6 },
  codeValue:        { fontSize: 30, fontWeight: "700", color: C.text, letterSpacing: 4, marginBottom: 12 },
  copyBtn:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.white, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.gBorder },
  copyTxt:          { fontSize: 12, fontWeight: "700", color: C.g4 },
  recapBox:         { backgroundColor: C.bg, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16 },
  shareBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.g4, borderRadius: 16, paddingVertical: 16, marginBottom: 10 },
  shareTxt:         { fontSize: 14, fontWeight: "900", color: C.white, letterSpacing: 0.4 },
  doneBtn:          { alignItems: "center", paddingVertical: 12 },
  doneTxt:          { fontSize: 14, fontWeight: "700", color: C.textMuted },
});

// ─── Main ─────────────────────────────────────────────────
export default function SendMoneyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const [loading,          setLoading]         = useState(true);
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
  const [walletInput,         setWalletInput]        = useState("");
  const [detectedBeneficiary, setDetectedBeneficiary]= useState<Beneficiary | null>(null);
  const [selectedCashId,      setSelectedCashId]     = useState<string | null>(null);
  const [targetCurrency,    setTargetCurrency]   = useState("XOF");
  const [targetCountryData, setTargetCountryData]= useState<CountryData>(getCountryData("Sénégal"));
  const [rate,              setRate]             = useState<number>(1);
  const [rawAmount,         setRawAmount]        = useState("");
  // ✅ v2.15 — saisie bidirectionnelle du montant (voir changelog en
  // tête de fichier) : rawReceivedAmount est le pendant, éditable, du
  // champ "REÇOIT" ; amountSource retient lequel des deux champs
  // l'utilisateur est en train de saisir.
  const [rawReceivedAmount, setRawReceivedAmount] = useState("");
  const [amountSource,      setAmountSource]      = useState<"SEND" | "RECEIVED">("SEND");
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

  useEffect(() => {
    if (params.mode) {
      const m = params.mode as "WALLET" | "CASH";
      setMode(m); setIsModeLocked(true);
      if (m === "WALLET" && params.phone) setWalletInput(params.phone as string);
      if (m === "CASH" && params.beneficiaryId) setSelectedCashId(params.beneficiaryId as string);
    }
  }, [params]);

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
    try {
      const wallets = await api.getMyWallets();
      const w = wallets.find((w) => w.currency === userCurrency) ?? wallets.find((w) => (w as any).isDefault) ?? wallets[0];
      if (w) setWalletBalance(toNum(w.balance) - toNum((w as any).reservedBalance ?? 0));
      else {
        const uw = ((user as any)?.wallets ?? []).find((w: any) => w.currency === userCurrency) ?? (user as any)?.wallets?.[0];
        setWalletBalance(uw ? toNum(uw.balance) - toNum(uw.reservedBalance ?? 0) : 0);
      }
    } catch {
      const uw = ((user as any)?.wallets ?? []).find((w: any) => w.currency === userCurrency) ?? (user as any)?.wallets?.[0];
      setWalletBalance(uw ? toNum(uw.balance) - toNum(uw.reservedBalance ?? 0) : 0);
    } finally { setLoadingWallet(false); }
  }, [userCurrency, user]);

  useFocusEffect(useCallback(() => {
    const init = async () => {
      try {
        const [rates, list] = await Promise.all([api.getExchangeRates(), api.getBeneficiaries()]);
        setAllRates(rates); setBeneficiaries(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    void init();
    void fetchWalletBalance();
  }, [fetchWalletBalance]));

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

  // ✅ v2.14 — FIX 2 : source unique de vérité pour "combien de
  // chiffres l'utilisateur a saisis", réutilisée par canSend,
  // handleAction, la détection ci-dessous et phoneSuggestions plus bas
  // (auparavant recalculée différemment à plusieurs endroits).
  const walletInputDigits = walletInput.replace(/\D/g, "");

  // ✅ v2.10 — Détection bénéficiaire par téléphone/email/nom
  //   1) Recherche dans les bénéficiaires SAUVEGARDÉS, comparaison
  //      téléphone par SUFFIXE (robuste à l'indicatif pays).
  //   2) Si rien trouvé ET input ≥ 7 chiffres → fallback debouncé (450ms)
  //      vers GET /users/by-phone pour détecter un utilisateur
  //      Direct Transf'air inscrit mais non sauvegardé comme contact.
  //      Son nom/prénom est injecté dans detectedBeneficiary avec
  //      isFavorite: false (sert de marqueur pour le badge dans le JSX).
  // ✅ v2.14 — FIX 2 (voir changelog en tête de fichier) : réutilise
  // walletInputDigits (calculé une seule fois au niveau du composant)
  // au lieu de recalculer sa propre version locale de inputDigits.
  useEffect(() => {
    // Pas en mode WALLET ou input trop court → reset et sortie
    if (mode !== "WALLET" || walletInput.length < 3) {
      setDetectedBeneficiary(null);
      return;
    }

    const q = walletInput.toLowerCase().trim();

    // ── Étape 1 : Recherche dans les bénéficiaires sauvegardés ──
    const found = beneficiaries.find((b) => {
      const storedDigits = (b.phone ?? "").replace(/\D/g, "");
      const phoneMatch   =
        storedDigits.length > 0 &&
        walletInputDigits.length  > 0 &&
        (storedDigits.endsWith(walletInputDigits) ||
         walletInputDigits.endsWith(storedDigits.slice(-walletInputDigits.length)));

      const emailMatch = b.email ? b.email.toLowerCase().includes(q) : false;
      const nameMatch  = b.fullName ? b.fullName.toLowerCase().includes(q) : false;

      return phoneMatch || emailMatch || nameMatch;
    });

    if (found) {
      setDetectedBeneficiary(found);
      updateCurrencyContext(found.country);
      return;
    }

    // Aucun bénéficiaire sauvegardé trouvé → reset
    setDetectedBeneficiary(null);

    // ── Étape 2 : Fallback plateforme (debounce 450ms) ──────────
    // Seulement si l'input ressemble à un numéro (≥ 7 chiffres)
    if (walletInputDigits.length < 7) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await (api.http as any).get(
          `/users/by-phone?q=${encodeURIComponent(walletInputDigits)}`,
        );
        const platformUser = res.data;
        if (platformUser?.id) {
          // ── Pseudo-bénéficiaire pour réutiliser l'UI existante ──
          // isFavorite: false = signal "utilisateur plateforme non
          // sauvegardé" → testé dans le JSX pour le badge différencié.
          setDetectedBeneficiary({
            id:         platformUser.id,
            fullName:   [platformUser.firstName, platformUser.lastName]
                          .filter(Boolean).join(" ") || "Utilisateur",
            phone:      platformUser.phone ?? walletInput,
            email:      undefined as any,
            country:    platformUser.country ?? "Sénégal",
            city:       undefined as any,
            isFavorite: false,
          } as any);

          if (platformUser.country) {
            updateCurrencyContext(platformUser.country);
          }
        }
      } catch {
        // Endpoint non dispo ou erreur réseau → silent fail
        // (l'UI retombe sur le hint "Aucun contact trouvé")
      }
    }, 450);

    return () => clearTimeout(timer); // cleanup si l'input change avant le délai

  }, [walletInput, beneficiaries, mode, updateCurrencyContext]);

  useEffect(() => {
    if (mode === "CASH" && selectedCashId) {
      const found = beneficiaries.find((b) => String(b.id) === selectedCashId);
      if (found) updateCurrencyContext(found.country);
    }
  }, [selectedCashId, mode, beneficiaries, updateCurrencyContext]);

  // ✅ v2.14 — NOUVEAU : autocomplétion. Bénéficiaires sauvegardés dont
  // le numéro contient les chiffres tapés — ceux dont le numéro
  // COMMENCE par ces chiffres remontent en premier. Masqué dès qu'un
  // bénéficiaire est déjà confirmé (detectedBeneficiary).
  const phoneSuggestions = React.useMemo(() => {
    if (mode !== "WALLET" || detectedBeneficiary || walletInputDigits.length < 2) return [];
    return beneficiaries
      .filter((b) => {
        const storedDigits = (b.phone ?? "").replace(/\D/g, "");
        return storedDigits.length > 0 && storedDigits.includes(walletInputDigits);
      })
      .sort((a, b) => {
        const aStarts = (a.phone ?? "").replace(/\D/g, "").startsWith(walletInputDigits) ? 0 : 1;
        const bStarts = (b.phone ?? "").replace(/\D/g, "").startsWith(walletInputDigits) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 5);
  }, [beneficiaries, walletInputDigits, mode, detectedBeneficiary]);

  // ✅ v2.14 — Sélection d'une suggestion : complète le numéro et
  // confirme immédiatement le bénéficiaire, sans attendre le debounce.
  const handleSelectSuggestion = useCallback((b: Beneficiary) => {
    setWalletInput(b.phone ?? b.fullName);
    setDetectedBeneficiary(b);
    updateCurrencyContext(b.country);
  }, [updateCurrencyContext]);

  // ✅ v2.15 — sendAmount dérivé dans le sens correspondant au champ
  // que l'utilisateur est en train de saisir (voir changelog en tête
  // de fichier). Reste le SEUL point d'entrée vers le reste de l'écran
  // (frais, total, solde insuffisant, création de transaction) — rien
  // d'autre n'a besoin de connaître amountSource.
  const parsedSendRaw     = parseAmount(rawAmount);
  const parsedReceivedRaw = parseAmount(rawReceivedAmount);

  const sendAmount = amountSource === "RECEIVED"
    ? (rate > 0 ? parsedReceivedRaw / rate : 0)
    : parsedSendRaw;

  // Synchronise le champ "REÇOIT" quand l'utilisateur tape dans
  // "VOUS ENVOYEZ" — ne fait rien si c'est l'inverse qui est en cours
  // de saisie (sinon les deux champs s'écraseraient en boucle).
  useEffect(() => {
    if (amountSource !== "SEND") return;
    if (!(rate > 0)) return;
    const amt = parseAmount(rawAmount);
    setRawReceivedAmount(amt > 0 ? String(Math.round(amt * rate)) : "");
  }, [rawAmount, rate, amountSource]);

  // Synchronise le champ "VOUS ENVOYEZ" quand l'utilisateur tape dans
  // "REÇOIT" — même garde, dans l'autre sens.
  useEffect(() => {
    if (amountSource !== "RECEIVED") return;
    const amt = parseAmount(rawReceivedAmount);
    setRawAmount(amt > 0 ? String(Math.round(rate > 0 ? amt / rate : 0)) : "");
  }, [rawReceivedAmount, rate, amountSource]);

  const beneficiaryLabel = React.useMemo(() => {
    if (mode === "WALLET") {
      return detectedBeneficiary?.fullName?.split(" ")[0] ?? "Le bénéficiaire";
    }
    const sel = beneficiaries.find(b => String(b.id) === selectedCashId);
    return sel?.fullName?.split(" ")[0] ?? "Le bénéficiaire";
  }, [mode, detectedBeneficiary, beneficiaries, selectedCashId]);

  const feesRate    = mode === "WALLET" ? 0 : cashFeeRate;
  const feesAmt     = sendAmount * feesRate;
  const totalAmt    = sendAmount + feesAmt;
  // ✅ v2.15 — en saisie "RECEIVED", on garde la valeur tapée telle
  // quelle (pas sendAmount * rate, qui réintroduirait un arrondi en
  // aller-retour inutile) ; en saisie "SEND", comportement inchangé.
  const receivedAmt = amountSource === "RECEIVED" ? parsedReceivedRaw : sendAmount * rate;
  const insufficient   = totalAmt > walletBalance && sendAmount > 0;
  const missingAmount  = Math.max(0, totalAmt - walletBalance);
  const isNumericInput = walletInput.trim() === "" || /^[0-9+\s]+$/.test(walletInput);
  // ✅ v2.14 — FIX 1 (voir changelog en tête de fichier) : même
  // condition EXACTE que le contrôle équivalent dans handleAction
  // (detectedBeneficiary || walletInputDigits.length >= 7), pour que
  // le bouton ne soit jamais actif sur une saisie que handleAction
  // rejetterait ensuite.
  const canSend = sendAmount > 0 && !insufficient && (mode === "WALLET" ? (!!detectedBeneficiary || walletInputDigits.length >= 7) : !!selectedCashId);

  const handleAction = async () => {
    if (insufficient) { setShowFallback(true); return; }
    if (sendAmount <= 0) return Alert.alert("Montant invalide", "Saisissez un montant valide.");
    setSending(true);
    try {
      if (mode === "WALLET") {
        // ✅ v2.14 — FIX 1/2 : walletInputDigits (chiffres uniquement)
        // au lieu de walletInput.length (caractères bruts, faussé par
        // espaces/tirets) — même condition que canSend ci-dessus.
        if (!detectedBeneficiary && walletInputDigits.length < 7) {
          setSending(false);
          return Alert.alert("Erreur", "Numéro trop court ou contact introuvable.");
        }
        const tx: any = await api.createTransaction({
          amount:          sendAmount,
          currency:        userCurrency,
          beneficiaryId:   detectedBeneficiary ? String(detectedBeneficiary.id) : undefined,
          payoutMethod:    "MOBILE_MONEY",
          note:            motif ?? undefined,
        });
        // ✅ "id" confirmé comme champ de référence (utilisé par cancelTransaction/getTransaction dans api.ts)
        const reference = tx?.reference ?? tx?.id ?? `TX-${Date.now()}`;
        // ✅ v2.13 — FIX (voir changelog en tête de fichier) : si le
        // backend n'a pas pu créditer immédiatement un wallet (aucun
        // recipientId résolu — numéro non reconnu par la plateforme),
        // la transaction reste "en attente" avec un code de retrait
        // généré côté backend (même mécanisme que Cash Pickup). Avant
        // ce fix, ce code n'était jamais extrait ni affiché en mode
        // Wallet.
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
          beneficiaryName: detectedBeneficiary?.fullName ?? walletInput,
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
        const tx: any = await api.createTransaction({
          amount:        sendAmount,
          currency:      userCurrency,
          beneficiaryId: selectedCashId,
          payoutMethod:  "CASH_PICKUP",
          note:          motif ?? undefined,
        });
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
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={C.g4} />
        <Text style={[s.loaderTxt, { fontFamily: F.body }]}>Chargement…</Text>
      </View>
    );
  }

  const selectedMotif = MOTIFS.find((m) => m.label === motif);
  // ✅ v2.10 — true si le bénéficiaire détecté est un utilisateur
  // plateforme (non sauvegardé), false/undefined sinon
  const isPlatformOnly = (detectedBeneficiary as any)?.isFavorite === false;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.g1} />

      {/* ══ HEADER — ✅ v2.11 : dégradé sombre, solde intégré (plus de
          carte flottante séparée) ══ */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-20,0] }) }],
      }}>
        <LinearGradient
          colors={[C.g1, C.g3]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          {/* Halo décoratif — élément signature, discret */}
          <View style={s.heroGlow} pointerEvents="none" />

          <View style={s.headerTop}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { fontFamily: F.display }]}>
              {mode === "WALLET" ? "Transfert Wallet" : "Envoi d'Argent"}
            </Text>
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowBalance(!showBalance)}>
              <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={18} color={C.white} />
            </TouchableOpacity>
          </View>

          <Ionicons
            name="wallet"
            size={72}
            color="rgba(5,150,105,0.14)"
            style={s.balanceWatermark}
            pointerEvents="none"
          />
          <Text style={[s.balanceLbl, { fontFamily: F.body }]}>Solde disponible</Text>
          {loadingWallet
            ? <ActivityIndicator color={C.heroMuted} size="small" />
            : <Text style={[s.balanceVal, { fontFamily: F.display }]}>
                {showBalance ? `${fmt(walletBalance, userCurrency)} ${userCurrency}` : "• • • • •"}
              </Text>
          }
          {insufficient && sendAmount > 0 && (
            <View style={s.insufficientBadge}>
              <Ionicons name="warning-outline" size={11} color={C.amber} />
              <Text style={[s.insufficientTxt, { fontFamily: F.body }]}>Solde insuffisant</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* ══ SHEET — ✅ v2.11 : enveloppe arrondie qui chevauche le header.
          Fond C.bg inchangé → blocks du body strictement identiques à
          la v2.10 (Bénéficiaire, Montant, Motif, Récapitulatif, CTA) ══ */}
      <View style={s.sheet}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0,1], outputRange: [30,0] }) }],
            }}>

              {/* ── Onglets mode ── */}
              {!isModeLocked && (
                <View style={s.tabsWrap}>
                  <ModeTab label="Wallet"      icon="phone-portrait-outline" active={mode === "WALLET"} onPress={() => setMode("WALLET")} />
                  <ModeTab label="Cash Pickup" icon="cash-outline"           active={mode === "CASH"}   onPress={() => setMode("CASH")}   />
                </View>
              )}

              {/* ── Bénéficiaire ── */}
              <View style={s.block}>
                <View style={s.blockHeader}>
                  <View style={[s.blockNum, { backgroundColor: C.gSoft }]}>
                    <Ionicons name="person-outline" size={14} color={C.g4} />
                  </View>
                  <Text style={[s.blockTitle, { fontFamily: F.body }]}>Bénéficiaire</Text>
                </View>

                {mode === "WALLET" ? (
                  <>
                    <View style={s.phoneWrap}>
                      <TouchableOpacity style={s.dialBtn} onPress={() => setShowCountryModal(true)}>
                        <Text style={s.dialFlag}>{targetCountryData.flag}</Text>
                        <Text style={[s.dialCode, { fontFamily: F.body }]}>+{targetCountryData.dialCode}</Text>
                        <Ionicons name="chevron-down" size={12} color={C.textMuted} />
                      </TouchableOpacity>
                      <TextInput
                        style={[s.phoneInput, { fontFamily: F.body }]}
                        value={walletInput}
                        onChangeText={setWalletInput}
                        placeholder="Téléphone, email ou nom…"
                        placeholderTextColor={C.textFaint}
                        keyboardType={isNumericInput ? "phone-pad" : "default"}
                        autoCapitalize="none"
                      />
                      {walletInput.length > 0 && (
                        <TouchableOpacity style={s.clearInputBtn} onPress={() => setWalletInput("")}>
                          <Ionicons name="close-circle" size={18} color={C.textFaint} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {detectedBeneficiary ? (
                      <>
                        <View style={[s.detectedCard, isPlatformOnly && s.detectedCardPlatform]}>
                          <View style={[s.detectedAvatar, isPlatformOnly && s.detectedAvatarPlatform]}>
                            <Text style={[
                              s.detectedAvatarTxt, { fontFamily: F.display },
                              isPlatformOnly && { color: C.blue },
                            ]}>
                              {detectedBeneficiary.fullName[0]}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[
                              s.detectedLabel, { fontFamily: F.body },
                              isPlatformOnly && { color: C.blue },
                            ]}>
                              {isPlatformOnly ? "UTILISATEUR DIRECT TRANSF'AIR" : "TROUVÉ"}
                            </Text>
                            <Text style={[s.detectedName,  { fontFamily: F.body }]}>{detectedBeneficiary.fullName}</Text>
                            {detectedBeneficiary.phone && (
                              <Text style={[s.detectedPhone, { fontFamily: F.body }]}>{detectedBeneficiary.phone}</Text>
                            )}
                          </View>
                          <View style={[s.detectedCheck, isPlatformOnly && s.detectedCheckPlatform]}>
                            <Ionicons
                              name={isPlatformOnly ? "person-outline" : "checkmark"}
                              size={14} color={C.white}
                            />
                          </View>
                          <Text style={s.detectedFlag}>{getCountryData(detectedBeneficiary.country).flag}</Text>
                        </View>

                        {/* ✅ v2.10 — Utilisateur plateforme détecté, pas encore sauvegardé */}
                        {isPlatformOnly && (
                          <TouchableOpacity
                            style={s.platformAddRow}
                            onPress={() => router.push({
                              pathname: "/(tabs)/beneficiaries/create",
                              params: {
                                phone: detectedBeneficiary.phone ?? walletInput,
                                name:  detectedBeneficiary.fullName,
                              },
                            } as any)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="person-add-outline" size={14} color={C.blue} />
                            <Text style={[s.platformAddTxt, { fontFamily: F.body }]}>
                              + Enregistrer comme contact
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      <>
                        {/* ✅ v2.14 — NOUVEAU : suggestions d'autocomplétion,
                            affichées tant qu'aucun bénéficiaire n'est confirmé */}
                        {phoneSuggestions.length > 0 && (
                          <PhoneSuggestionsList
                            suggestions={phoneSuggestions}
                            onSelect={handleSelectSuggestion}
                          />
                        )}
                        {phoneSuggestions.length === 0 && walletInput.length >= 3 && (
                          <View style={s.addHint}>
                            <View style={s.addHintIcon}>
                              <Ionicons name="person-add-outline" size={16} color={C.g4} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.addHintTxt, { fontFamily: F.body }]}>
                                Aucun contact trouvé pour "{walletInput}"
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
                      contentContainerStyle={{ paddingBottom: 4 }}
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
                            <Text style={[s.detectedAvatarTxt, { fontFamily: F.display }]}>{sel.fullName[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.detectedLabel, { fontFamily: F.body }]}>SÉLECTIONNÉ</Text>
                            <Text style={[s.detectedName,  { fontFamily: F.body }]}>{sel.fullName}</Text>
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
                <View style={s.blockHeader}>
                  <View style={[s.blockNum, { backgroundColor: C.gSoft }]}>
                    <Ionicons name="cash-outline" size={14} color={C.g4} />
                  </View>
                  <Text style={[s.blockTitle, { fontFamily: F.body }]}>
                    Montant{feesRate > 0 && (
                      <Text style={{ color: C.amber }}> (Frais {cashFeeLabel} %)</Text>
                    )}
                  </Text>
                </View>
                <View style={s.amountCard}>
                  <View style={s.amountSide}>
                    <Text style={[s.amountSideLabel, { fontFamily: F.body }]}>VOUS ENVOYEZ</Text>
                    <View style={s.amountInputRow}>
                      <TextInput
                        style={[s.amountInput, { fontFamily: F.display }]}
                        value={rawAmount}
                        onChangeText={(t) => { setAmountSource("SEND"); setRawAmount(t); }}
                        keyboardType="numeric" placeholder="000" placeholderTextColor={C.textFaint}
                      />
                      <View style={[s.currBadge, { backgroundColor: C.gSoft }]}>
                        <Text style={[s.currTxt, { color: C.g4, fontFamily: F.body }]}>{userCurrency}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.amountArrow}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={C.g4} />
                  </View>
                  <View style={s.amountSide}>
                    <Text style={[s.amountSideLabel, { fontFamily: F.body }]}>
                      {detectedBeneficiary?.fullName?.split(" ")[0] ??
                        (selectedCashId
                          ? (beneficiaries.find((b) => String(b.id) === selectedCashId)?.fullName?.split(" ")[0] ?? "")
                          : "REÇOIT")}
                    </Text>
                    {/* ✅ v2.15 — champ éditable (auparavant un simple <Text>
                        en lecture seule) : tape un montant à recevoir, le
                        champ "VOUS ENVOYEZ" se recalcule automatiquement. */}
                    <View style={s.amountInputRow}>
                      <TextInput
                        style={[s.amountReceived, { fontFamily: F.display }]}
                        value={rawReceivedAmount}
                        onChangeText={(t) => { setAmountSource("RECEIVED"); setRawReceivedAmount(t); }}
                        keyboardType="numeric" placeholder="0" placeholderTextColor={C.textFaint}
                      />
                      <View style={[s.currBadge, { backgroundColor: C.blueSoft }]}>
                        <Text style={[s.currTxt, { color: C.blue, fontFamily: F.body }]}>{targetCurrency}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                {sendAmount > 0 && rate !== 1 && (
                  <View style={s.rateChip}>
                    <Ionicons name="trending-up-outline" size={13} color={C.g4} />
                    <Text style={[s.rateTxt, { fontFamily: F.body }]}>
                      1 {userCurrency} = {rate.toFixed(4)} {targetCurrency}
                    </Text>
                  </View>
                )}
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
                    motif ? { color: C.text, fontWeight: "700" } : { color: C.textFaint },
                  ]}>
                    {motif ?? "Motif du transfert"}
                  </Text>
                  {motif && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setMotif(null); }}
                      hitSlop={8}
                      style={s.motifClear}
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
                  <View style={s.blockHeader}>
                    <View style={[s.blockNum, { backgroundColor: C.gSoft }]}>
                      <Ionicons name="receipt-outline" size={14} color={C.g4} />
                    </View>
                    <Text style={[s.blockTitle, { fontFamily: F.body }]}>Récapitulatif</Text>
                  </View>
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
                    value={`${fmt(Math.round(receivedAmt > 0 ? receivedAmt : sendAmount), targetCurrency)} ${targetCurrency}`}
                    valueColor={C.blue}
                  />
                  {targetCurrency !== userCurrency && rate !== 1 && (
                    <View style={s.rateChip}>
                      <Ionicons name="trending-up-outline" size={13} color={C.g4} />
                      <Text style={[s.rateTxt, { fontFamily: F.body }]}>
                        1 {userCurrency} = {rate.toFixed(4)} {targetCurrency}
                      </Text>
                    </View>
                  )}
                  {motif && (
                    <>
                      <View style={s.summaryDivider} />
                      <SummaryRow label="Motif" value={`${selectedMotif?.icon ?? ""} ${motif}`} />
                    </>
                  )}
                  <View style={[s.summaryDivider, { backgroundColor: C.gBorder, height: 1.5 }]} />
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

              {/* ── CTA ── */}
              <Pressable
                style={({ pressed }) => [
                  s.cta,
                  insufficient && s.ctaAlt,
                  !canSend && !insufficient && s.ctaDisabled,
                  pressed && { opacity: 0.92 },
                ]}
                onPress={handleAction}
                disabled={sending || (!canSend && !insufficient)}
              >
                {sending ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <View style={s.ctaIcon}>
                      <Ionicons
                        name={insufficient ? "options-outline" : mode === "WALLET" ? "phone-portrait-outline" : "cash-outline"}
                        size={20} color={C.white}
                      />
                    </View>
                    <Text style={[s.ctaTxt, { fontFamily: F.body }]}>
                      {insufficient
                        ? "AUTRE MOYEN DE PAIEMENT"
                        : mode === "WALLET"
                          ? "CONFIRMER LE TRANSFERT"
                          : "GÉNÉRER LE CODE DE RETRAIT"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={C.white} style={{ opacity: 0.7 }} />
                  </>
                )}
              </Pressable>

              <View style={s.secNote}>
                <Ionicons name="shield-checkmark-outline" size={13} color={C.g5} />
                <Text style={[s.secTxt, { fontFamily: F.body }]}>Transfert sécurisé · Crypté de bout en bout</Text>
              </View>
              <View style={{ height: 120 }} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ── Motif Modal ── */}
      <MotifModal
        visible={showMotifModal}
        selected={motif}
        onSelect={setMotif}
        onClose={() => setShowMotifModal(false)}
      />

      {/* ── Country Picker ── */}
      <Modal visible={showCountryModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { fontFamily: F.display }]}>Indicatif pays</Text>
              <TouchableOpacity style={s.modalClose} onPress={() => { setShowCountryModal(false); setCountrySearch(""); }}>
                <Ionicons name="close" size={18} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={s.modalSearch}>
              <Ionicons name="search-outline" size={15} color={C.textFaint} />
              <TextInput
                style={[s.modalSearchInput, { fontFamily: F.body }]}
                value={countrySearch} onChangeText={setCountrySearch}
                placeholder="Rechercher…" placeholderTextColor={C.textFaint}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries} keyExtractor={(item) => item.code}
              style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setTargetCountryData(item);
                    updateCurrencyContext(item.name);
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
const s = StyleSheet.create({
  // ✅ v2.11 — fond aligné sur le 1er ton du dégradé (zone réservée par
  // SafeAreaView sous l'encoche iOS, doit rester sombre en continuité du header)
  safe:      { flex: 1, backgroundColor: C.g1 },
  loader:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg, gap: 12 },
  loaderTxt: { fontSize: 14, color: C.textMuted, fontWeight: "600" },

  // ── Header — ✅ v2.11 : plus de backgroundColor ici, géré par
  // LinearGradient (colors=[C.g1, C.g3]) sur le composant parent.
  // paddingTop INCHANGÉ. paddingBottom augmenté pour laisser la sheet
  // chevaucher proprement le bas du header.
  header: {
    paddingTop: Platform.OS === "android" ? 44 : 10,
    paddingBottom: 32, paddingHorizontal: 20,
    overflow: "hidden",
  },
  // ✅ v2.11 — halo décoratif discret, coin haut-droit
  heroGlow: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(5,150,105,0.18)",
  },
  headerTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  // ✅ v2.11 — style "verre" (fond blanc translucide), forme inchangée
  backBtn:     {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
    justifyContent: "center", alignItems: "center",
  },
  // ✅ v2.11 — blanc (était C.text)
  headerTitle: { fontSize: 20, color: C.white, letterSpacing: -0.2 },
  // ✅ v2.11 — style "verre", identique à backBtn
  eyeBtn:      {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
    justifyContent: "center", alignItems: "center",
  },
  // ✅ v2.11 — repositionné à même le header (plus de carte séparée derrière)
  balanceWatermark:  { position: "absolute", bottom: 10, right: 12 },
  // ✅ v2.11 — clair sur fond sombre (était C.textMuted)
  balanceLbl:  { color: C.heroMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  // ✅ v2.11 — blanc (était C.text), fontSize INCHANGÉ (30, cf. v2.7 compact)
  balanceVal:  { color: C.white, fontSize: 30, letterSpacing: -0.8 },
  insufficientBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.amberSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  insufficientTxt:   { fontSize: 11, color: C.amber, fontWeight: "700" },

  // ✅ v2.11 — sheet arrondie qui enveloppe le body et chevauche le header
  sheet: {
    flex: 1,
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    overflow: "hidden",
  },

  // scroll.paddingTop 10 → 16 (✅ v2.11, pour respirer sous l'arrondi de la sheet)
  scroll:   { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 16 },
  tabsWrap: { flexDirection: "row", backgroundColor: "#F0F0F0", borderRadius: 16, padding: 4, marginBottom: 10 },

  block: {
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  blockNum:    { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  blockTitle:  { fontSize: 14, fontWeight: "800", color: C.text },

  phoneWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, overflow: "hidden" },
  dialBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, borderRightColor: C.border },
  dialFlag:      { fontSize: 18 },
  dialCode:      { fontSize: 13, fontWeight: "700", color: C.text },
  phoneInput:    { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 15, color: C.text },
  clearInputBtn: { paddingHorizontal: 12 },

  detectedCard:      { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, backgroundColor: C.gSoft, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.gBorder },
  // ✅ v2.10 — variante "utilisateur plateforme détecté, non sauvegardé"
  detectedCardPlatform:   { backgroundColor: C.blueSoft, borderColor: "#BFDBFE" },
  detectedAvatar:    { width: 40, height: 40, borderRadius: 12, backgroundColor: `${C.g4}20`, justifyContent: "center", alignItems: "center" },
  detectedAvatarPlatform: { backgroundColor: `${C.blue}20` },
  detectedAvatarTxt: { fontSize: 18, fontWeight: "900", color: C.g4 },
  detectedLabel:     { fontSize: 10, fontWeight: "900", color: C.g4, letterSpacing: 0.8, marginBottom: 2 },
  detectedName:      { fontSize: 14, fontWeight: "800", color: C.text },
  detectedPhone:     { fontSize: 12, color: C.textMuted, fontWeight: "600", marginTop: 2 },
  detectedCheck:     { width: 28, height: 28, borderRadius: 99, backgroundColor: C.g4, justifyContent: "center", alignItems: "center" },
  detectedCheckPlatform:  { backgroundColor: C.blue },
  detectedFlag:      { fontSize: 24 },
  // ✅ v2.10 — lien "Enregistrer comme contact" sous la carte plateforme
  platformAddRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 4 },
  platformAddTxt:    { fontSize: 13, color: C.blue, fontWeight: "800" },
  addHint:     { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, padding: 12, backgroundColor: C.gSoft, borderRadius: 14, borderWidth: 1, borderColor: C.gBorder, borderStyle: "dashed" },
  addHintIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${C.g4}20`, justifyContent: "center", alignItems: "center" },
  addHintTxt:  { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  addHintLink: { fontSize: 13, color: C.g4, fontWeight: "800" },

  amountCard:      { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, padding: 12, gap: 8 },
  amountSide:      { flex: 1 },
  amountSideLabel: { fontSize: 9, fontWeight: "900", color: C.textFaint, letterSpacing: 0.8, marginBottom: 3 },
  amountInputRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  amountInput:     { fontSize: 22, color: C.text, letterSpacing: -0.5, minWidth: 60 },
  // ✅ v2.15 — minWidth ajouté (60, comme amountInput) : c'est
  // désormais un <TextInput>, pas un <Text>, et sans largeur minimale
  // un champ vide se réduit à ~0px et devient impossible à toucher.
  amountReceived:  { fontSize: 20, color: C.text, letterSpacing: -0.5, minWidth: 60 },
  amountArrow:     { width: 32, height: 32, borderRadius: 9, backgroundColor: C.gSoft, justifyContent: "center", alignItems: "center" },
  currBadge:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  currTxt:         { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  rateChip: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start", backgroundColor: C.gSoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  rateTxt:  { fontSize: 12, color: C.g4, fontWeight: "700" },

  motifRow:    {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  motifLeft:   { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  motifEmoji:  { fontSize: 20, width: 28, textAlign: "center" },
  motifIconBox:{ width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  motifTxt:    { fontSize: 14, flex: 1 },
  motifClear:  { padding: 2 },

  summaryDivider:     { height: 1, backgroundColor: C.borderLight, marginVertical: 2 },
  insufficientBar:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amberSoft, borderRadius: 10, padding: 10, marginTop: 8 },
  insufficientBarTxt: { fontSize: 13, color: C.amber, fontWeight: "600", flex: 1 },

  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.g4, borderRadius: 18, paddingVertical: 18, marginTop: 8,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  ctaAlt:      { backgroundColor: C.amber },
  ctaDisabled: { backgroundColor: C.border },
  ctaIcon:     { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  ctaTxt:      { fontSize: 15, fontWeight: "900", color: C.white, letterSpacing: 0.3 },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  secTxt:  { fontSize: 11, color: C.textFaint, fontWeight: "600" },

  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:       { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "70%" },
  modalHandle:      { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  modalHeaderRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:       { fontSize: 18, color: C.text },
  modalClose:       { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center" },
  modalSearch:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F5F5F5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  modalSearchInput: { flex: 1, fontSize: 14, color: C.text },
  modalItem:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  modalItemFlag:    { fontSize: 22 },
  modalItemName:    { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  modalItemCode:    { fontSize: 13, color: C.textMuted, fontWeight: "700" },
});