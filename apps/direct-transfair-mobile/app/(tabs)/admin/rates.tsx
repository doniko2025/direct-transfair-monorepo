// apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
// =========================================================
// RATES v5.0 — Direct Transf'air · Thème CLAIR
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

const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  blue:     "#1956F0",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  white:    "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:     Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

const STANDARD_PAIRS = [
  { pair: "EUR_XOF", label: "Euro → CFA",            from: "EUR", to: "XOF", color: "#1956F0", bgColor: "#EEF2FF" },
  { pair: "USD_XOF", label: "Dollar → CFA",           from: "USD", to: "XOF", color: "#16A34A", bgColor: "#DCFCE7" },
  { pair: "GBP_XOF", label: "Livre → CFA",            from: "GBP", to: "XOF", color: "#7C3AED", bgColor: "#EDE9FE" },
  { pair: "EUR_GNF", label: "Euro → Franc Guinéen",   from: "EUR", to: "GNF", color: "#1956F0", bgColor: "#EEF2FF" },
  { pair: "USD_GNF", label: "Dollar → Franc Guinéen", from: "USD", to: "GNF", color: "#16A34A", bgColor: "#DCFCE7" },
  { pair: "GBP_GNF", label: "Livre → Franc Guinéen",  from: "GBP", to: "GNF", color: "#7C3AED", bgColor: "#EDE9FE" },
  { pair: "XOF_GNF", label: "CFA → Franc Guinéen",    from: "XOF", to: "GNF", color: "#D97706", bgColor: "#FEF3C7" },
  { pair: "EUR_USD", label: "Euro → Dollar",           from: "EUR", to: "USD", color: "#0F766E", bgColor: "#CCFBF1" },
  { pair: "GBP_EUR", label: "Livre → Euro",            from: "GBP", to: "EUR", color: "#7C3AED", bgColor: "#EDE9FE" },
  { pair: "GBP_USD", label: "Livre → Dollar",          from: "GBP", to: "USD", color: "#DC2626", bgColor: "#FEE2E2" },
];

function RateCard({ item, accent, onEdit }: { item: any; accent: string; onEdit: () => void }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const hasRate  = item.rate > 0;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={rcS.card}
        onPress={onEdit}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        {/* Barre colorée gauche */}
        <View style={[rcS.colorBar, { backgroundColor: item.color }]} />

        <View style={[rcS.iconBox, { backgroundColor: item.bgColor }]}>
          <Text style={{ fontSize: 18 }}>
            {item.from === "EUR" ? "🇪🇺" : item.from === "USD" ? "🇺🇸" : item.from === "GBP" ? "🇬🇧" : item.from === "GNF" ? "🇬🇳" : "🌍"}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[rcS.label, { fontFamily: T.font.sans }]}>{item.label}</Text>
          <Text style={[rcS.pairCode, { color: item.color, fontFamily: T.font.mono }]}>
            {item.from} → {item.to}
          </Text>
          {item.lastUpdate && (
            <Text style={[rcS.updated, { fontFamily: T.font.sans }]}>
              {new Date(item.lastUpdate).toLocaleDateString("fr-FR")}
            </Text>
          )}
        </View>

        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={[rcS.rate, { color: hasRate ? T.ink : T.inkMuted, fontFamily: T.font.display }]}>
            {hasRate ? item.rate.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) : "—"}
          </Text>
          <View style={[rcS.editBtn, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
            <Ionicons name="pencil" size={13} color={accent} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rcS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    overflow: "hidden",
  },
  colorBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", marginLeft: 4 },
  label:   { color: T.ink,     fontSize: 13, fontWeight: "700", marginBottom: 3 },
  pairCode:{ fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 2 },
  updated: { color: T.inkMuted, fontSize: 10, fontWeight: "600" },
  rate:    { fontSize: 20, fontWeight: "800" },
  editBtn: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1 },
});

