// apps/direct-transfair-mobile/app/(tabs)/notifications.tsx
// =========================================================
// NOTIFICATIONS v5.0 — Direct Transf'air
// ✅ v4.0 : Filtres Toutes / Non lues · Marquer comme lu
// ✅ v5.0 :
//    - Thème 100% CLAIR (suppression LinearGradient dark)
//    - Couleurs accent par rôle conservées sur fond clair
//    - AGENT → Bleu #2563EB (cohérent avec les autres pages)
//    - Cartes notifications redessinées pour fond blanc
//    - StatusBar dark-content
//    - Fix anomalie : parsing API robuste (paginated ou array)
//    - Fix : types non reconnus → fallback INFO
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

// ─── Thèmes par rôle — version CLAIRE ────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { pageBg: "#FFFDF7", headerBg: "#FFFFFF", accent: "#D97706", border: "#FDE68A", soft: "#FFFBEB" },
  COMPANY_ADMIN: { pageBg: "#F4F6FF", headerBg: "#FFFFFF", accent: "#4F46E5", border: "#C7D2FE", soft: "#EEF2FF" },
  AGENT:         { pageBg: "#EFF6FF", headerBg: "#FFFFFF", accent: "#2563EB", border: "#DBEAFE", soft: "#EFF6FF" },
  USER:          { pageBg: "#F0FDF4", headerBg: "#FFFFFF", accent: "#059669", border: "#A7F3D0", soft: "#ECFDF5" },
} as const;

// ─── Types de notification ────────────────────────────────
const NOTIF_TYPES = {
  SUCCESS:     { icon: "checkmark-circle",   color: "#16A34A", bg: "rgba(22,163,74,0.10)"  },
  WARNING:     { icon: "alert-circle",       color: "#D97706", bg: "rgba(217,119,6,0.10)"  },
  ERROR:       { icon: "close-circle",       color: "#DC2626", bg: "rgba(220,38,38,0.10)"  },
  INFO:        { icon: "information-circle", color: "#2563EB", bg: "rgba(37,99,235,0.10)"  },
  TRANSACTION: { icon: "swap-horizontal",    color: "#7C3AED", bg: "rgba(124,58,237,0.10)" },
  SECURITY:    { icon: "shield-checkmark",   color: "#0891B2", bg: "rgba(8,145,178,0.10)"  },
  MARKETING:   { icon: "megaphone",          color: "#059669", bg: "rgba(5,150,105,0.10)"  },
  SYSTEM:      { icon: "settings",           color: "#64748B", bg: "rgba(100,116,139,0.09)"},
} as const;

