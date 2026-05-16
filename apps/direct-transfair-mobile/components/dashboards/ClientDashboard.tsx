// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// CLIENT DASHBOARD v5.0 — Direct Transf'air
// Design: Thème clair · Vert #059669 · Style capture référence
// ✅ Devise locale uniquement (user.primaryCurrency)
// ✅ Wallet personnel affiché
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Platform, Animated,
  useWindowDimensions, ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  // Vert primaire (remplace le bleu de la capture)
  green:        "#059669",
  greenDark:    "#047857",
  greenLight:   "#F0FDF4",
  greenBorder:  "#A7F3D0",
  greenMid:     "#10B981",
  greenPale:    "#ECFDF5",

  // Hero vert (remplace le hero violet/bleu de la capture)
  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow1:    "rgba(255,255,255,0.08)",
  heroGlow2:    "rgba(255,255,255,0.05)",

  // Fond page — même lavande très clair que la capture
  pageBg:       "#F0FDF8",
  white:        "#FFFFFF",
  cardBorder:   "#D1FAE5",
  inputBg:      "#F8FFFC",

  // Texte
  ink:          "#0D2B1F",
  inkMid:       "#1F5C3A",
  inkSoft:      "#6B9E85",

  // Sémantiques
  red:          "#EF4444",
  redBg:        "#FEF2F2",
  redBorder:    "#FECACA",

  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",

  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  amberBorder:  "#FDE68A",

  purple:       "#8B5CF6",
  purpleBg:     "#F5F3FF",

  // Neutre
  slate:        "#64748B",
  slateLight:   "#F1F5F9",
  slateBorder:  "#E2E8F0",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Helpers ────────────────────────────────────────────
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

const TX_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  PAID:       { color: C.green,  bg: C.greenPale, label: "Payé" },
  VALIDATED:  { color: C.green,  bg: C.greenPale, label: "Validé" },
  PENDING:    { color: C.amber,  bg: C.amberBg,   label: "En cours" },
  PROCESSING: { color: C.blue,   bg: C.blueBg,    label: "Traitement" },
  CANCELLED:  { color: C.slate,  bg: C.slateLight, label: "Annulé" },
  FAILED:     { color: C.red,    bg: C.redBg,     label: "Échoué" },
  REFUNDED:   { color: C.purple, bg: C.purpleBg,  label: "Remboursé" },
};