export default function AdminRatesScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const accent   = user?.role === "SUPER_ADMIN" ? T.blue : T.green;

  const [rates,        setRates]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedPair, setSelectedPair] = useState<any>(null);
  const [newRate,      setNewRate]      = useState("");
  const [saving,       setSaving]       = useState(false);
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
    <SafeAreaView style={rS.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      <View style={rS.header}>
        <TouchableOpacity style={rS.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[rS.headerTitle, { fontFamily: T.font.display }]}>Gestion des Devises</Text>
          <Text style={[rS.headerSub, { color: accent, fontFamily: T.font.sans }]}>
            {STANDARD_PAIRS.length} paires de change
          </Text>
        </View>
        <TouchableOpacity style={[rS.iconBtn, { backgroundColor: `${accent}12` }]} onPress={() => void loadRates()}>
          <Ionicons name="refresh" size={19} color={accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={rates}
          keyExtractor={(item) => item.pair}
          contentContainerStyle={rS.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[rS.noticeBox, { borderColor: `${accent}25`, backgroundColor: `${accent}08` }]}>
              <Ionicons name="information-circle-outline" size={16} color={accent} />
              <Text style={[rS.noticeTxt, { color: accent, fontFamily: T.font.sans }]}>
                Un taux à 0 utilise le taux marché par défaut. Appuyez sur une paire pour modifier.
              </Text>
            </View>
          }
          renderItem={({ item }) => <RateCard item={item} accent={accent} onEdit={() => handleEdit(item)} />}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* Modal Edit */}
      <Modal visible={!!selectedPair} transparent animationType="slide" onRequestClose={() => setSelectedPair(null)}>
        <View style={rS.overlay}>
          <View style={rS.editSheet}>
            <View style={rS.editHandle} />

            <View style={[rS.editColorBar, { backgroundColor: selectedPair?.color ?? accent }]} />
            <Text style={[rS.editTitle, { fontFamily: T.font.display }]}>Modifier le taux</Text>
            <Text style={[rS.editLabel, { color: selectedPair?.color ?? accent, fontFamily: T.font.sans }]}>
              {selectedPair?.label}
            </Text>

            <View style={rS.inputRow}>
              <View style={rS.inputPrefix}>
                <Text style={[rS.inputPrefixTxt, { fontFamily: T.font.sans }]}>1 {selectedPair?.from} =</Text>
              </View>
              <TextInput
                style={[rS.rateInput, { color: selectedPair?.color ?? T.ink, fontFamily: T.font.display }]}
                value={newRate}
                onChangeText={setNewRate}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={T.inkMuted}
                autoFocus
              />
              <View style={rS.inputSuffix}>
                <Text style={[rS.inputSuffixTxt, { fontFamily: T.font.sans }]}>{selectedPair?.to}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[rS.saveBtn, { backgroundColor: selectedPair?.color ?? accent }, saving && { opacity: 0.7 }]}
              onPress={saveRate}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={T.white} />
                : <Text style={[rS.saveTxt, { fontFamily: T.font.sans }]}>SAUVEGARDER</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={rS.cancelBtn} onPress={() => setSelectedPair(null)}>
              <Text style={[rS.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const rS = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 11, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.ink, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  list: { padding: 14 },
  noticeBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: T.radius.md, padding: 14, borderWidth: 1, marginBottom: 16,
  },
  noticeTxt: { flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  editSheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 28,
    alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  editHandle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, marginBottom: 24 },
  editColorBar: { width: 48, height: 4, borderRadius: 99, marginBottom: 16 },
  editTitle: { color: T.ink, fontSize: 22, fontWeight: "700", marginBottom: 6 },
  editLabel: { fontSize: 13, fontWeight: "800", marginBottom: 24 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, overflow: "hidden", width: "100%", marginBottom: 24,
  },
  inputPrefix: { paddingHorizontal: 14, paddingVertical: 16, backgroundColor: T.pageBg, borderRightWidth: 1, borderRightColor: T.border },
  inputPrefixTxt: { color: T.inkSub, fontSize: 13, fontWeight: "800" },
  rateInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 16, fontSize: 26, fontWeight: "900", textAlign: "center" },
  inputSuffix: { paddingHorizontal: 14, paddingVertical: 16, backgroundColor: T.pageBg, borderLeftWidth: 1, borderLeftColor: T.border },
  inputSuffixTxt: { color: T.inkSub, fontSize: 13, fontWeight: "800" },
  saveBtn: { width: "100%", borderRadius: T.radius.md, paddingVertical: 17, alignItems: "center", marginBottom: 8 },
  saveTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  cancelBtn: { paddingVertical: 14 },
  cancelTxt: { color: T.inkSub, fontWeight: "700", fontSize: 14 },
});