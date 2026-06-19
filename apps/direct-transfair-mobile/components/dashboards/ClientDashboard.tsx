// =========================================================
// CLIENT DASHBOARD v9.7 — Direct Transf'air
// ✅ v9.1 sur base v9.0 :
//    - Vert émeraude #17A45F (plus vif, moins corporate)
//    - Hero réduit : paddingBottom 28→16, nom 22→19
//    - Devise affichée DEVANT le solde (EUR 214,78)
//    - CTA "Envoyer" : bouton BLANC ombré (plus de vert)
//    - Icônes actions rapides : carrés blancs ombrés + icône émeraude
//    - Logique métier 100 % inchangée
// ✅ v9.2 : FIX — liste des transactions cachée derrière la tab bar.
//           Ajout de useSafeAreaInsets + TAB_BAR_HEIGHT pour calculer
//           un paddingBottom dynamique (au lieu du spacer fixe de 24px
//           qui ne suffisait pas à libérer la zone sous la tab bar).
// ✅ v9.3 : REFONTE VISUELLE "Blanc pur · Cartes flottantes · Vert émeraude"
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (loadData, calculs monthSent/monthRecv, recentContacts, wallets,
//    helpers toNum/fmt/fmtDate, navigation : tout identique).
//    - Hero : fond vert plein → fond blanc pur. Le solde passe en texte
//      sombre, le préfixe devise (EUR) repasse en vert émeraude au lieu
//      de blanc semi-transparent.
//    - StatusBar : light-content → dark-content (fond clair désormais).
//    - Notification/avatar : boutons adaptés à un fond clair (cercle
//      gris très pâle + bordure pour la cloche, cercle vert plein pour
//      l'avatar — au lieu des cercles "glass" blanc transparent qui
//      n'étaient visibles que sur fond vert).
//    - NOUVEAU bandeau taux sous le solde ("EUR → XOF · 655,96 · Envoi
//      wallet 0 frais") : réutilise simplement l'état `eurXofRate` déjà
//      récupéré par loadData() (aucun nouvel appel API). Tap → /(tabs)/rates,
//      comme le bouton "Taux" des actions rapides.
//    - En conséquence, la 3ème carte "EUR → XOF" de la rangée de stats
//      est retirée (elle ferait doublon avec ce nouveau bandeau). Le
//      state eurXofRate et son fetch restent inchangés, seul l'endroit
//      où on l'affiche change.
//    - Cartes "Actions rapides" : bordure verte très pâle ajoutée pour
//      l'effet "carte flottante" du mockup, au lieu du blanc + ombre seule.
// ✅ v9.4 : HERO SANS VERT + CARTE FLOTTANTE
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (mêmes states, mêmes calculs, mêmes appels API, mêmes routes).
//    - Plus aucune couleur verte dans le Hero : avatar (vert → encre
//      anthracite), préfixe devise (vert → encre sourdine), pastille
//      "En ligne" (vert → bleu, réutilise le token déjà existant pour
//      le statut "Traitement", donc rien de neuf dans la palette).
//    - Le Hero passe d'un fond blanc plat à un fond gris (même teinte
//      que le corps de page) : Hero et body se fondent en un seul
//      canevas continu, plus de rupture visuelle en bas du Hero.
//    - Le bloc solde devient une carte flottante blanche détachée
//      (nouveau style `balanceCard`) avec une ombre plus marquée
//      (`heroCardShadow`) que les autres cartes, pour bien la mettre
//      en avant comme élément central de l'écran.
//    - Élément signature : léger filigrane (icône "wallet") en
//      arrière-plan de la carte solde, posé en coin, opacité quasi
//      nulle — clin d'œil "carte bancaire premium" sans surcharger.
//    - Bouton notification : fond blanc + légère ombre (au lieu du
//      gris pâle) pour bien se détacher du nouveau fond gris du Hero.
//    - SafeAreaView / StatusBar : fond blanc → fond gris (cohérent
//      avec le nouveau Hero gris, pour une transition invisible sous
//      l'encoche / la barre de statut).
// ✅ v9.5 : FIX — "Bon retour / Fatim" + cloche/avatar recouverts par la
//    barre de statut système (surtout visible sur Android). En cause :
//    SafeAreaView importé depuis "react-native" ne réserve l'espace de
//    la status bar que sur iOS, pas sur Android. Le Hero utilise déjà
//    `insets` (useSafeAreaInsets, importé depuis react-native-safe-area-
//    context et déjà utilisé pour le paddingBottom du ScrollView) : on
//    applique maintenant `insets.top + 8` en paddingTop du Hero, qui
//    fonctionne de façon fiable sur les deux plateformes.
//    Fix annexe : paddingHorizontal du Hero 20 → 10 pour agrandir la
//    carte solde.
// ✅ v9.6 : 2 retouches ponctuelles — paddingHorizontal Hero 10 → 6,
//    et fond marron plein ajouté derrière l'icône wallet.
// ✅ v9.7 : CORRECTIF de la v9.6 — rien d'autre touché.
//    1) Filigrane portefeuille : retour à l'icône SEULE, SANS le carré
//       de fond ajouté en v9.6 (ce carré peignait le CONTENANT de
//       l'icône, pas l'icône elle-même — erreur signalée). Remplacé par
//       l'icône pleine "wallet" (au lieu de "wallet-outline") directement
//       en brun plein #8E562E (même couleur que celle tracée sur le
//       mockup), sans aucun cadre ni case derrière.
//    2) Carte solde élargie davantage : paddingHorizontal du Hero
//       6 → 2, pour coller au rectangle quasi bord-à-bord du mockup.
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

// Hauteur approximative de la tab bar native (cohérente avec les autres dashboards)
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 84 : 70;

// ─── Design System ──────────────────────────────────────
const C = {
  // Brand — vert émeraude (plus vif, plus «gemme»)
  green:     "#17A45F",   // émeraude principal (icônes, accents, hero bg)
  greenDark: "#0E8A4E",   // émeraude foncé (pressed, ombre CTA)

  // Backgrounds — uniquement neutre, plus de vert en fond
  pageBg: "#F5F5F5",
  white:  "#FFFFFF",

  // Badges statut (pale, usage uniquement dans les pills)
  greenPale:  "#E8FAF2",  // ajusté pour émeraude #17A45F
  amberBg:    "#FFFBEB",
  blueBg:     "#EFF6FF",
  redBg:      "#FEF2F2",
  slateLight: "#F8FAFC",

  // Textes
  ink:     "#1C1C1E",
  inkMid:  "#3C3C43",
  inkSoft: "#8E8E93",

  // Couleurs accent (statuts uniquement)
  red:    "#EF4444",
  blue:   "#3B82F6",
  amber:  "#F59E0B",
  purple: "#8B5CF6",
  slate:  "#64748B",

  // Séparateurs
  border: "#E5E5EA",

  // Rayons
  r: { xs: 6, sm: 10, md: 14, lg: 16, xl: 22, pill: 99 },

  // Polices
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// Ombre standardisée (cards)
const cardShadow = Platform.select({
  ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  android: { elevation: 2 },
  default: {},
});

// ✅ v9.4 — Ombre plus marquée, réservée à la carte solde du Hero
// (élément central de l'écran : doit "flotter" plus que les cartes du body)
const heroCardShadow = Platform.select({
  ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 20 },
  android: { elevation: 6 },
  default: {},
});

// ─── Helpers — 100 % inchangés ────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}
function fmtDate(d: string): string {
  const date = new Date(d), today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yest.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate), now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};

