// apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
// =========================================================
// ADMIN COMMISSIONS v6.0 — Direct Transf'air
// ✅ v5.0 conservé : thème clair, StatCard, hero card
//
// ✅ v6.0 : 🚨 REFONTE COMPLÈTE — page unique, source LedgerEntry
//
//   PROBLÈMES RÉSOLUS (juillet 2026) :
//   1. Cet écran + admin/commissions/history.tsx + l'ancien
//      admin/commissions.tsx appelaient tous GET /commissions/history,
//      qui exige user.agencyId — or un COMPANY_ADMIN n'en a jamais
//      (agency est réservé aux AGENT). Cette route renvoyait donc
//      systématiquement 403 Forbidden pour ce rôle : ces 3 écrans
//      n'ont jamais pu charger la moindre donnée pour un admin société.
//   2. Même quand la route répondait, elle lisait item.breakdown.*
//      (sender/payer/platform), un champ que le backend n'a jamais
//      renvoyé — stats.platformNet valait donc structurellement
//      toujours 0, indépendamment du point 1.
//   3. Le calcul lui-même recalculait la commission depuis
//      tx.fees × CommissionConfig ACTUELLE plutôt que de lire ce qui
//      avait réellement été crédité — voir commissions.service.ts v5.0.
//
//   CORRECTIF : appelle GET /commissions/ledger/company (nouvelle
//   route dédiée COMPANY_ADMIN, sans exigence agencyId). Cette PAGE
//   UNIQUE remplace admin/commissions.tsx ET
//   admin/commissions/history.tsx — à supprimer (voir message
//   accompagnant ce fichier).
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, SafeAreaView, ScrollView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";

