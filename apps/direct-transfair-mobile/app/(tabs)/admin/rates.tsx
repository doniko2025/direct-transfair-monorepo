//apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
// =========================================================
// RATES SCREEN v4.0 — Direct Transf'air
// Design: Thème dynamique + carrousel 5 devises visuelles
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, SafeAreaView, Platform, StatusBar, Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  inkBorder: "rgba(255,255,255,0.08)",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STANDARD_PAIRS = [
  { pair: "EUR_XOF", label: "Euro → CFA",           from: "EUR", to: "XOF", color: "#60A5FA" },
  { pair: "USD_XOF", label: "Dollar → CFA",          from: "USD", to: "XOF", color: "#34D399" },
  { pair: "GBP_XOF", label: "Livre → CFA",           from: "GBP", to: "XOF", color: "#A78BFA" },
  { pair: "EUR_GNF", label: "Euro → Franc Guinéen",  from: "EUR", to: "GNF", color: "#60A5FA" },
  { pair: "USD_GNF", label: "Dollar → Franc Guinéen",from: "USD", to: "GNF", color: "#34D399" },
  { pair: "GBP_GNF", label: "Livre → Franc Guinéen", from: "GBP", to: "GNF", color: "#A78BFA" },
  { pair: "XOF_GNF", label: "CFA → Franc Guinéen",   from: "XOF", to: "GNF", color: "#D4A853" },
  { pair: "EUR_USD", label: "Euro → Dollar",          from: "EUR", to: "USD", color: "#F87171" },
  { pair: "GBP_EUR", label: "Livre → Euro",           from: "GBP", to: "EUR", color: "#A78BFA" },
  { pair: "GBP_USD", label: "Livre → Dollar",         from: "GBP", to: "USD", color: "#A78BFA" },
];