const TX_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  PAID:       { color: C.green,  bg: C.greenPale,  label: "Payé" },
  VALIDATED:  { color: C.green,  bg: C.greenPale,  label: "Validé" },
  PENDING:    { color: C.amber,  bg: C.amberBg,    label: "En cours" },
  PROCESSING: { color: C.blue,   bg: C.blueBg,     label: "Traitement" },
  CANCELLED:  { color: C.slate,  bg: C.slateLight, label: "Annulé" },
  FAILED:     { color: C.red,    bg: C.redBg,      label: "Échoué" },
};

const AVATAR_PALETTES = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColors(name: string) {
  return AVATAR_PALETTES[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTES.length];
}

// ─── Section Header ────────────────────────────────────────
function SectionHeader({
  title, action, onAction,
}: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={sh.row}>
      <Text style={[sh.title, { fontFamily: C.font.sans }]}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} hitSlop={10}>
          <Text style={[sh.link, { fontFamily: C.font.sans }]}>{action} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", color: C.ink },
  link:  { fontSize: 13, fontWeight: "600", color: C.green },
});

// ─── Quick Contact Chip ────────────────────────────────────
function ContactChip({
  name, phone, onPress,
}: { name: string; phone?: string; onPress: () => void }) {
  const initials = (name || "?").split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
  const pal = avatarColors(name || "?");
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={qc.chip} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
      >
        <View style={[qc.avatar, { backgroundColor: pal.bg }]}>
          <Text style={[qc.initials, { color: pal.text, fontFamily: C.font.serif }]}>{initials}</Text>
        </View>
        <Text style={[qc.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{name.split(" ")[0]}</Text>
        {/* badge envoi */}
        <View style={qc.badge}>
          <Ionicons name="paper-plane" size={9} color={C.green} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const qc = StyleSheet.create({
  chip:    { alignItems: "center", gap: 5, width: 66 },
  avatar:  { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: C.border },
  initials:{ fontSize: 17, fontWeight: "800" },
  name:    { fontSize: 11, fontWeight: "600", color: C.ink, textAlign: "center" },
  badge:   {
    position: "absolute", bottom: 24, right: 3,
    width: 17, height: 17, borderRadius: 9,
    backgroundColor: C.white,
    borderWidth: 1.5, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Action Item (BNP — carré arrondi vert) ────────────────
function ActionItem({
  icon, label, onPress,
}: { icon: string; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1, alignItems: "center", gap: 8 }}>
      <TouchableOpacity
        style={ai.box} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
      >
        <Ionicons name={icon as any} size={22} color={C.green} />
      </TouchableOpacity>
      <Text style={[ai.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </Animated.View>
  );
}
const ai = StyleSheet.create({
  box: {
    width: 58, height: 58, borderRadius: 15,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.greenPale,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  label: { fontSize: 11, fontWeight: "600", color: C.inkMid, textAlign: "center" },
});

// ─── Transaction Row ───────────────────────────────────────
function TxRow({ tx, userId }: { tx: any; userId?: string }) {
  const isOut = tx.senderId === userId;
  const accent = isOut ? C.red : C.green;
  const hasConversion = !isOut && tx.targetCurrency && tx.targetCurrency !== tx.currency && toNum(tx.receivedAmount) > 0;
  const displayAmount:   number = hasConversion ? toNum(tx.receivedAmount) : toNum(tx.amount);
  const displayCurrency: string = hasConversion ? (tx.targetCurrency as string) : (tx.currency as string);
  const name = isOut
    ? (tx.beneficiary?.fullName ?? tx.recipient?.firstName ?? "Bénéficiaire")
    : (tx.sender?.firstName ? `${tx.sender.firstName} ${tx.sender.lastName ?? ""}`.trim() : "Expéditeur");
  const st  = TX_STATUS[tx.status] ?? { color: C.slate, bg: C.slateLight, label: tx.status };
  const pal = avatarColors(name);
  return (
    <View style={tr.row}>
      <View style={[tr.avatar, { backgroundColor: pal.bg }]}>
        <Text style={[tr.avatarTxt, { color: pal.text, fontFamily: C.font.serif }]}>
          {(name[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[tr.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{name}</Text>
        <View style={tr.meta}>
          <Text style={[tr.date, { fontFamily: C.font.sans }]}>{fmtDate(tx.createdAt)}</Text>
          <View style={[tr.pill, { backgroundColor: st.bg }]}>
            <View style={[tr.dot, { backgroundColor: st.color }]} />
            <Text style={[tr.pillTxt, { color: st.color, fontFamily: C.font.sans }]}>{st.label}</Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[tr.amount, { color: accent, fontFamily: C.font.serif }]}>
          {isOut ? "−" : "+"}{fmt(displayAmount, displayCurrency)}
        </Text>
        <Text style={[tr.currency, { fontFamily: C.font.mono }]}>{displayCurrency}</Text>
      </View>
    </View>
  );
}
const tr = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  avatar:    { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 17, fontWeight: "800" },
  name:      { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 3 },
  meta:      { flexDirection: "row", alignItems: "center", gap: 7 },
  date:      { fontSize: 11, color: C.inkSoft, fontWeight: "500" },
  pill:      { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: C.r.pill },
  dot:       { width: 4, height: 4, borderRadius: C.r.pill },
  pillTxt:   { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  amount:    { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },
  currency:  { fontSize: 9, color: C.inkSoft, fontWeight: "600", marginTop: 2 },
});

// ─── Main ──────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [refreshing,  setRefreshing]  = useState(false);
  const [txs,         setTxs]         = useState<any[]>([]);
  const [loadingTxs,  setLoadingTxs]  = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [eurXofRate,  setEurXofRate]  = useState<number | null>(null);

  const heroAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const firstName = user?.firstName ?? "Client";

  // ── Données wallet ──
  const rawCountry      = ((user as any)?.country ?? "").trim().toUpperCase().substring(0, 2);
  const primaryCurrency = (user as any)?.primaryCurrency || COUNTRY_CURRENCY[rawCountry] || "XOF";
  const wallets         = (user as any)?.wallets ?? [];
  const mainWallet      = wallets.find((w: any) => w.currency === primaryCurrency)
    ?? wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance          = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reservedBalance  = toNum(mainWallet?.reservedBalance ?? 0);
  const availableBalance = balance - reservedBalance;

  // ── Stats mensuelles ──
  const monthTxs  = txs.filter((t) => isThisMonth(t.createdAt));
  const monthSent = monthTxs
    .filter((t) => t.senderId === user?.id && t.status === "PAID")
    .reduce((acc, t) => acc + toNum(t.amount), 0);
  const monthRecv = monthTxs
    .filter((t) => (t.recipientId === user?.id || (t.senderId !== user?.id && !t.beneficiaryId)) && t.status === "PAID")
    .reduce((acc, t) => {
      const hasConv = t.targetCurrency && t.targetCurrency !== t.currency && toNum(t.receivedAmount) > 0;
      return acc + (hasConv ? toNum(t.receivedAmount) : toNum(t.amount));
    }, 0);

  // ── Contacts récents ──
  const recentContacts = (() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; phone?: string; beneficiaryId?: string }> = [];
    for (const tx of txs) {
      if (tx.senderId !== user?.id) continue;
      const name  = tx.beneficiary?.fullName ?? tx.recipient?.firstName;
      const phone = tx.beneficiary?.phone ?? tx.recipient?.phone;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name, phone, beneficiaryId: tx.beneficiaryId });
      if (result.length >= 4) break;
    }
    return result;
  })();

  // ── loadData ──
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [, rawTxs, rates] = await Promise.allSettled([
        refreshUser(),
        api.getTransactions(),
        api.getExchangeRates(),
      ]);
      if (rawTxs.status === "fulfilled") {
        const safe = Array.isArray(rawTxs.value) ? rawTxs.value : [];
        setTxs(safe.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 10));
      }
      if (rates.status === "fulfilled" && Array.isArray(rates.value)) {
        const pair = rates.value.find((r: any) => r.pair === "EUR/XOF" || r.pair === "EUR_XOF");
        if (pair?.rate) setEurXofRate(Number(pair.rate));
      }
    } catch {}
    finally { setRefreshing(false); setLoadingTxs(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.stagger(60, [
      Animated.spring(heroAnim,    { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 3 }),
    ]).start();
  }, [loadData]));

  const recentTxs = txs.slice(0, 5);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.pageBg} />

      {/* ══════════════════════════════════════════════════
          HERO — fond gris (fondu avec le body), sans vert
      ══════════════════════════════════════════════════ */}
      <Animated.View style={{
        opacity: heroAnim,
        transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }}>
        <View style={[s.hero, { paddingTop: insets.top + 8 }]}>

          {/* Barre du haut */}
          <View style={s.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={[s.greeting, { fontFamily: C.font.sans }]}>Bon retour 👋</Text>
              <Text style={[s.heroName, { fontFamily: C.font.sans }]} numberOfLines={1}>{firstName}</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/notifications")}>
              <Ionicons name="notifications-outline" size={19} color={C.inkMid} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={s.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
              <Text style={[s.avatarTxt, { fontFamily: C.font.sans }]}>{(firstName[0] ?? "C").toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {/* ✅ v9.4 — Carte solde flottante (détachée du Hero, ombre marquée) */}
          <View style={s.balanceCard}>
            {/* ✅ v9.7 — Filigrane portefeuille : icône SEULE, sans conteneur/
                fond derrière (le carré marron de la v9.6 peignait le contenant,
                pas l'icône). Icône pleine "wallet" en brun plein #8E562E. */}
            <Ionicons
              name="wallet"
              size={56}
              color="#8E562E"
              style={s.balanceWatermark}
            />

            <View style={s.balHeaderRow}>
              <Text style={[s.balLabel, { fontFamily: C.font.sans }]}>SOLDE DISPONIBLE</Text>
              <TouchableOpacity onPress={() => setShowBalance(!showBalance)} hitSlop={8}>
                <Ionicons
                  name={showBalance ? "eye-outline" : "eye-off-outline"}
                  size={13}
                  color={C.inkSoft}
                />
              </TouchableOpacity>
              <View style={s.onlinePill}>
                <View style={s.onlineDot} />
                <Text style={[s.onlineTxt, { fontFamily: C.font.sans }]}>En ligne</Text>
              </View>
            </View>

            {/* Devise · Montant sur la même ligne */}
            <View style={s.balAmountRow}>
              {showBalance && (
                <Text style={[s.balCurPrefix, { fontFamily: C.font.sans }]}>{primaryCurrency}</Text>
              )}
              <Text
                style={[s.balAmount, { fontFamily: C.font.serif }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                {showBalance ? fmt(availableBalance, primaryCurrency) : "••••••"}
              </Text>
            </View>

            {/* Bandeau taux, réutilise eurXofRate déjà fetché par loadData() */}
            {eurXofRate != null && (
              <TouchableOpacity
                style={s.rateRow}
                onPress={() => router.push("/(tabs)/rates")}
                activeOpacity={0.7}
              >
                <Text style={[s.rateTxt, { fontFamily: C.font.sans }]} numberOfLines={1}>
                  {primaryCurrency} → XOF · {fmt(eurXofRate, "XOF")} · Envoi wallet 0 frais
                </Text>
                <Ionicons name="create-outline" size={12} color={C.inkSoft} />
              </TouchableOpacity>
            )}

            {reservedBalance > 0 && (
              <Text style={[s.balReserved, { fontFamily: C.font.sans }]}>
                Réservé {fmt(reservedBalance, primaryCurrency)} {primaryCurrency}
              </Text>
            )}
          </View>

        </View>
      </Animated.View>

      {/* ══════════════════════════════════════════════════
          BODY — fond gris neutre, cartes blanches
      ══════════════════════════════════════════════════ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.body, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.green} />
        }
      >
        <Animated.View style={[s.bodyInner, {
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}>

          {/* ── CTA principal ── */}
          <TouchableOpacity
            style={s.mainCta}
            onPress={() => router.push("/(tabs)/send")}
            activeOpacity={0.88}
          >
            <View style={s.mainCtaLeft}>
              <View style={s.mainCtaIcon}>
                <Ionicons name="paper-plane-outline" size={22} color={C.green} />
              </View>
              <View>
                <Text style={[s.mainCtaTitle, { fontFamily: C.font.sans }]}>Envoyer de l'argent</Text>
                <Text style={[s.mainCtaSub,   { fontFamily: C.font.sans }]}>Wallet · Cash · Virement · 0 frais wallet</Text>
              </View>
            </View>
            <View style={s.mainCtaArrow}>
              <Ionicons name="arrow-forward" size={16} color={C.white} />
            </View>
          </TouchableOpacity>

          {/* ── Actions rapides (style BNP) ── */}
          <View style={s.card}>
            <SectionHeader title="Actions rapides" />
            <View style={s.actionsRow}>
              <ActionItem icon="people-outline"  label="Contacts"   onPress={() => router.push("/(tabs)/beneficiaries")} />
              <ActionItem icon="repeat-outline"  label="Taux"       onPress={() => router.push("/(tabs)/rates")} />
              <ActionItem icon="qr-code-outline" label="QR Code"    onPress={() => router.push("/(tabs)/qr")} />
              <ActionItem icon="time-outline"    label="Historique" onPress={() => router.push("/(tabs)/transactions")} />
            </View>
          </View>

          {/* ── Envoi rapide (contacts récents) ── */}
          {recentContacts.length > 0 && (
            <View style={s.card}>
              <SectionHeader title="Envoi rapide" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {recentContacts.map((c, i) => (
                  <ContactChip
                    key={i}
                    name={c.name}
                    phone={c.phone}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/send",
                        params: c.beneficiaryId
                          ? { beneficiaryId: c.beneficiaryId }
                          : { phone: c.phone, name: c.name },
                      })
                    }
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Stats du mois ── */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { borderLeftColor: C.red }]}>
              <Text style={[s.statLabel, { fontFamily: C.font.sans }]}>↑ ENVOYÉ CE MOIS</Text>
              <Text style={[s.statVal,   { fontFamily: C.font.sans }]}>{fmt(monthSent, primaryCurrency)}</Text>
              <Text style={[s.statCur,   { fontFamily: C.font.mono }]}>{primaryCurrency}</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: C.green }]}>
              <Text style={[s.statLabel, { fontFamily: C.font.sans }]}>↓ REÇU CE MOIS</Text>
              <Text style={[s.statVal,   { fontFamily: C.font.sans }]}>{fmt(monthRecv, primaryCurrency)}</Text>
              <Text style={[s.statCur,   { fontFamily: C.font.mono }]}>{primaryCurrency}</Text>
            </View>
          </View>

          {/* ── Transactions récentes ── */}
          <View style={s.card}>
            <SectionHeader
              title="Transactions récentes"
              action="Voir tout"
              onAction={() => router.push("/(tabs)/transactions")}
            />
            {loadingTxs ? (
              <View style={s.emptyBox}>
                <ActivityIndicator color={C.green} />
              </View>
            ) : recentTxs.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="receipt-outline" size={36} color={C.inkSoft} />
                <Text style={[s.emptyTxt, { fontFamily: C.font.sans }]}>Aucune transaction récente</Text>
              </View>
            ) : (
              recentTxs.map((tx) => <TxRow key={tx.id} tx={tx} userId={user?.id} />)
            )}
          </View>

          <View style={{ height: 8 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({

  // ── Structure ──
  // ✅ v9.4 — fond gris (au lieu de blanc) pour fondre le Hero dans le body
  safe:   { flex: 1, backgroundColor: C.pageBg },
  scroll: { flex: 1, backgroundColor: C.pageBg },
  body:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  bodyInner: { gap: 12 },

  // ── Hero — ✅ v9.4 : fond gris (était blanc en v9.3, vert en v9.0-9.2) ──
  // ✅ v9.5 : paddingTop n'est plus fixe — voir insets.top + 8 appliqué
  // inline sur la balise (FIX recouvrement par la barre de statut système,
  // surtout visible sur Android où SafeAreaView de "react-native" ne
  // réserve pas d'espace pour la status bar, contrairement à iOS).
  // ✅ v9.5 fix : paddingHorizontal 20 → 10 pour agrandir la carte solde
  // ✅ v9.6 fix : paddingHorizontal 10 → 6
  // ✅ v9.7 fix : paddingHorizontal 6 → 2, pour coller au rectangle
  // quasi bord-à-bord tracé sur le mockup
  hero: {
    backgroundColor: C.pageBg,
    paddingHorizontal: 2,
    paddingBottom: 6,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  greeting: {
    fontSize: 11, fontWeight: "500",
    color: C.inkSoft,
    marginBottom: 1,
  },
  heroName: {
    fontSize: 19, fontWeight: "800",
    color: C.ink, letterSpacing: -0.3,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  notifDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "#F59E0B",
    borderWidth: 1.5, borderColor: C.white,
  },
  // ✅ v9.4 — encre anthracite au lieu du vert (plus aucune couleur de marque dans le Hero)
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.ink,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  avatarTxt: { fontSize: 14, fontWeight: "800", color: C.white },

  // ✅ v9.5 : blanc pur sans border (ombre seule définit les bords)
  balanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: C.r.xl,
    padding: 18,
    marginBottom: 4,
    position: "relative",
    ...heroCardShadow,
  },
  // ✅ v9.7 — icône seule, sans conteneur/fond derrière (cf. note plus haut).
  // Juste un positionnement absolu dans le coin de la carte, comme avant.
  balanceWatermark: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },

  // Balance
  balHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  balLabel: {
    fontSize: 10, fontWeight: "700",
    color: C.inkSoft,
    letterSpacing: 0.5,
  },
  // ✅ v9.4 — bleu (token déjà existant pour le statut "Traitement") au lieu du vert
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.blueBg,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: C.r.pill,
    marginLeft: "auto",
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue },
  onlineTxt: { fontSize: 10, color: C.blue, fontWeight: "700" },
  balAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 3 },
  // ✅ v9.4 — encre sourdine au lieu du vert
  balCurPrefix: { fontSize: 16, fontWeight: "700", color: C.inkSoft, letterSpacing: 0.5 },
  balAmount: {
    fontSize: 32, fontWeight: "800",
    color: C.ink, letterSpacing: -0.8,
  },
  // Bandeau taux sous le solde
  rateRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8,
  },
  rateTxt: { fontSize: 12, color: C.inkSoft, fontWeight: "600", flexShrink: 1 },
  balReserved: { fontSize: 10, color: C.inkSoft, marginTop: 4 },

  // ── CTA principal — blanc ombré ──
  mainCta: {
    backgroundColor: C.white,
    borderRadius: C.r.lg,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  mainCtaLeft:  { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  mainCtaIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.greenPale,
    justifyContent: "center", alignItems: "center",
  },
  mainCtaTitle: { fontSize: 15, fontWeight: "800", color: C.ink, marginBottom: 2 },
  mainCtaSub:   { fontSize: 11, color: C.inkSoft },
  mainCtaArrow: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.green,
    justifyContent: "center", alignItems: "center",
  },

  // ── Card générique ──
  card: {
    backgroundColor: C.white,
    borderRadius: C.r.lg,
    padding: 16,
    ...cardShadow,
  },
  actionsRow: { flexDirection: "row", justifyContent: "space-around", paddingTop: 2 },

  // ── Stats ──
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: C.white,
    borderRadius: C.r.md,
    padding: 12,
    borderLeftWidth: 3,
    ...cardShadow,
  },
  statLabel: { fontSize: 8,  fontWeight: "700", color: C.inkSoft, letterSpacing: 0.4, marginBottom: 5 },
  statVal:   { fontSize: 17, fontWeight: "800", color: C.ink,     letterSpacing: -0.5 },
  statCur:   { fontSize: 9,  fontWeight: "600", color: C.inkSoft, marginTop: 2 },

  // ── États vide / chargement ──
  emptyBox: { paddingVertical: 28, alignItems: "center", gap: 10 },
  emptyTxt: { fontSize: 13, color: C.inkSoft, fontWeight: "500" },
});