const C = {
  pageBg:    "#F4F6FB",
  white:     "#FFFFFF",
  border:    "#E4E9F2",
  borderMd:  "#CDD5E0",
  ink:       "#0F172A",
  inkSub:    "#64748B",
  inkMuted:  "#94A3B8",
  blue:      "#1956F0", blueLt:  "#EEF2FF", blueMd:  "#C7D5FF",
  green:     "#16A34A", greenLt: "#DCFCE7", greenMd: "#A7F3D0",
  amber:     "#D97706", amberLt: "#FEF3C7",
  red:       "#DC2626", redLt:   "#FEE2E2",
  violet:    "#7C3AED", violetLt:"#EDE9FE",
  teal:      "#0F766E", tealLt:  "#CCFBF1",
  r: { sm: 8, md: 12, lg: 16, xl: 20, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

const PERIODS = [
  { key: "day",     label: "Aujourd'hui" },
  { key: "week",    label: "7 Jours" },
  { key: "month",   label: "Ce Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year",    label: "Année" },
];

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}

type CurrencyTotal = { currency: string; total: number };
type LedgerEntryDto = {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  description: string | null;
  transactionRef: string | null;
  origin: string;
  scope: "platform" | "agency";
};
type AgencySummary = { agencyId: string; name: string; count: number; totalsByCurrency: CurrencyTotal[] };
type CompanyLedgerResponse = {
  platform: { totalsByCurrency: CurrencyTotal[]; count: number };
  agencies: AgencySummary[];
  entries: LedgerEntryDto[];
};

function readableLabel(description: string | null): string {
  if (!description) return "Commission";
  if (description.startsWith("Commission paiement"))   return "Retrait client (agence payeuse)";
  if (description.startsWith("Commission envoi"))       return "Envoi (agence d'origine)";
  if (description.startsWith("Commission plateforme"))  return "Part plateforme";
  return description;
}

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ label, value, icon, color, bg }: {
  label: string; value: string; icon: string; color: string; bg: string;
}) {
  return (
    <View style={[st.card, { borderTopColor: color }]}>
      <View style={[st.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[st.value, { color, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[st.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  card:    { flex: 1, backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, alignItems: "center", borderWidth: 1, borderTopWidth: 3, borderColor: C.border, gap: 4, shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  value:   { fontSize: 20, fontWeight: "800" },
  label:   { fontSize: 9, fontWeight: "900", color: C.inkMuted, letterSpacing: 0.8, textAlign: "center", textTransform: "uppercase" },
});

// ─── Agency Row ───────────────────────────────────────────
function AgencyRow({ agency }: { agency: AgencySummary }) {
  return (
    <View style={ar.row}>
      <View style={ar.iconBox}>
        <Ionicons name="storefront-outline" size={16} color={C.teal} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ar.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{agency.name}</Text>
        <Text style={[ar.count, { fontFamily: C.font.sans }]}>{agency.count} crédit{agency.count > 1 ? "s" : ""}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        {agency.totalsByCurrency.length > 0
          ? agency.totalsByCurrency.map((t) => (
              <Text key={t.currency} style={[ar.amount, { fontFamily: C.font.mono }]}>
                +{fmt(t.total)} {t.currency}
              </Text>
            ))
          : <Text style={[ar.amount, { fontFamily: C.font.mono, color: C.inkMuted }]}>—</Text>
        }
      </View>
    </View>
  );
}
const ar = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  iconBox:{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.tealLt, justifyContent: "center", alignItems: "center" },
  name:   { color: C.ink, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  count:  { color: C.inkMuted, fontSize: 10, fontWeight: "600" },
  amount: { color: C.teal, fontSize: 13, fontWeight: "800" },
});

// ─── Commission Row (détail) ─────────────────────────────
function CommissionRow({ item }: { item: LedgerEntryDto }) {
  const isPlatform   = item.scope === "platform";
  const accentColor  = isPlatform ? C.blue : C.teal;
  const accentBg      = isPlatform ? C.blueLt : C.tealLt;
  return (
    <View style={cr.row}>
      <View style={cr.left}>
        <View style={[cr.bar, { backgroundColor: accentColor }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={cr.originRow}>
            <View style={[cr.scopeBadge, { backgroundColor: accentBg }]}>
              <Text style={[cr.scopeTxt, { color: accentColor, fontFamily: C.font.sans }]}>
                {isPlatform ? "PLATEFORME" : item.origin.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[cr.label, { fontFamily: C.font.sans }]} numberOfLines={1}>
            {readableLabel(item.description)}
          </Text>
          <Text style={[cr.date, { fontFamily: C.font.sans }]}>
            {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            {item.transactionRef ? ` · ${item.transactionRef}` : ""}
          </Text>
        </View>
      </View>
      <View style={cr.right}>
        <View style={[cr.pill, { backgroundColor: accentBg, borderColor: `${accentColor}30` }]}>
          <Ionicons name="trending-up" size={10} color={accentColor} />
          <Text style={[cr.pillTxt, { color: accentColor, fontFamily: C.font.mono }]}>
            +{fmt(item.amount)} {item.currency}
          </Text>
        </View>
      </View>
    </View>
  );
}
const cr = StyleSheet.create({
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  left:   { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, minWidth: 0 },
  bar:    { width: 4, alignSelf: "stretch", borderRadius: C.r.pill, minHeight: 40 },
  originRow: { flexDirection: "row", marginBottom: 4 },
  scopeBadge:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: C.r.pill },
  scopeTxt:  { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  label:  { color: C.ink, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  date:   { color: C.inkMuted, fontSize: 10, fontWeight: "600" },
  right:  { alignItems: "flex-end", gap: 3, paddingLeft: 10 },
  pill:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: C.r.pill, borderWidth: 1 },
  pillTxt:{ fontSize: 11, fontWeight: "900" },
});

// ─── Main ───────────────────────────────────────────────
export default function AdminCommissionsScreen() {
  const router = useRouter();

  const [period,  setPeriod]  = useState("day");
  const [data,    setData]    = useState<CompanyLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.http.get(`/commissions/ledger/company?period=${period}`);
      setData(res.data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.log("Erreur commissions admin:", e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]);

  const platformTotals  = data?.platform.totalsByCurrency ?? [];
  const platformPrimary = platformTotals.slice().sort((a, b) => b.total - a.total)[0] ?? null;
  const platformCount   = toNum(data?.platform.count);

  const agencies = data?.agencies ?? [];
  const entries  = data?.entries ?? [];

  const agencyTotalPrimary = agencies.reduce((sum, a) => {
    const t = a.totalsByCurrency.find((x) => x.currency === (platformPrimary?.currency ?? "XOF"));
    return sum + (t?.total ?? 0);
  }, 0);

  const totalDistributed = agencyTotalPrimary + (platformPrimary?.total ?? 0);
  const pct = totalDistributed > 0 ? Math.min(((platformPrimary?.total ?? 0) / totalDistributed) * 100, 100) : 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      <Animated.View style={[s.header, { opacity: headerAnim }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: C.font.serif }]}>Commissions</Text>
          <Text style={[s.headerSub, { color: C.blue, fontFamily: C.font.sans }]}>
            Argent réellement crédité · toutes agences
          </Text>
        </View>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: C.blueLt }]} onPress={() => void loadData()}>
          <Ionicons name="refresh" size={18} color={C.blue} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.periods}
        style={s.periodsWrap}
      >
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.periodPill, active && { backgroundColor: C.blueLt, borderColor: `${C.blue}40` }]}
              onPress={() => setPeriod(p.key)}
            >
              {active && <View style={[s.periodDot, { backgroundColor: C.blue }]} />}
              <Text style={[s.periodTxt, { fontFamily: C.font.sans, color: active ? C.blue : C.inkSub, fontWeight: active ? "800" : "600" }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.blue} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.statsRow}>
            <StatCard label="Crédits plateforme" value={String(platformCount)}  icon="business-outline"   color={C.blue}  bg={C.blueLt} />
            <StatCard label="Agences actives"    value={String(agencies.length)} icon="storefront-outline" color={C.teal} bg={C.tealLt} />
            <StatCard label="Total distribué"    value={fmt(totalDistributed)}   icon="cash-outline"       color={C.amber} bg={C.amberLt} />
          </View>

          <View style={[s.heroCard, { borderTopColor: C.blue }]}>
            <View style={s.heroTop}>
              <View style={[s.heroIconBox, { backgroundColor: C.blueLt }]}>
                <Ionicons name="trending-up" size={18} color={C.blue} />
              </View>
              <View>
                <Text style={[s.heroLabel, { fontFamily: C.font.sans }]}>MARGE NETTE PLATEFORME</Text>
                <Text style={[s.heroPeriod, { fontFamily: C.font.sans }]}>
                  {PERIODS.find((p) => p.key === period)?.label} · argent réel, pas une estimation
                </Text>
              </View>
            </View>
            <Text style={[s.heroAmt, { color: C.blue, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
              {platformPrimary ? fmt(platformPrimary.total) : "0"}
            </Text>
            <Text style={[s.heroCur, { color: C.blue, fontFamily: C.font.mono }]}>
              {platformPrimary?.currency ?? "XOF"}
            </Text>
            {platformTotals.length > 1 && (
              <View style={s.extraRow}>
                {platformTotals.filter((t) => t !== platformPrimary).map((t) => (
                  <View key={t.currency} style={s.extraChip}>
                    <Text style={[s.extraTxt, { fontFamily: C.font.mono }]}>+{fmt(t.total)} {t.currency}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={[s.progBg, { backgroundColor: `${C.blue}14` }]}>
              <View style={[s.progFill, { width: `${pct}%` as any, backgroundColor: C.blue }]} />
            </View>
            <Text style={[s.progLbl, { fontFamily: C.font.sans }]}>
              {pct.toFixed(1)}% du total distribué (plateforme vs agences)
            </Text>
          </View>

          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: C.teal }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>PAR AGENCE · {agencies.length}</Text>
          </View>
          {agencies.length === 0 ? (
            <View style={s.emptySmall}>
              <Text style={[s.emptySmallTxt, { fontFamily: C.font.sans }]}>Aucune agence n'a reçu de commission sur cette période.</Text>
            </View>
          ) : (
            <View style={s.card}>
              {agencies.map((a) => <AgencyRow key={a.agencyId} agency={a} />)}
            </View>
          )}

          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: C.blue }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>DÉTAIL · {entries.length} CRÉDITS</Text>
          </View>

          {entries.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyBox, { borderColor: C.border }]}>
                <Ionicons name="bar-chart-outline" size={32} color={C.inkMuted} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>Aucune commission créditée</Text>
              <Text style={[s.emptyTxt, { fontFamily: C.font.sans }]}>
                Pas de crédit sur cette période. Les Dépôts Client et les remontées de
                fonds vers l'admin ne génèrent jamais de commission — seul le paiement
                d'un retrait cash en génère une, répartie entre l'agence payeuse,
                l'agence d'origine et la plateforme.
              </Text>
            </View>
          ) : (
            <View style={s.historyCard}>
              {entries.map((item) => (
                <CommissionRow key={item.id} item={item} />
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white,
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: C.r.md, backgroundColor: C.pageBg, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: C.ink, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconBtn:     { width: 38, height: 38, borderRadius: C.r.md, justifyContent: "center", alignItems: "center" },

  periodsWrap: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  periods:     { paddingHorizontal: 14, gap: 8, paddingVertical: 10, alignItems: "center" },
  periodPill:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.pill, backgroundColor: C.pageBg, borderWidth: 1.5, borderColor: C.border },
  periodDot:   { width: 5, height: 5, borderRadius: C.r.pill },
  periodTxt:   { fontSize: 12 },

  scroll:    { padding: 16 },
  statsRow:  { flexDirection: "row", gap: 10, marginBottom: 14 },

  heroCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 20, marginBottom: 20,
    borderWidth: 1, borderTopWidth: 3, borderColor: C.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
  },
  heroTop:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  heroIconBox:{ width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  heroLabel:  { fontSize: 9,  fontWeight: "900", color: C.inkMuted, letterSpacing: 1.2, textTransform: "uppercase" },
  heroPeriod: { fontSize: 11, fontWeight: "700", color: C.inkSub, marginTop: 2 },
  heroAmt:    { fontSize: 36, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  heroCur:    { fontSize: 11, fontWeight: "900", marginBottom: 10 },
  extraRow:   { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  extraChip:  { backgroundColor: C.pageBg, borderRadius: C.r.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  extraTxt:   { fontSize: 10, fontWeight: "800", color: C.inkSub },
  progBg:     { height: 6, borderRadius: C.r.pill, overflow: "hidden", marginBottom: 8 },
  progFill:   { height: 6, borderRadius: C.r.pill },
  progLbl:    { fontSize: 10, color: C.inkSub, fontWeight: "700" },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  secRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  secDot:  { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl:  { fontSize: 10, fontWeight: "900", color: C.inkMuted, letterSpacing: 1.5, textTransform: "uppercase" },

  historyCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: C.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  emptySmall:    { backgroundColor: C.white, borderRadius: C.r.lg, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 20 },
  emptySmallTxt: { color: C.inkSub, fontSize: 12, fontWeight: "600", textAlign: "center" },

  empty:      { alignItems: "center", paddingVertical: 48, gap: 10, paddingHorizontal: 20 },
  emptyBox:   { width: 68, height: 68, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: "700" },
  emptyTxt:   { color: C.inkSub, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 17 },
});