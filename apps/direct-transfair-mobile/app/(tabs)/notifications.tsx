// apps/direct-transfair-mobile/app/(tabs)/notifications.tsx
// =========================================================
// NOTIFICATIONS v5.3 — Direct Transf'air
// ✅ v5.3 : WHITE-LABEL — les couleurs vertes écrites en dur suivent maintenant la
//    couleur de marque du tenant (components/wallet/brand.ts) ; palette et styles
//    évalués paresseusement. Avec la marque par défaut, rendu strictement identique.
//    Aucune logique métier touchée. Développé par Thierno Doniko (Grand Chef).
//    En-tête commun du wallet (ScreenHeader) : même style que les autres écrans.
// ✅ v5.2 : FIX — chargement borné et erreur visible.
//    AVANT : en cas d'échec de GET /notifications, l'erreur était avalée
//    (console.error) et l'écran affichait « Aucune notification » — faux
//    message ; sans réponse, le spinner tournait sans limite claire.
//    MAINTENANT : appel borné (withTimeout 20 s), message rassurant après
//    4 s, état d'erreur avec « Réessayer » (les notifications déjà
//    chargées restent affichées). Logique métier inchangée.
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.1 : fond blanc neutre #FAFAFA unifié sur tous les rôles
//    - pageBg unifié #FAFAFA (suppression des teintes rôle-dépendantes)
//    - Cartes notifications : ombre renforcée, bord neutre
//    - Bouton backBtn : fond neutre #F5F5F5
//    - Logique métier 100 % inchangée
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  RefreshControl, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../components/wallet/useLoader";
import { ErrorState, SlowHint } from "../../components/wallet/StateViews";

import { themed, brand, brandRgba } from "../../components/wallet/brand";
import { useWalletTheme } from "../../components/wallet/walletTheme";
import ScreenHeader, { HeaderIconButton } from "../../components/wallet/ScreenHeader";
// ─── Thèmes par rôle — pageBg unifié blanc neutre ────────
const ROLE_THEMES = themed(() => ({
  SUPER_ADMIN:   { pageBg: "#FAFAFA", headerBg: "#FFFFFF", accent: "#D97706", border: "#FDE68A", soft: "#FFFBEB" },
  COMPANY_ADMIN: { pageBg: "#FAFAFA", headerBg: "#FFFFFF", accent: "#4F46E5", border: "#C7D2FE", soft: "#EEF2FF" },
  AGENT:         { pageBg: "#FAFAFA", headerBg: "#FFFFFF", accent: "#2563EB", border: "#DBEAFE", soft: "#EFF6FF" },
  USER:          { pageBg: "#FAFAFA", headerBg: "#FFFFFF", accent: brand("#059669"), border: brand("#A7F3D0"), soft: brand("#ECFDF5") },
} as const));

// ─── Types de notification ────────────────────────────────
const NOTIF_TYPES = themed(() => ({
  SUCCESS:     { icon: "checkmark-circle",   color: "#16A34A", bg: "rgba(22,163,74,0.10)"  },
  WARNING:     { icon: "alert-circle",       color: "#D97706", bg: "rgba(217,119,6,0.10)"  },
  ERROR:       { icon: "close-circle",       color: "#DC2626", bg: "rgba(220,38,38,0.10)"  },
  INFO:        { icon: "information-circle", color: "#2563EB", bg: "rgba(37,99,235,0.10)"  },
  TRANSACTION: { icon: "swap-horizontal",    color: "#7C3AED", bg: "rgba(124,58,237,0.10)" },
  SECURITY:    { icon: "shield-checkmark",   color: "#0891B2", bg: "rgba(8,145,178,0.10)"  },
  MARKETING:   { icon: "megaphone",          color: brand("#059669"), bg: brandRgba("rgba(5,150,105,0.10)")  },
  SYSTEM:      { icon: "settings",           color: "#64748B", bg: "rgba(100,116,139,0.09)"},
} as const));