// ─── Transaction Row ─────────────────────────────────────
// Style exact de la capture : ligne épurée avec avatar initiale,
// nom + date + pill statut, montant à droite
function TxRow({ tx, userId }: { tx: any; userId?: string }) {
  const isOut = tx.senderId === userId;
  const amount = toNum(tx.amount);
  const accent = isOut ? C.red : C.green;
  const name   = isOut
    ? (tx.beneficiary?.fullName ?? tx.recipient?.firstName ?? "Bénéficiaire")
    : (tx.sender?.firstName ?? "Expéditeur");
  const st = TX_STATUS[tx.status] ?? { color: C.slate, bg: C.slateLight, label: tx.status };

  return (
    <View style={tx_.row}>
      {/* Avatar initiale — style glassmorphism léger */}
      <View style={[tx_.avatar, { backgroundColor: `${accent}15` }]}>
        <Text style={[tx_.avatarTxt, { color: accent, fontFamily: C.font.serif }]}>
          {(name[0] ?? "?").toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[tx_.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{name}</Text>
        <View style={tx_.meta}>
          <Text style={[tx_.date, { fontFamily: C.font.sans }]}>{fmtDate(tx.createdAt)}</Text>
          <View style={[tx_.pill, { backgroundColor: st.bg }]}>
            <View style={[tx_.pillDot, { backgroundColor: st.color }]} />
            <Text style={[tx_.pillTxt, { color: st.color, fontFamily: C.font.sans }]}>{st.label}</Text>
          </View>
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[tx_.amount, { color: accent, fontFamily: C.font.serif }]}>
          {isOut ? "−" : "+"}{fmt(amount, tx.currency)}
        </Text>
        <Text style={[tx_.currency, { fontFamily: C.font.mono }]}>{tx.currency}</Text>
      </View>
    </View>
  );
}
const tx_ = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0FDF4" },
  avatar:    { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 18, fontWeight: "900" },
  name:      { fontSize: 14, fontWeight: "700", color: C.ink, marginBottom: 4 },
  meta:      { flexDirection: "row", alignItems: "center", gap: 8 },
  date:      { fontSize: 11, color: C.inkSoft, fontWeight: "600" },
  pill:      { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: C.r.pill },
  pillDot:   { width: 4, height: 4, borderRadius: C.r.pill },
  pillTxt:   { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  amount:    { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  currency:  { fontSize: 10, color: C.inkSoft, fontWeight: "700", marginTop: 2 },
});

// ─── Action Button ── (style de la capture : rond avec icône)
function ActionBtn({ icon, label, color, bg, onPress }: {
  icon: string; label: string; color: string; bg: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ alignItems: "center", gap: 8, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[ab_.iconBox, { backgroundColor: bg }]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <Ionicons name={icon as any} size={22} color={color} />
      </TouchableOpacity>
      <Text style={[ab_.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </Animated.View>
  );
}
const ab_ = StyleSheet.create({
  iconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  label:   { fontSize: 11, fontWeight: "700", color: C.inkSoft, textAlign: "center" },
});

// ─── Stat Chip ───────────────────────────────────────────
function StatChip({ icon, value, label, color, bg }: any) {
  return (
    <View style={sc_.chip}>
      <View style={[sc_.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={[sc_.val, { color, fontFamily: C.font.mono }]}>{value}</Text>
      <Text style={[sc_.lbl, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const sc_ = StyleSheet.create({
  chip:   { flex: 1, alignItems: "center", gap: 5, paddingVertical: 14 },
  iconBox:{ width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  val:    { fontSize: 16, fontWeight: "900" },
  lbl:    { fontSize: 10, color: C.inkSoft, fontWeight: "700", letterSpacing: 0.4, textAlign: "center" },
});

// ─── Main ────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing,  setRefreshing]  = useState(false);
  const [txs,         setTxs]         = useState<any[]>([]);
  const [loadingTxs,  setLoadingTxs]  = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const heroAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const firstName = user?.firstName ?? "Client";

  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
    TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
    IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR", AT: "EUR", FI: "EUR",
    IE: "EUR", LU: "EUR", GR: "EUR", GB: "GBP", US: "USD", SV: "USD",
    GG: "GBP", JE: "GBP",
  };
  const rawCountry      = ((user as any)?.country ?? "").trim().toUpperCase().substring(0, 2);
  const derivedCurrency = rawCountry ? (COUNTRY_CURRENCY_MAP[rawCountry] ?? "XOF") : "XOF";
  const primaryCurrency = (user as any)?.primaryCurrency || derivedCurrency;

  const wallets          = (user as any)?.wallets ?? [];
  const mainWallet       = wallets.find((w: any) => w.currency === primaryCurrency)
    ?? wallets.find((w: any) => w.isDefault)
    ?? wallets[0];
  const balance          = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reservedBalance  = toNum(mainWallet?.reservedBalance ?? 0);
  const availableBalance = balance - reservedBalance;

  const sentCount    = txs.filter((t) => t.senderId === user?.id).length;
  const totalSent    = txs.filter((t) => t.senderId === user?.id && t.status === "PAID").reduce((acc, t) => acc + toNum(t.amount), 0);
  const successCount = txs.filter((t) => t.status === "PAID").length;

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      const raw  = await api.getTransactions();
      const safe = Array.isArray(raw) ? raw : [];
      setTxs(safe.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8));
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); setLoadingTxs(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.stagger(80, [
      Animated.spring(heroAnim,    { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }),
    ]).start();
  }, [loadData]));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ══ HERO VERT ══
          Reproduit exactement le hero de la capture (couleur unie arrondie en bas)
          mais en VERT au lieu du bleu/violet */}
      <Animated.View style={[s.hero, {
        opacity: heroAnim,
        transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        {/* Décors lumineux — même que la capture */}
        <View style={s.glow1} />
        <View style={s.glow2} />
        <View style={s.glow3} />

        {/* Top bar */}
        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={[s.greeting, { fontFamily: C.font.sans }]}>Bon retour 👋</Text>
            <Text style={[s.heroName, { fontFamily: C.font.serif }]} numberOfLines={1}>{firstName}</Text>
          </View>
          <View style={s.topActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/notifications")}>
              <Ionicons name="notifications-outline" size={17} color={C.white} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={s.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
              <Text style={[s.avatarTxt, { fontFamily: C.font.serif }]}>
                {(firstName[0] ?? "C").toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Balance Card — flottante sur le hero, fond blanc
            Identique à la capture : grande card blanche qui déborde sur le fond coloré */}
        <View style={s.balCard}>
          <View style={s.balTop}>
            <View style={{ flex: 1 }}>
              <View style={s.balLabelRow}>
                <Text style={[s.balLabel, { fontFamily: C.font.sans }]}>
                  SOLDE DISPONIBLE · {primaryCurrency}
                </Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} hitSlop={8}>
                  <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={14} color={C.inkSoft} />
                </TouchableOpacity>
              </View>
              <Text style={[s.balAmount, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                {showBalance ? fmt(availableBalance, primaryCurrency) : "••••••"}
              </Text>
              <Text style={[s.balCur, { fontFamily: C.font.sans }]}>{primaryCurrency}</Text>
            </View>
            {/* Online pill — même que la capture */}
            <View style={s.onlinePill}>
              <View style={s.onlineDot} />
              <Text style={[s.onlineTxt, { fontFamily: C.font.sans }]}>En ligne</Text>
            </View>
          </View>

          {/* Barre réservé/disponible */}
          {balance > 0 && (
            <>
              <View style={s.progBg}>
                <View style={[s.progFill, { width: `${Math.min((availableBalance / balance) * 100, 100)}%` as any }]} />
              </View>
              <View style={s.balFooter}>
                <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                  Disponible <Text style={s.balFootVal}>{fmt(availableBalance, primaryCurrency)} {primaryCurrency}</Text>
                </Text>
                {reservedBalance > 0 && (
                  <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                    Réservé <Text style={[s.balFootVal, { color: "#A7F3D0" }]}>{fmt(reservedBalance, primaryCurrency)}</Text>
                  </Text>
                )}
              </View>
            </>
          )}

          {/* CTA buttons dans la card — style de la capture */}
          <View style={s.balBtns}>
            <TouchableOpacity style={s.balBtnPrimary} onPress={() => router.push("/(tabs)/send")} activeOpacity={0.88}>
              <Ionicons name="paper-plane-outline" size={15} color={C.white} />
              <Text style={[s.balBtnPrimaryTxt, { fontFamily: C.font.sans }]}>Envoyer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.balBtnSecondary} onPress={() => router.push("/(tabs)/transactions")} activeOpacity={0.88}>
              <Ionicons name="list-outline" size={15} color={C.green} />
              <Text style={[s.balBtnSecondaryTxt, { fontFamily: C.font.sans }]}>Historique</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ══ BODY ══ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.body, isDesktop && { maxWidth: 960, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.green} />}
      >
        <Animated.View style={{
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        }}>

          {/* ── Stats strip — même que la capture : 3 chips en ligne ── */}
          <View style={s.statsCard}>
            <StatChip icon="paper-plane-outline" value={String(sentCount)} label="Envois" color={C.green} bg={C.greenPale} />
            <View style={s.statsDivider} />
            <StatChip
              icon="cash-outline"
              value={totalSent > 0 ? `${fmt(Math.round(totalSent / 1000))}K` : "—"}
              label="Vol. envoyé"
              color={C.blue}
              bg={C.blueBg}
            />
            <View style={s.statsDivider} />
            <StatChip icon="checkmark-circle-outline" value={successCount > 0 ? String(successCount) : "—"} label="Réussis" color={C.amber} bg={C.amberBg} />
          </View>

          {/* ── Actions rapides — style de la capture : icônes rondes en ligne ── */}
          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: C.green }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>ACTIONS RAPIDES</Text>
          </View>
          <View style={s.actionsRow}>
            <ActionBtn icon="paper-plane-outline" label="Envoyer"   color={C.green}  bg={C.greenPale}  onPress={() => router.push("/(tabs)/send")} />
            <ActionBtn icon="people-outline"      label="Contacts"  color={C.blue}   bg={C.blueBg}     onPress={() => router.push("/(tabs)/beneficiaries")} />
            <ActionBtn icon="qr-code-outline"     label="QR Code"   color={C.amber}  bg={C.amberBg}    onPress={() => router.push("/(tabs)/qr")} />
            <ActionBtn icon="card-outline"        label="Recharger" color={C.purple} bg={C.purpleBg}   onPress={() => router.push("/topup")} />
          </View>

          {/* ── Promo Banner — même structure que la capture ── */}
          <TouchableOpacity activeOpacity={0.88} onPress={() => router.push("/(tabs)/send")}>
            <View style={s.promoCard}>
              <View style={s.promoLeft}>
                <View style={s.promoIconBox}>
                  <Text style={{ fontSize: 22 }}>🎁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.promoTitle, { fontFamily: C.font.sans }]}>Transferts gratuits ce week-end</Text>
                  <Text style={[s.promoSub,   { fontFamily: C.font.sans }]}>0 frais vers toutes les destinations</Text>
                </View>
              </View>
              <View style={[s.promoArrow, { backgroundColor: C.greenPale }]}>
                <Ionicons name="arrow-forward" size={14} color={C.green} />
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Transactions récentes ── */}
          <View style={[s.secRow, { marginTop: 8 }]}>
            <View style={[s.secDot, { backgroundColor: C.blue }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>TRANSACTIONS RÉCENTES</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")} style={s.seeAll}>
              <Text style={[s.seeAllTxt, { fontFamily: C.font.sans }]}>Voir tout</Text>
              <Ionicons name="chevron-forward" size={13} color={C.green} />
            </TouchableOpacity>
          </View>

          <View style={s.txCard}>
            {loadingTxs && !refreshing ? (
              <ActivityIndicator color={C.green} style={{ marginVertical: 28 }} />
            ) : txs.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="swap-horizontal-outline" size={28} color={C.inkSoft} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: C.font.sans }]}>Aucune transaction</Text>
                <Text style={[s.emptySub,   { fontFamily: C.font.sans }]}>Vos envois apparaîtront ici</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/send")}>
                  <Text style={[s.emptyBtnTxt, { fontFamily: C.font.sans }]}>Faire un transfert →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {txs.map((tx) => <TxRow key={tx.id} tx={tx} userId={user?.id} />)}
                <TouchableOpacity style={s.viewMore} onPress={() => router.push("/(tabs)/transactions")}>
                  <Text style={[s.viewMoreTxt, { fontFamily: C.font.sans }]}>Voir toutes les transactions</Text>
                  <Ionicons name="arrow-forward" size={13} color={C.green} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Badge sécurité */}
          <View style={s.secBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color={C.green} />
            <Text style={[s.secBadgeTxt, { fontFamily: C.font.sans }]}>Compte sécurisé · Direct Transf'air™</Text>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // ── Hero ──
  hero: {
    backgroundColor: C.green,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 14,
    paddingBottom: 28,
    overflow: "hidden",
    zIndex: 10,
  },
  glow1: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: C.heroGlow1, top: -80,  right: -60 },
  glow2: { position: "absolute", width: 120, height: 120, borderRadius: 60,  backgroundColor: C.heroGlow2, bottom: 20, left: -40 },
  glow3: { position: "absolute", width: 80,  height: 80,  borderRadius: 40,  backgroundColor: C.heroGlow1, top: 10, left: "40%" as any },

  topBar: { flexDirection: "row", alignItems: "flex-start", marginBottom: 22 },
  greeting: { color: C.heroDim, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  heroName:  { color: C.white, fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  topActions: { flexDirection: "row", gap: 10, paddingTop: 2 },
  iconBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  notifDot:  { position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: C.r.pill, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.green },
  avatarBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.heroGlass, borderWidth: 1.5, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt: { color: C.white, fontSize: 16, fontWeight: "800" },

  // Balance Card
  balCard: {
    backgroundColor: C.white, borderRadius: C.r.xl, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  balTop:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  balLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  balLabel:    { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, textTransform: "uppercase" },
  balAmount:   { fontSize: 34, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  balCur:      { fontSize: 12, fontWeight: "800", color: C.green, marginTop: 3 },
  onlinePill:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, borderWidth: 1, borderColor: C.greenBorder, borderRadius: C.r.pill, paddingHorizontal: 10, paddingVertical: 5 },
  onlineDot:   { width: 6, height: 6, borderRadius: C.r.pill, backgroundColor: C.green },
  onlineTxt:   { color: C.greenDark, fontSize: 10, fontWeight: "700" },
  progBg:      { height: 4, backgroundColor: C.greenLight, borderRadius: C.r.pill, overflow: "hidden", marginBottom: 7 },
  progFill:    { height: 4, backgroundColor: C.green, borderRadius: C.r.pill },
  balFooter:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  balFootLbl:  { fontSize: 10, fontWeight: "700", color: C.inkSoft },
  balFootVal:  { color: C.green, fontWeight: "900" },

  // CTA buttons dans la balance card — identiques à la capture
  balBtns:           { flexDirection: "row", gap: 10, marginTop: 4 },
  balBtnPrimary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.green, borderRadius: C.r.md, paddingVertical: 13,
  },
  balBtnPrimaryTxt:   { color: C.white, fontWeight: "800", fontSize: 13 },
  balBtnSecondary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.greenLight, borderRadius: C.r.md, paddingVertical: 13,
    borderWidth: 1, borderColor: C.greenBorder,
  },
  balBtnSecondaryTxt: { color: C.green, fontWeight: "800", fontSize: 13 },

  // Body
  body: { paddingHorizontal: 18, paddingTop: 20 },

  // Stats
  statsCard: {
    flexDirection: "row", backgroundColor: C.white,
    borderRadius: C.r.lg, marginBottom: 20,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statsDivider: { width: 1, backgroundColor: C.cardBorder, marginVertical: 12 },

  // Section headers
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { flex: 1, fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllTxt: { fontSize: 12, fontWeight: "700", color: C.green },

  // Actions
  actionsRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },

  // Promo card — glassmorphism léger vert comme la capture
  promoCard: {
    backgroundColor: C.greenDark,
    borderRadius: C.r.lg, padding: 16,
    flexDirection: "row", alignItems: "center",
    marginBottom: 20,
    shadowColor: C.green, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  promoLeft:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  promoIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  promoTitle:   { color: C.white, fontSize: 13, fontWeight: "800", marginBottom: 3 },
  promoSub:     { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "600" },
  promoArrow:   { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  // TX card
  txCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
    marginBottom: 16,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },

  // Empty state
  empty:       { alignItems: "center", paddingVertical: 36, gap: 8 },
  emptyIconBox:{ width: 60, height: 60, borderRadius: 18, backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:  { color: C.ink, fontSize: 16, fontWeight: "700" },
  emptySub:    { color: C.inkSoft, fontSize: 12, fontWeight: "600" },
  emptyBtn:    { marginTop: 8, backgroundColor: C.greenLight, borderRadius: C.r.md, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: C.greenBorder },
  emptyBtnTxt: { color: C.green, fontWeight: "800", fontSize: 13 },

  viewMore:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.greenLight, marginTop: 4 },
  viewMoreTxt: { color: C.green, fontSize: 13, fontWeight: "700" },

  // Sécurité badge
  secBadge:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  secBadgeTxt: { color: C.inkSoft, fontSize: 11, fontWeight: "600" },
});