// ─── Design tokens CLAIRS ────────────────────────────────
const T = {
  surface:    "#FFFFFF",
  border:     "#E4E9F5",
  text:       "#0F172A",
  textSoft:   "#64748B",
  textMuted:  "#94A3B8",
  r: { md: 14, lg: 18 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string; // string (pas keyof) → évite les erreurs runtime
  createdAt: string;
  isRead: boolean;
}

// ─── Format date ─────────────────────────────────────────
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000)  return `Il y a ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.round(diff / 3600000)} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Notification Card — thème clair ────────────────────
function NotifCard({ item, accent, onPress }: {
  item: NotificationItem; accent: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  // ✅ Fix : fallback INFO pour les types non reconnus
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
        {/* Icône */}
        <View style={[ncS.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>

        {/* Contenu */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={ncS.topRow}>
            <Text
              style={[ncS.title, { fontFamily: T.font.sans }, !item.isRead && { color: T.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[ncS.time, { fontFamily: T.font.sans }]}>
              {fmtDate(item.createdAt)}
            </Text>
          </View>
          <Text
            style={[ncS.message, { fontFamily: T.font.sans }]}
            numberOfLines={3}
          >
            {item.message}
          </Text>
          {/* Type badge */}
          {item.type && item.type !== "INFO" && (
            <View style={[ncS.typeBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[ncS.typeTxt, { color: cfg.color, fontFamily: T.font.sans }]}>
                {item.type}
              </Text>
            </View>
          )}
        </View>

        {/* Dot non lu */}
        {!item.isRead && (
          <View style={[ncS.unreadDot, { backgroundColor: accent }]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const ncS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: T.surface,
    borderRadius: T.r.lg,
    padding: 14, marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  iconBox:   { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title:     { flex: 1, fontSize: 13, fontWeight: "700", color: T.textSoft, paddingRight: 8 },
  time:      { fontSize: 10, fontWeight: "600", color: T.textMuted },
  message:   { fontSize: 12, color: T.textSoft, lineHeight: 17, fontWeight: "500" },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, marginTop: 6 },
  typeTxt:   { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  unreadDot: { width: 8, height: 8, borderRadius: 99, marginTop: 4, flexShrink: 0 },
});

// ─── Main Screen ─────────────────────────────────────────
export default function NotificationsScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [notifs,     setNotifs]     = useState<NotificationItem[]>([]);
  const [filter,     setFilter]     = useState<"ALL" | "UNREAD">("ALL");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.http.get("/notifications");

      // ✅ Fix anomalie : parsing robuste — API paginée ou tableau simple
      let list: NotificationItem[] = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data?.data)) {
        list = res.data.data;                           // { data: [...], total }
      } else if (Array.isArray(res.data?.notifications)) {
        list = res.data.notifications;                  // { notifications: [...] }
      } else if (Array.isArray(res.data?.items)) {
        list = res.data.items;                          // { items: [...] }
      }

      setNotifs(list);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) {
      console.error("Erreur notifs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    try {
      await api.http.patch(`/notifications/${id}/read`);
    } catch {
      void fetchNotifs();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!notifs.some((n) => !n.isRead)) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.http.patch("/notifications/read-all");
    } catch {
      void fetchNotifs();
    }
  };

  const filtered    = filter === "ALL" ? notifs : notifs.filter((n) => !n.isRead);
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    // ✅ Fond clair selon le rôle
    <SafeAreaView style={[s.safe, { backgroundColor: theme.pageBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.headerBg} />

      {/* ── Header clair ── */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: T.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[s.readAllBtn, { borderColor: `${theme.accent}35`, backgroundColor: theme.soft }]}
          onPress={handleMarkAllAsRead}
          hitSlop={8}
        >
          <Ionicons name="checkmark-done" size={17} color={theme.accent} />
        </TouchableOpacity>
      </View>

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
              {isActive && (
                <View style={[s.tabDot, { backgroundColor: theme.accent }]} />
              )}
              <Text style={[
                s.tabTxt,
                { fontFamily: T.font.sans },
                isActive ? { color: theme.accent } : { color: T.textSoft },
              ]}>
                {f === "ALL" ? "Toutes" : "Non lues"}
              </Text>
              {count > 0 && (
                <View style={[
                  s.tabCount,
                  { backgroundColor: isActive ? theme.accent : "#F1F5F9" },
                ]}>
                  <Text style={[
                    s.tabCountTxt,
                    { fontFamily: T.font.mono },
                    { color: isActive ? "#fff" : T.textSoft },
                  ]}>
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
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchNotifs(); }}
              tintColor={theme.accent}
            />
          }
          renderItem={({ item }) => (
            <NotifCard
              item={item}
              accent={theme.accent}
              onPress={() => handleMarkAsRead(item.id, item.isRead)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIconBox, { borderColor: `${theme.accent}25`, backgroundColor: theme.soft }]}>
                <Ionicons name="notifications-off-outline" size={34} color={theme.accent} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                Aucune notification
              </Text>
              <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                {filter === "UNREAD"
                  ? "Vous avez tout lu ✓"
                  : "Vos alertes apparaîtront ici."}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },

  // ── Header clair ──
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18,
    paddingTop:    Platform.OS === "android" ? 44 : 14,
    paddingBottom: 12, gap: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#F4F6FF", borderWidth: 1, borderColor: "#E4E9F5",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { color: T.text, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 1 },
  readAllBtn:  {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
  },

  // ── Tabs clairs ──
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 18, paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5,
  },
  tabDot:      { width: 5, height: 5, borderRadius: 99 },
  tabTxt:      { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  tabCount: {
    minWidth: 18, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 6, alignItems: "center",
  },
  tabCountTxt: { fontSize: 10, fontWeight: "900" },

  list: { paddingHorizontal: 16, paddingTop: 12 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, marginBottom: 4,
  },
  emptyTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  emptySub:   { color: T.textSoft, fontSize: 13, fontWeight: "600", textAlign: "center" },
});