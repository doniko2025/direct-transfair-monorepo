// apps/direct-transfair-mobile/app/(tabs)/notifications.tsx
// =========================================================
// NOTIFICATIONS v4.0 — Direct Transf'air
// Design: Dark premium thématique par rôle
// ✅ Filtres Toutes / Non lues · Marquer comme lu
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  RefreshControl, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

// ─── Thèmes par rôle ─────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981" },
} as const;

// ─── Types de notification ────────────────────────────────
const NOTIF_TYPES = {
  SUCCESS:     { icon: "checkmark-circle",   color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  WARNING:     { icon: "alert-circle",       color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  ERROR:       { icon: "close-circle",       color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  INFO:        { icon: "information-circle", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  TRANSACTION: { icon: "swap-horizontal",    color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  SECURITY:    { icon: "shield-checkmark",   color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  MARKETING:   { icon: "megaphone",          color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  SYSTEM:      { icon: "settings",           color: "#8A9BB5", bg: "rgba(138,155,181,0.10)" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: keyof typeof NOTIF_TYPES;
  createdAt: string;
  isRead: boolean;
}

// ─── Format date ──────────────────────────────────────────
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `Il y a ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.round(diff / 3600000)} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Notification Card ────────────────────────────────────
function NotifCard({
  item, accent, onPress,
}: {
  item: NotificationItem; accent: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const cfg = NOTIF_TYPES[item.type] ?? NOTIF_TYPES.INFO;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          ncS.card,
          !item.isRead && { borderColor: `${accent}20`, backgroundColor: `${accent}04` },
        ]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
        }
      >
        {/* Icône */}
        <View style={[ncS.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>

        {/* Contenu */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={ncS.topRow}>
            <Text
              style={[
                ncS.title,
                { fontFamily: T.font.sans },
                !item.isRead && { color: T.white },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[ncS.time, { fontFamily: T.font.sans }]}>
              {fmtDate(item.createdAt)}
            </Text>
          </View>
          <Text
            style={[
              ncS.message,
              { fontFamily: T.font.sans },
              !item.isRead && { color: T.dim },
            ]}
            numberOfLines={3}
          >
            {item.message}
          </Text>
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
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10, gap: 14,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  iconBox: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  title: { flex: 1, fontSize: 14, fontWeight: "700", color: T.dim, paddingRight: 8 },
  time: { fontSize: 10, fontWeight: "700", color: T.dim + "80" },
  message: { fontSize: 12, color: T.dim, lineHeight: 17, fontWeight: "500" },
  unreadDot: { width: 8, height: 8, borderRadius: 99, marginTop: 5 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.http.get("/notifications");
      setNotifs(Array.isArray(res.data) ? res.data : []);
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
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await api.http.patch(`/notifications/${id}/read`);
    } catch {
      void fetchNotifs();
    }
  };

  const handleMarkAllAsRead = async () => {
    const hasUnread = notifs.some((n) => !n.isRead);
    if (!hasUnread) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.http.patch("/notifications/read-all");
    } catch {
      void fetchNotifs();
    }
  };

  const filtered = filter === "ALL" ? notifs : notifs.filter((n) => !n.isRead);
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[s.readAllBtn, { borderColor: `${theme.accent}30` }]}
            onPress={handleMarkAllAsRead}
            hitSlop={8}
          >
            <Ionicons name="checkmark-done" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Tabs filtres ── */}
        <View style={s.tabs}>
          {(["ALL", "UNREAD"] as const).map((f) => {
            const isActive = filter === f;
            const count = f === "ALL" ? notifs.length : unreadCount;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  s.tab,
                  isActive && {
                    backgroundColor: `${theme.accent}15`,
                    borderColor: `${theme.accent}35`,
                  },
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.tabTxt,
                    { fontFamily: T.font.sans },
                    isActive && { color: theme.accent },
                  ]}
                >
                  {f === "ALL" ? "Toutes" : "Non lues"}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      s.tabCount,
                      {
                        backgroundColor: isActive
                          ? theme.accent
                          : T.ghost,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.tabCountTxt,
                        {
                          color: isActive ? "#000" : T.dim,
                          fontFamily: T.font.mono,
                        },
                      ]}
                    >
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
                <View style={[s.emptyIconBox, { borderColor: `${theme.accent}20` }]}>
                  <Ionicons name="notifications-off-outline" size={34} color={T.dim} />
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
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  readAllBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1,
  },

  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 14 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  tabTxt: { fontSize: 12, fontWeight: "800", color: T.dim, letterSpacing: 0.3 },
  tabCount: {
    minWidth: 18, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 6, alignItems: "center",
  },
  tabCountTxt: { fontSize: 10, fontWeight: "900" },

  list: { paddingHorizontal: 20 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, marginBottom: 4,
  },
  emptyTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  emptySub: { color: T.dim, fontSize: 13, fontWeight: "600", textAlign: "center" },
});