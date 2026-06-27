// apps/direct-transfair-mobile/app/(tabs)/admin/notifications.tsx
// =========================================================
// NOTIFICATIONS SCREEN v5.0 — Direct Transf'air
// Design: Thème blanc pur, light premium
// ✅ Filtres Tout / Non lues · Marquer comme lu
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Platform, ActivityIndicator, RefreshControl, Alert, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

// ── Thèmes par rôle — fond blanc + teinte douce + accent ───────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#FFFFFF", g2: "#FDF8EE", accent: "#B8860B" },
  COMPANY_ADMIN: { g1: "#FFFFFF", g2: "#F0FDF9", accent: "#059669" },
  AGENT:         { g1: "#FFFFFF", g2: "#FFFBEB", accent: "#D97706" },
  USER:          { g1: "#FFFFFF", g2: "#F0FDF9", accent: "#059669" },
} as const;

// ── Types de notifications ──────────────────────────────────────
const NOTIF_TYPES = {
  SUCCESS: { icon: "checkmark-circle",   color: "#059669", bg: "rgba(5,150,105,0.10)" },
  WARNING: { icon: "alert-circle",       color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  ERROR:   { icon: "close-circle",       color: "#DC2626", bg: "rgba(220,38,38,0.10)" },
  INFO:    { icon: "information-circle", color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
} as const;

// ── Design tokens light ────────────────────────────────────────
const T = {
  white:   "#FFFFFF",
  surface: "#F3F4F6",   // gris neutre très clair
  border:  "#E5E7EB",
  text:    "#111827",   // quasi-noir
  textSub: "#374151",
  dim:     "#6B7280",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia",       android: "serif",              default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next",   android: "sans-serif-medium",  default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New",   android: "monospace",          default: "monospace" }),
  },
};

// ── Types ──────────────────────────────────────────────────────
type NotifItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
};

// ── Carte notification ─────────────────────────────────────────
function NotifCard({
  item,
  accent,
  onPress,
}: {
  item: NotifItem;
  accent: string;
  onPress: () => void;
}) {
  const cfg = NOTIF_TYPES[item.type as keyof typeof NOTIF_TYPES] ?? NOTIF_TYPES.INFO;
  const scale = useRef(new Animated.Value(1)).current;
  const isUnread = !item.isRead;

  const formatDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 3_600_000)  return `Il y a ${Math.round(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Il y a ${Math.round(diff / 3_600_000)} h`;
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          ncS.card,
          isUnread && {
            backgroundColor: `${accent}08`,
            borderColor: `${accent}30`,
          },
        ]}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
        }
        activeOpacity={1}
      >
        {/* Barre d'accent gauche pour non lues */}
        {isUnread && (
          <View style={[ncS.unreadBar, { backgroundColor: accent }]} />
        )}

        {/* Icône type */}
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
                isUnread && { color: T.text },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[ncS.time, { fontFamily: T.font.sans }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
          <Text style={[ncS.msg, { fontFamily: T.font.sans }]} numberOfLines={3}>
            {item.message}
          </Text>
        </View>

        {/* Point non lu */}
        {isUnread && (
          <View style={[ncS.unreadDot, { backgroundColor: accent }]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const ncS = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: T.white,
    borderRadius: T.radius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    gap: 14,
    // Ombre légère pour décoller la carte du fond blanc
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  title:     { flex: 1, fontSize: 14, fontWeight: "700", color: T.dim,      paddingRight: 8 },
  time:      { fontSize: 10, fontWeight: "700", color: T.dim },
  msg:       { fontSize: 12, color: T.dim, lineHeight: 17, fontWeight: "500" },
  unreadDot: { width: 8, height: 8, borderRadius: 99, marginTop: 4 },
});

// ── Écran principal ────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role  = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [notifs,     setNotifs]     = useState<NotifItem[]>([]);
  const [filter,     setFilter]     = useState<"ALL" | "UNREAD">("ALL");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchNotifs = useCallback(async () => {
    try {
      const res  = await api.http.get("/notifications");
      const data = Array.isArray(res.data) ? res.data : [];
      setNotifs(data);
      Animated.spring(fadeAnim, {
        toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3,
      }).start();
    } catch (e) {
      console.error(e);
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
    if (!notifs.some((n) => !n.isRead)) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.http.patch("/notifications/read-all");
    } catch {
      Alert.alert("Erreur", "Impossible de marquer toutes comme lues.");
      void fetchNotifs();
    }
  };

  const filtered    = filter === "ALL" ? notifs : notifs.filter((n) => !n.isRead);
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.g1} />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.text} />
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
            style={[s.markAllBtn, { borderColor: `${theme.accent}40` }]}
            onPress={handleMarkAllAsRead}
          >
            <Ionicons name="mail-open-outline" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Séparateur ── */}
        <View style={s.divider} />

        {/* ── Tabs filtre ── */}
        <View style={s.tabs}>
          {(["ALL", "UNREAD"] as const).map((f) => {
            const isActive = filter === f;
            const count    = f === "ALL" ? notifs.length : unreadCount;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  s.tab,
                  isActive && {
                    backgroundColor: `${theme.accent}15`,
                    borderColor:     `${theme.accent}50`,
                  },
                ]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    s.tabTxt,
                    { color: isActive ? theme.accent : T.dim, fontFamily: T.font.sans },
                  ]}
                >
                  {f === "ALL" ? "Toutes" : "Non lues"}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      s.tabCount,
                      { backgroundColor: isActive ? theme.accent : T.surface },
                    ]}
                  >
                    <Text
                      style={[
                        s.tabCountTxt,
                        { color: isActive ? "#FFF" : T.dim, fontFamily: T.font.mono },
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

        {/* ── Contenu ── */}
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
                <View style={[s.emptyIconBox, { borderColor: T.border }]}>
                  <Ionicons name="notifications-off-outline" size={36} color={T.dim} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                  Rien à signaler
                </Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                  {filter === "UNREAD" ? "Vous avez tout lu ✓" : "Votre centre est vide."}
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

// ── Styles globaux ─────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14,
    gap: 14,
    backgroundColor: T.white,
  },
  divider: { height: 1, backgroundColor: T.border },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  headerTitle: { color: T.text, fontSize: 22, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  markAllBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: T.radius.md,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
  },
  tabTxt:      { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  tabCount:    { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  tabCountTxt: { fontSize: 10, fontWeight: "900" },
  list:        { paddingHorizontal: 20 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIconBox: {
    width: 76, height: 76,
    borderRadius: 22,
    backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, marginBottom: 4,
  },
  emptyTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  emptySub:   { color: T.dim, fontSize: 13, fontWeight: "600" },
});