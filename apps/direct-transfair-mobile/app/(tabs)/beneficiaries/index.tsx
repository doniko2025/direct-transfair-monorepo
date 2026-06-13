// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
// =========================================================
// BENEFICIARIES v6.1 — Direct Transf'air
// ✅ v6.0 : UI compacte, groupage alphabétique, badge compteur
// ✅ v6.1 : fond blanc neutre #FAFAFA, ombres neutres
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

const C = {
  green:       "#059669",
  greenDark:   "#047857",
  greenLight:  "#F0FDF4",
  greenBorder: "#A7F3D0",
  greenPale:   "#ECFDF5",
  heroGlass:   "rgba(255,255,255,0.14)",
  heroGlassBdr:"rgba(255,255,255,0.22)",
  heroDim:     "rgba(255,255,255,0.65)",
  heroGlow:    "rgba(255,255,255,0.08)",
  pageBg:      "#FAFAFA",   // ← était #F0FDF8
  white:       "#FFFFFF",
  cardBorder:  "#E5E5EA",   // ← était #D1FAE5
  inputBg:     "#F8F8F8",   // ← était #F8FFFC
  ink:         "#0D2B1F",
  inkMid:      "#1F5C3A",
  inkSoft:     "#6B9E85",
  r: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",      android: "serif",              default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next",  android: "sans-serif-medium",  default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New",  android: "monospace",          default: "monospace"  }),
  },
};

const AVATAR_COLORS = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

// ─── Beneficiary Card ───────────────────────────────────
function BenefCard({ item }: { item: any }) {
  const router   = useRouter();
  const scale    = useRef(new Animated.Value(1)).current;
  const initials = (item.fullName || "?").split(" ").map((s: string) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
  const colors   = avatarColor(item.fullName || "A");

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 8 }}>
      <TouchableOpacity
        style={bc.card}
        onPress={() => router.push(`/(tabs)/beneficiaries/${item.id}`)}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[bc.avatar, { backgroundColor: colors.bg }]}>
          <Text style={[bc.initials, { color: colors.text, fontFamily: C.font.serif }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[bc.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{item.fullName}</Text>
          <View style={bc.meta}>
            {item.country && (
              <View style={bc.metaChip}>
                <Ionicons name="location-outline" size={9} color={C.inkSoft} />
                <Text style={[bc.metaTxt, { fontFamily: C.font.sans }]} numberOfLines={1}>
                  {item.city ? `${item.city}, ` : ""}{item.country}
                </Text>
              </View>
            )}
            {item.phone && (
              <View style={bc.metaChip}>
                <Ionicons name="call-outline" size={9} color={C.inkSoft} />
                <Text style={[bc.metaTxt, { fontFamily: C.font.mono }]} numberOfLines={1}>{item.phone}</Text>
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
            <Ionicons name="paper-plane-outline" size={13} color={C.green} />
          </TouchableOpacity>
          <View style={[bc.chevronBtn, { backgroundColor: "#F5F5F5" }]}>
            <Ionicons name="chevron-forward" size={12} color={C.green} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const bc = StyleSheet.create({
  card:      {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: C.r.md, padding: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  avatar:    { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  initials:  { fontSize: 15, fontWeight: "900" },
  name:      { fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 4 },
  meta:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip:  { flexDirection: "row", alignItems: "center", gap: 3 },
  metaTxt:   { fontSize: 10, fontWeight: "600", color: C.inkSoft },
  actions:   { flexDirection: "row", gap: 6 },
  actionBtn: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  chevronBtn:{ width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Main ───────────────────────────────────────────────
export default function BeneficiariesScreen() {
  const router = useRouter();
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

      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0,1], outputRange: [0.97,1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Mes Contacts</Text>
            <View style={s.heroSubRow}>
              <View style={s.countBadge}>
                <Text style={[s.countTxt, { fontFamily: C.font.sans }]}>{beneficiaries.length}</Text>
              </View>
              <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
                destinataire{beneficiaries.length > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => router.push("/(tabs)/beneficiaries/create")}>
            <Ionicons name="person-add-outline" size={16} color={C.white} />
          </TouchableOpacity>
        </View>
        <View style={s.searchBox}>
          <Ionicons name="search" size={13} color={C.heroDim} />
          <TextInput
            style={[s.searchInput, { fontFamily: C.font.sans }]}
            value={q} onChangeText={setQ}
            placeholder="Rechercher un contact…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            underlineColorAndroid="transparent"
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color={C.heroDim} />
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
                <Ionicons name="people-outline" size={30} color={C.inkSoft} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>
                {q ? "Aucun résultat" : "Aucun contact"}
              </Text>
              <Text style={[s.emptySub, { fontFamily: C.font.sans }]}>
                {q ? "Modifiez votre recherche" : "Ajoutez vos premiers destinataires"}
              </Text>
              {!q && (
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/beneficiaries/create")}>
                  <Ionicons name="person-add-outline" size={14} color={C.green} />
                  <Text style={[s.emptyBtnTxt, { fontFamily: C.font.sans }]}>Ajouter un contact</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            sections.map(([letter, items]) => (
              <View key={letter}>
                <View style={s.letterHeader}>
                  <Text style={[s.letterTxt, { fontFamily: C.font.serif }]}>{letter}</Text>
                  <View style={s.letterBadge}>
                    <Text style={[s.letterCount, { fontFamily: C.font.sans }]}>{items.length}</Text>
                  </View>
                </View>
                {items.map((item) => <BenefCard key={item.id} item={item} />)}
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => router.push("/(tabs)/beneficiaries/create")} activeOpacity={0.88}>
        <Ionicons name="add" size={24} color={C.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: { backgroundColor: C.green, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 14, paddingBottom: 18, overflow: "hidden" },
  glow:      { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: C.heroGlow, top: -50, right: -30 },
  heroRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  heroTitle: { color: C.white, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  heroSubRow:{ flexDirection: "row", alignItems: "center", gap: 6 },
  countBadge:{ backgroundColor: "rgba(255,255,255,0.25)", borderRadius: C.r.pill, paddingHorizontal: 7, paddingVertical: 2 },
  countTxt:  { color: C.white, fontSize: 11, fontWeight: "900" },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600" },
  addBtn: { width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center", marginTop: 4 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: C.r.md, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 13, color: C.white, fontWeight: "600" },

  list: { paddingHorizontal: 14, paddingTop: 14 },

  letterHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, marginTop: 4 },
  letterTxt:    { fontSize: 12, fontWeight: "900", color: C.inkSoft },
  // ← fond neutre (était C.cardBorder vert pâle)
  letterBadge:  { backgroundColor: "#EEEEEE", borderRadius: C.r.pill, paddingHorizontal: 6, paddingVertical: 1 },
  letterCount:  { fontSize: 9, fontWeight: "900", color: C.inkMid },

  empty:       { alignItems: "center", paddingVertical: 50, gap: 6 },
  emptyIconBox:{
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },
  emptyTitle:  { color: C.ink, fontSize: 16, fontWeight: "700" },
  emptySub:    { color: C.inkSoft, fontSize: 12, fontWeight: "600", textAlign: "center" },
  emptyBtn:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: C.greenPale, borderRadius: C.r.md, paddingHorizontal: 18, paddingVertical: 11, borderWidth: 1, borderColor: C.greenBorder },
  emptyBtnTxt: { color: C.green, fontWeight: "800", fontSize: 13 },

  // ← FAB : ombre neutre (était ombre verte)
  fab: {
    position: "absolute", bottom: 90, right: 18,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.green,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10 },
      android: { elevation: 7 },
    }),
  },
});