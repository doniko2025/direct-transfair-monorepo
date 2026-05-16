// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
// =========================================================
// BENEFICIARIES v5.0 — Direct Transf'air
// Design: Thème clair · Vert #059669 · Style YMO/Wise
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Platform, Animated,
  StatusBar, SafeAreaView, TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const C = {
  green:        "#059669",
  greenDark:    "#047857",
  greenLight:   "#F0FDF4",
  greenBorder:  "#A7F3D0",
  greenPale:    "#ECFDF5",
  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",
  pageBg:       "#F0FDF8",
  white:        "#FFFFFF",
  cardBorder:   "#D1FAE5",
  inputBg:      "#F8FFFC",
  ink:          "#0D2B1F",
  inkMid:       "#1F5C3A",
  inkSoft:      "#6B9E85",
  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",
  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  red:          "#EF4444",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// Couleurs d'avatar par initiale
const AVATAR_COLORS = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Beneficiary Card ───────────────────────────────────
function BenefCard({ item }: { item: any }) {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;
  const initials = (item.fullName || "?").split(" ").map((s: string) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
  const colors   = avatarColor(item.fullName || "A");

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={bc.card}
        onPress={() => router.push(`/(tabs)/beneficiaries/${item.id}`)}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[bc.avatar, { backgroundColor: colors.bg }]}>
          <Text style={[bc.initials, { color: colors.text, fontFamily: C.font.serif }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[bc.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{item.fullName}</Text>
          <View style={bc.meta}>
            {item.country && (
              <View style={bc.metaChip}>
                <Ionicons name="location-outline" size={10} color={C.inkSoft} />
                <Text style={[bc.metaTxt, { fontFamily: C.font.sans }]}>{item.city ? `${item.city}, ` : ""}{item.country}</Text>
              </View>
            )}
            {item.phone && (
              <View style={bc.metaChip}>
                <Ionicons name="call-outline" size={10} color={C.inkSoft} />
                <Text style={[bc.metaTxt, { fontFamily: C.font.mono }]}>{item.phone}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={bc.actions}>
          <TouchableOpacity
            style={[bc.actionBtn, { backgroundColor: C.greenPale }]}
            onPress={() => router.push({ pathname: "/(tabs)/send", params: { beneficiaryId: item.id } })}
            hitSlop={8}
          >
            <Ionicons name="paper-plane-outline" size={15} color={C.green} />
          </TouchableOpacity>
          <View style={[bc.chevronBtn, { backgroundColor: C.greenLight }]}>
            <Ionicons name="chevron-forward" size={14} color={C.green} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const bc = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, borderWidth: 1, borderColor: C.cardBorder, shadowColor: C.green, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar:     { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  initials:   { fontSize: 18, fontWeight: "900" },
  name:       { fontSize: 14, fontWeight: "700", color: C.ink, marginBottom: 5 },
  meta:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip:   { flexDirection: "row", alignItems: "center", gap: 3 },
  metaTxt:    { fontSize: 10, fontWeight: "600", color: C.inkSoft },
  actions:    { flexDirection: "row", gap: 8 },
  actionBtn:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  chevronBtn: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Main ───────────────────────────────────────────────
export default function BeneficiariesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [q,             setQ]             = useState("");

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res  = await api.getBeneficiaries();
      const list = Array.isArray(res) ? res : [];
      setBeneficiaries(list.sort((a: any, b: any) => (a.fullName ?? "").localeCompare(b.fullName ?? "")));
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setBeneficiaries([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    void load();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [load]));

  const filtered = beneficiaries.filter((b) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (b.fullName ?? "").toLowerCase().includes(s) || (b.phone ?? "").toLowerCase().includes(s) || (b.country ?? "").toLowerCase().includes(s);
  });

  // Regrouper par initiale
  const grouped = filtered.reduce((acc: Record<string, any[]>, b) => {
    const letter = (b.fullName?.[0] ?? "#").toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(b);
    return acc;
  }, {});
  const sections = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Mes Contacts</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
              {beneficiaries.length} destinataire{beneficiaries.length > 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => router.push("/(tabs)/beneficiaries/create")}
          >
            <Ionicons name="person-add-outline" size={18} color={C.white} />
          </TouchableOpacity>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search" size={15} color={C.heroDim} />
          <TextInput
            style={[s.searchInput, { fontFamily: C.font.sans }]}
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher un contact…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            underlineColorAndroid="transparent"
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={C.heroDim} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim, flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.green} />}
        >
          {sections.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconBox}>
                <Ionicons name="people-outline" size={34} color={C.inkSoft} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>
                {q ? "Aucun résultat" : "Aucun contact"}
              </Text>
              <Text style={[s.emptySub, { fontFamily: C.font.sans }]}>
                {q ? "Modifiez votre recherche" : "Ajoutez vos premiers destinataires"}
              </Text>
              {!q && (
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/beneficiaries/create")}>
                  <Ionicons name="person-add-outline" size={16} color={C.green} />
                  <Text style={[s.emptyBtnTxt, { fontFamily: C.font.sans }]}>Ajouter un contact</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            sections.map(([letter, items]) => (
              <View key={letter}>
                <View style={s.letterHeader}>
                  <Text style={[s.letterTxt, { fontFamily: C.font.serif }]}>{letter}</Text>
                </View>
                {items.map((item) => <BenefCard key={item.id} item={item} />)}
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => router.push("/(tabs)/beneficiaries/create")} activeOpacity={0.88}>
        <Ionicons name="add" size={26} color={C.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: C.green,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 20, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  heroTitle: { color: C.white, fontSize: 24, fontWeight: "700", marginBottom: 2 },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600" },
  addBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center", marginTop: 4,
  },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    borderRadius: C.r.md, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.white, fontWeight: "600" },

  list: { paddingHorizontal: 16, paddingTop: 16 },

  letterHeader: { marginBottom: 8, marginTop: 6 },
  letterTxt:    { fontSize: 13, fontWeight: "900", color: C.inkSoft, letterSpacing: 0.5 },

  empty:       { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyIconBox:{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:  { color: C.ink, fontSize: 18, fontWeight: "700" },
  emptySub:    { color: C.inkSoft, fontSize: 13, fontWeight: "600", textAlign: "center" },
  emptyBtn:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: C.greenPale, borderRadius: C.r.md, paddingHorizontal: 20, paddingVertical: 13, borderWidth: 1, borderColor: C.greenBorder },
  emptyBtnTxt: { color: C.green, fontWeight: "800", fontSize: 14 },

  fab: {
    position: "absolute", bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.green, justifyContent: "center", alignItems: "center",
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
});