const T = themed(() => ({
  surface:    "#FFFFFF",
  border:     "#E5E5EA",  // ← neutre (était #E4E9F5)
  text:       "#0F172A",
  textSoft:   "#64748B",
  textMuted:  "#94A3B8",
  r: { md: 14, lg: 18 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
}));

interface NotificationItem {
  id: string; title: string; message: string;
  type: string; createdAt: string; isRead: boolean;
}

function fmtDate(iso: string): string {
  const d = new Date(iso), now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000)  return `Il y a ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.round(diff / 3600000)} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Notification Card ────────────────────────────────────
function NotifCard({ item, accent, onPress }: {
  item: NotificationItem; accent: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const cfg = NOTIF_TYPES[item.type as keyof typeof NOTIF_TYPES] ?? NOTIF_TYPES.INFO;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          ncS.card,
          !item.isRead && { borderColor: `${accent}30`, backgroundColor: `${accent}06` },
        ]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[ncS.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={ncS.topRow}>
            <Text style={[ncS.title, { fontFamily: T.font.sans }, !item.isRead && { color: T.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[ncS.time, { fontFamily: T.font.sans }]}>{fmtDate(item.createdAt)}</Text>
          </View>
          <Text style={[ncS.message, { fontFamily: T.font.sans }]} numberOfLines={3}>{item.message}</Text>
          {item.type && item.type !== "INFO" && (
            <View style={[ncS.typeBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[ncS.typeTxt, { color: cfg.color, fontFamily: T.font.sans }]}>{item.type}</Text>
            </View>
          )}
        </View>
        {!item.isRead && <View style={[ncS.unreadDot, { backgroundColor: accent }]} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
const ncS = themed(() => StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: T.surface,
    borderRadius: T.r.lg,
    padding: 14, marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: T.border,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  iconBox:   { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title:     { flex: 1, fontSize: 13, fontWeight: "700", color: T.textSoft, paddingRight: 8 },
  time:      { fontSize: 10, fontWeight: "600", color: T.textMuted },
  message:   { fontSize: 12, color: T.textSoft, lineHeight: 17, fontWeight: "500" },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, marginTop: 6 },
  typeTxt:   { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  unreadDot: { width: 8, height: 8, borderRadius: 99, marginTop: 4, flexShrink: 0 },
}));

// ─── Main ─────────────────────────────────────────────────
export default function NotificationsScreen() {
  useWalletTheme(); // synchronise la marque (couleurs dynamiques du tenant)
  const router   = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [notifs,     setNotifs]     = useState<NotificationItem[]>([]);
  const [filter,     setFilter]     = useState<"ALL" | "UNREAD">("ALL");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState<LoadError | null>(null);
  const [slow,       setSlow]       = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchNotifs = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await withTimeout(api.http.get("/notifications"), defaultTimeoutMs());
      let list: NotificationItem[] = [];
      if (Array.isArray(res.data))                    list = res.data;
      else if (Array.isArray(res.data?.data))         list = res.data.data;
      else if (Array.isArray(res.data?.notifications))list = res.data.notifications;
      else if (Array.isArray(res.data?.items))        list = res.data.items;
      setNotifs(list);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { setLoadError(explainLoadError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    try { await api.http.patch(`/notifications/${id}/read`); }
    catch { void fetchNotifs(); }
  };

  const handleMarkAllAsRead = async () => {
    if (!notifs.some((n) => !n.isRead)) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await api.http.patch("/notifications/read-all"); }
    catch { void fetchNotifs(); }
  };

  const filtered    = filter === "ALL" ? notifs : notifs.filter((n) => !n.isRead);
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <View style={[s.safe, { backgroundColor: theme.pageBg }]}>

      {/* ── Header (en-tête commun du wallet) ── */}
      <ScreenHeader
        compact
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : undefined}
        onBack={() => router.back()}
        right={<HeaderIconButton icon="checkmark-done" label="Tout marquer comme lu" onPress={handleMarkAllAsRead} />}
      />

      {/* ── Tabs filtres ── */}
      <View style={[s.tabs, { backgroundColor: theme.headerBg, borderBottomColor: T.border }]}>
        {(["ALL", "UNREAD"] as const).map((f) => {
          const isActive = filter === f;
          const count = f === "ALL" ? notifs.length : unreadCount;
          return (
            <TouchableOpacity
              key={f}
              style={[
                s.tab,
                isActive
                  ? { backgroundColor: theme.soft, borderColor: `${theme.accent}40` }
                  : { backgroundColor: T.surface, borderColor: T.border },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              {isActive && <View style={[s.tabDot, { backgroundColor: theme.accent }]} />}
              <Text style={[s.tabTxt, { fontFamily: T.font.sans }, isActive ? { color: theme.accent } : { color: T.textSoft }]}>
                {f === "ALL" ? "Toutes" : "Non lues"}
              </Text>
              {count > 0 && (
                <View style={[s.tabCount, { backgroundColor: isActive ? theme.accent : "#F0F0F0" }]}>
                  <Text style={[s.tabCountTxt, { fontFamily: T.font.mono }, { color: isActive ? "#fff" : T.textSoft }]}>
                    {count > 99 ? "99+" : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Liste ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.accent} size="large" />
          <View style={{ marginTop: 16, paddingHorizontal: 24 }}><SlowHint visible={slow} /></View>
        </View>
      ) : loadError && notifs.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState title={loadError.title} message={loadError.message} onRetry={() => { setLoading(true); void fetchNotifs(); }} />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchNotifs(); }} tintColor={theme.accent} />
          }
          renderItem={({ item }) => (
            <NotifCard item={item} accent={theme.accent} onPress={() => handleMarkAsRead(item.id, item.isRead)} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIconBox, { borderColor: `${theme.accent}25`, backgroundColor: theme.soft }]}>
                <Ionicons name="notifications-off-outline" size={34} color={theme.accent} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucune notification</Text>
              <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                {filter === "UNREAD" ? "Vous avez tout lu ✓" : "Vos alertes apparaîtront ici."}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18,
    paddingTop:    Platform.OS === "android" ? 44 : 14,
    paddingBottom: 12, gap: 12,
    borderBottomWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  // ← fond neutre #F5F5F5 (était #F4F6FF bleuté)
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { color: T.text, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 1 },
  readAllBtn:  { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center", borderWidth: 1 },

  tabs: {
    flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10,
    gap: 10, borderBottomWidth: 1,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5,
  },
  tabDot:      { width: 5, height: 5, borderRadius: 99 },
  tabTxt:      { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  tabCount:    { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  tabCountTxt: { fontSize: 10, fontWeight: "900" },

  list:  { paddingHorizontal: 16, paddingTop: 12 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1.5, marginBottom: 4 },
  emptyTitle:   { color: T.text, fontSize: 18, fontWeight: "700" },
  emptySub:     { color: T.textSoft, fontSize: 13, fontWeight: "600", textAlign: "center" },
}));