function RateCard({ item, accent, onEdit }: { item: any; accent: string; onEdit: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const hasRate = item.rate > 0;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={rcS.card}
        onPress={onEdit}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={rcS.left}>
          <View style={[rcS.colorBar, { backgroundColor: item.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={[rcS.label, { fontFamily: T.font.sans }]}>{item.label}</Text>
            <View style={rcS.pairBox}>
              <Text style={[rcS.pairCode, { color: item.color, fontFamily: T.font.mono }]}>
                {item.from} → {item.to}
              </Text>
            </View>
            {item.lastUpdate && (
              <Text style={[rcS.updated, { fontFamily: T.font.sans }]}>
                Mis à jour le {new Date(item.lastUpdate).toLocaleDateString("fr-FR")}
              </Text>
            )}
          </View>
        </View>

        <View style={rcS.right}>
          <Text style={[
            rcS.rate,
            { color: hasRate ? T.white : T.dim, fontFamily: T.font.display },
          ]}>
            {hasRate ? item.rate.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) : "Défaut"}
          </Text>
          <View style={[rcS.editBtn, { backgroundColor: `${accent}15`, borderColor: `${accent}25` }]}>
            <Ionicons name="pencil" size={14} color={accent} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rcS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 10,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  colorBar: { width: 3, height: 40, borderRadius: 99 },
  label: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  pairBox: {},
  pairCode: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  updated: { color: T.dim, fontSize: 10, fontWeight: "600", marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  rate: { fontSize: 20, fontWeight: "800" },
  editBtn: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
});

export default function AdminRatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<any>(null);
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const dbRates = await api.getExchangeRates().then((r) => (Array.isArray(r) ? r : []));
      const merged = STANDARD_PAIRS.map((std) => {
        const found = dbRates.find((r: any) => r.pair === std.pair);
        return { ...std, rate: Number(found?.rate ?? 0), lastUpdate: found?.updatedAt ?? null };
      });
      setRates(merged);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { Alert.alert("Erreur", "Impossible de charger les taux"); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadRates(); }, [loadRates]));

  const handleEdit = (item: any) => { setSelectedPair(item); setNewRate(item.rate > 0 ? String(item.rate) : ""); };

  const saveRate = async () => {
    if (!selectedPair) return;
    const val = Number(String(newRate).replace(",", ".").trim());
    if (!isFinite(val) || val <= 0) { Alert.alert("Erreur", "Taux invalide"); return; }
    setSaving(true);
    try {
      await api.updateExchangeRate(selectedPair.pair, val);
      setSelectedPair(null);
      void loadRates();
    } catch { Alert.alert("Erreur", "Échec de la mise à jour"); }
    finally { setSaving(false); }
  };

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Gestion des Devises</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {STANDARD_PAIRS.length} paires de change
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => void loadRates()}>
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <Animated.FlatList
            style={{ opacity: fadeAnim }}
            data={rates}
            keyExtractor={(item) => item.pair}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={s.noticeBox}>
                <Ionicons name="information-circle-outline" size={16} color={theme.accent} />
                <Text style={[s.noticeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                  Un taux à 0 utilise le taux marché par défaut. Appuyez sur une paire pour modifier.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <RateCard item={item} accent={theme.accent} onEdit={() => handleEdit(item)} />
            )}
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        )}

        {/* Modal Edit */}
        <Modal visible={!!selectedPair} transparent animationType="fade" onRequestClose={() => setSelectedPair(null)}>
          <View style={s.overlay}>
            <View style={s.editSheet}>
              <View style={s.editHandle} />

              <View style={[s.editColorBar, { backgroundColor: selectedPair?.color ?? theme.accent }]} />

              <Text style={[s.editTitle, { fontFamily: T.font.display }]}>Modifier le taux</Text>
              <Text style={[s.editLabel, { color: selectedPair?.color ?? theme.accent, fontFamily: T.font.sans }]}>
                {selectedPair?.label}
              </Text>

              <View style={s.inputRow}>
                <View style={s.inputPrefix}>
                  <Text style={[s.inputPrefixTxt, { fontFamily: T.font.sans }]}>1 {selectedPair?.from} =</Text>
                </View>
                <TextInput
                  style={[s.rateInput, { fontFamily: T.font.display, color: selectedPair?.color ?? T.white }]}
                  value={newRate}
                  onChangeText={setNewRate}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={T.dim + "60"}
                  autoFocus
                />
                <View style={s.inputSuffix}>
                  <Text style={[s.inputSuffixTxt, { fontFamily: T.font.sans }]}>{selectedPair?.to}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: selectedPair?.color ?? theme.accent }, saving && { opacity: 0.7 }]}
                onPress={saveRate}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#000" />
                  : <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>SAUVEGARDER</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={s.cancelBtn} onPress={() => setSelectedPair(null)}>
                <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  list: { paddingHorizontal: 20 },
  noticeBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: T.ghost, borderRadius: T.radius.md, padding: 14,
    borderWidth: 1, borderColor: T.inkBorder, marginBottom: 16,
  },
  noticeTxt: { flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 16 },

  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  editSheet: {
    backgroundColor: "#0C0C16", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 28,
    alignItems: "center", borderWidth: 1, borderColor: T.inkBorder,
  },
  editHandle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, marginBottom: 24 },
  editColorBar: { width: 48, height: 4, borderRadius: 99, marginBottom: 16 },
  editTitle: { color: T.white, fontSize: 22, fontWeight: "700", marginBottom: 6 },
  editLabel: { fontSize: 13, fontWeight: "800", marginBottom: 24 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, overflow: "hidden",
    width: "100%", marginBottom: 24,
  },
  inputPrefix: {
    paddingHorizontal: 14, paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.04)", borderRightWidth: 1, borderRightColor: T.inkBorder,
  },
  inputPrefixTxt: { color: T.dim, fontSize: 13, fontWeight: "800" },
  rateInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 16, fontSize: 26, fontWeight: "900", textAlign: "center" },
  inputSuffix: {
    paddingHorizontal: 14, paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.04)", borderLeftWidth: 1, borderLeftColor: T.inkBorder,
  },
  inputSuffixTxt: { color: T.dim, fontSize: 13, fontWeight: "800" },
  saveBtn: { width: "100%", borderRadius: T.radius.md, paddingVertical: 17, alignItems: "center", marginBottom: 8 },
  saveTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  cancelBtn: { paddingVertical: 14 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});