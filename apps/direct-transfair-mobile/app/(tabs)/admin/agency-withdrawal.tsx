// apps/direct-transfair-mobile/app/(tabs)/admin/agency-withdrawal.tsx
// =========================================================
// AGENCY WITHDRAWAL (ADMIN) v1.0 — Direct Transf'air
// Fichier indépendant — nouvel écran, ne modifie aucun écran admin
// existant (agencies, treasury, fees, settings, wallet-clients
// restent strictement inchangés).
//
// Formulaire admin : sélection d'agence + libellé (obligatoire) +
// montant, pas de sélection de devise (une agence = une devise,
// dérivée automatiquement côté backend). Appelle
// api.adminCollectFromAgency() → POST /transactions/agency/collect
// (backend : agency-treasury.controller.ts, protégé par AdminGuard).
//
// Même traitement de héro (dégradé sombre heroFrom → heroTo) que le
// Client Dashboard / beneficiaries/create.tsx v6.5 / send.tsx v2.14.
// =========================================================

import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar,
  Modal, FlatList, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../services/api";

const C = {
  purple: "#7C3AED",
  purplePale: "#F5F3FF",
  purpleBorder: "#DDD6FE",
  heroFrom: "#0A0F0D",
  heroTo: "#123324",
  heroGlass: "rgba(255,255,255,0.08)",
  heroGlassBdr: "rgba(255,255,255,0.14)",
  heroDim: "rgba(255,255,255,0.65)",
  heroGlow: "rgba(23,164,95,0.16)",
  pageBg: "#FAFAFA",
  white: "#FFFFFF",
  cardBorder: "#E5E5EA",
  ink: "#0D2B1F",
  inkMid: "#1F5C3A",
  inkSoft: "#6B9E85",
  red: "#EF4444",
  r: { sm: 12, md: 14, lg: 18, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function agencyCurrency(agency: any): string {
  const wallets = Array.isArray(agency?.wallets) ? agency.wallets : [];
  const primary = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  return primary?.currency ?? agency?.primaryCurrency ?? "XOF";
}

function agencyBalance(agency: any): number {
  const wallets = Array.isArray(agency?.wallets) ? agency.wallets : [];
  const primary = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  return Number(primary?.balance ?? agency?.balance ?? 0);
}

export default function AgencyWithdrawalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<any | null>(null);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencySearch, setAgencySearch] = useState("");

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.getAgencies();
      setAgencies(Array.isArray(list) ? list : []);
    } catch { setAgencies([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const currency = selectedAgency ? agencyCurrency(selectedAgency) : null;
  const numericAmount = parseFloat(amount.replace(/\s/g, "").replace(",", ".")) || 0;
  const canSubmit = !!selectedAgency && numericAmount > 0 && note.trim().length > 0 && !submitting;

  const filteredAgencies = agencies.filter((a) =>
    !agencySearch.trim() || (a.name ?? "").toLowerCase().includes(agencySearch.toLowerCase()),
  );

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAgency) return;
    setSubmitting(true);
    try {
      await api.adminCollectFromAgency(selectedAgency.id, numericAmount, note.trim());
      Alert.alert(
        "✅ Retrait effectué",
        `${fmt(numericAmount, currency ?? "XOF")} ${currency} retirés depuis ${selectedAgency.name}.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Une erreur est survenue.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.heroFrom} />

      <LinearGradient
        colors={[C.heroFrom, C.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.glow} pointerEvents="none" />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={18} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Retrait Agence</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>Retirer des fonds vers votre compte</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={s.sheet}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View style={s.secRow}>
              <View style={s.secDot} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>AGENCE</Text>
            </View>
            <TouchableOpacity
              style={s.card}
              onPress={() => setShowAgencyModal(true)}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.purple} />
              ) : selectedAgency ? (
                <View style={s.selectedAgencyRow}>
                  <View style={s.agencyIconBox}>
                    <Ionicons name="storefront-outline" size={18} color={C.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.agencyName, { fontFamily: C.font.sans }]}>{selectedAgency.name}</Text>
                    <Text style={[s.agencyMeta, { fontFamily: C.font.sans }]}>
                      {selectedAgency.city || "—"} · Solde : {fmt(agencyBalance(selectedAgency), agencyCurrency(selectedAgency))} {agencyCurrency(selectedAgency)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.inkSoft} />
                </View>
              ) : (
                <View style={s.selectedAgencyRow}>
                  <View style={s.agencyIconBox}>
                    <Ionicons name="storefront-outline" size={18} color={C.inkSoft} />
                  </View>
                  <Text style={[s.placeholderTxt, { fontFamily: C.font.sans }]}>Sélectionner une agence…</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.inkSoft} />
                </View>
              )}
            </TouchableOpacity>

            <View style={s.secRow}>
              <View style={s.secDot} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>LIBELLÉ <Text style={{ color: C.red, fontSize: 10 }}>*</Text></Text>
            </View>
            <View style={s.card}>
              <TextInput
                style={[s.noteInput, { fontFamily: C.font.sans }]}
                value={note}
                onChangeText={setNote}
                placeholder="Ex : Reversement trésorerie mensuel"
                placeholderTextColor={C.inkSoft}
                multiline
                editable={!submitting}
              />
            </View>

            <View style={s.secRow}>
              <View style={s.secDot} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MONTANT</Text>
            </View>
            <View style={s.card}>
              <View style={s.amountRow}>
                <TextInput
                  style={[s.amountInput, { fontFamily: C.font.serif }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.inkSoft}
                  editable={!submitting}
                />
                <View style={s.currBadge}>
                  <Text style={[s.currTxt, { fontFamily: C.font.sans }]}>{currency ?? "—"}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[s.cta, !canSubmit && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.88}
            >
              {submitting ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Ionicons name="arrow-down-circle-outline" size={17} color={C.white} />
                  <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>EFFECTUER LE RETRAIT</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={showAgencyModal} animationType="slide" transparent onRequestClose={() => { setShowAgencyModal(false); setAgencySearch(""); }}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <View style={m.head}>
              <Text style={[m.title, { fontFamily: C.font.serif }]}>Choisir une agence</Text>
              <TouchableOpacity style={m.closeBtn} onPress={() => { setShowAgencyModal(false); setAgencySearch(""); }}>
                <Ionicons name="close" size={16} color={C.inkSoft} />
              </TouchableOpacity>
            </View>
            <View style={m.search}>
              <Ionicons name="search" size={13} color={C.inkSoft} />
              <TextInput
                style={[m.searchInput, { fontFamily: C.font.sans }]}
                value={agencySearch}
                onChangeText={setAgencySearch}
                placeholder="Rechercher une agence…"
                placeholderTextColor={C.inkSoft}
                underlineColorAndroid="transparent"
              />
              {!!agencySearch && (
                <TouchableOpacity onPress={() => setAgencySearch("")}>
                  <Ionicons name="close" size={13} color={C.inkSoft} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredAgencies}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={m.item}
                  onPress={() => { setSelectedAgency(item); setShowAgencyModal(false); setAgencySearch(""); }}
                >
                  <View style={m.itemIconBox}>
                    <Ionicons name="storefront-outline" size={16} color={C.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[m.itemName, { fontFamily: C.font.sans }]}>{item.name}</Text>
                    <Text style={[m.itemMeta, { fontFamily: C.font.sans }]}>
                      {item.city || "—"} · {fmt(agencyBalance(item), agencyCurrency(item))} {agencyCurrency(item)}
                    </Text>
                  </View>
                  {selectedAgency?.id === item.id && <Ionicons name="checkmark" size={16} color={C.purple} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[m.empty, { fontFamily: C.font.sans }]}>Aucune agence trouvée</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.heroFrom },

  hero: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 18, paddingBottom: 44, overflow: "hidden",
  },
  glow: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -55, right: -35 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroTitle: { color: C.white, fontSize: 20, fontWeight: "700" },
  heroSub: { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },

  sheet: { flex: 1, backgroundColor: C.pageBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  secRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  secDot: { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: C.purple },
  secLbl: { fontSize: 9, fontWeight: "900", color: C.inkMid, letterSpacing: 1.2 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder, minHeight: 58, justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },

  selectedAgencyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  agencyIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.purplePale, justifyContent: "center", alignItems: "center" },
  agencyName: { fontSize: 14, fontWeight: "800", color: C.ink },
  agencyMeta: { fontSize: 11, color: C.inkSoft, fontWeight: "600", marginTop: 2 },
  placeholderTxt: { flex: 1, fontSize: 13, color: C.inkSoft, fontWeight: "600" },

  noteInput: { fontSize: 14, color: C.ink, minHeight: 44, textAlignVertical: "top" },

  amountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amountInput: { flex: 1, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  currBadge: { backgroundColor: C.purplePale, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  currTxt: { fontSize: 13, fontWeight: "900", color: C.purple, letterSpacing: 0.5 },

  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.purple, borderRadius: C.r.md, paddingVertical: 16, marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: C.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  ctaTxt: { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle: { width: 32, height: 3, borderRadius: C.r.pill, backgroundColor: "#DDDDDD", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title: { color: C.ink, fontSize: 16, fontWeight: "700" },
  closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, backgroundColor: "#F8F8F8", borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: C.ink, fontWeight: "600" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  itemIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.purplePale, justifyContent: "center", alignItems: "center" },
  itemName: { fontSize: 13, fontWeight: "700", color: C.ink },
  itemMeta: { fontSize: 11, color: C.inkSoft, fontWeight: "600", marginTop: 2 },
  empty: { color: C.inkSoft, textAlign: "center", padding: 24, fontWeight: "600" },
});