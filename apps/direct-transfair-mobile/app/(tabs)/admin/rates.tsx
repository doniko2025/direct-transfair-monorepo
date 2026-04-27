//apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, SafeAreaView, Platform, StatusBar } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF" },
  AGENT: { primary: "#78350F", light: "#FFF7ED" },
  USER: { primary: "#059669", light: "#ECFDF5" },
};

type RatePair = "EUR_XOF" | "USD_XOF" | "XOF_GNF" | "EUR_GNF" | "USD_GNF" | "EUR_USD";

const STANDARD_PAIRS: { pair: RatePair; label: string }[] = [
  { pair: "EUR_XOF", label: "Euro -> CFA" },
  { pair: "USD_XOF", label: "Dollar -> CFA" },
  { pair: "XOF_GNF", label: "CFA -> Franc Guinéen" },
  { pair: "EUR_GNF", label: "Euro -> Franc Guinéen" },
  { pair: "USD_GNF", label: "Dollar -> Franc Guinéen" },
  { pair: "EUR_USD", label: "Euro -> Dollar" },
];

export default function AdminRatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;

  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPair, setSelectedPair] = useState<any | null>(null);
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRates = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const dbRatesUnknown = await api.getExchangeRates();
      const dbRates = Array.isArray(dbRatesUnknown) ? dbRatesUnknown : [];

      const mergedList = STANDARD_PAIRS.map((std) => {
        const found = dbRates.find((r) => r.pair === std.pair);
        return { ...std, rate: found?.rate ?? 0, lastUpdate: found?.updatedAt ?? null };
      });
      setRates(mergedList);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger les taux");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadRates(); }, [loadRates]));

  const handleEdit = (item: any) => {
    setSelectedPair(item);
    setNewRate(item.rate > 0 ? String(item.rate) : "");
    setModalVisible(true);
  };

  const saveRate = async (): Promise<void> => {
    if (!selectedPair) return;
    const val = Number(newRate.trim().replace(",", "."));

    if (!Number.isFinite(val) || val <= 0) {
      return Alert.alert("Erreur", "Veuillez entrer un taux valide");
    }

    setSaving(true);
    try {
      await api.updateExchangeRate(selectedPair.pair, val);
      setModalVisible(false);
      void loadRates();
    } catch (e) {
      Alert.alert("Erreur", "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={s.card}>
      <View style={s.info}>
        <Text style={s.pairLabel}>{item.label}</Text>
        <View style={s.pairCodeBox}>
            <Text style={[s.pairCode, {color: theme.primary}]}>{item.pair.replace("_", " ➔ ")}</Text>
        </View>
        {item.lastUpdate && (
          <Text style={s.lastUpdate}>Maj: {new Date(item.lastUpdate).toLocaleDateString("fr-FR")}</Text>
        )}
      </View>

      <View style={s.rateContainer}>
        <Text style={[s.rateValue, item.rate === 0 && { color: '#94A3B8', fontSize: 13, fontWeight: '600' }]}>
          {item.rate > 0 ? item.rate.toLocaleString('fr-FR') : "Par défaut"}
        </Text>
        <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.light }]} onPress={() => handleEdit(item)}>
          <Ionicons name="pencil" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const pairInfo = selectedPair ? { from: selectedPair.pair.split("_")[0], to: selectedPair.pair.split("_")[1] } : null;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      <View style={[s.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Gestion des Devises</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.container}>
        {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : (
            <FlatList
            data={rates}
            keyExtractor={(item) => item.pair}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            ListHeaderComponent={
                <View style={[s.noticeBox, { backgroundColor: theme.light, borderColor: theme.primary + '30' }]}>
                    <Ionicons name="information-circle" size={20} color={theme.primary} />
                    <Text style={[s.notice, { color: theme.primary }]}>
                    Si un taux est défini à 0, la plateforme utilisera le taux du marché par défaut.
                    </Text>
                </View>
            }
            />
        )}
      </View>

      {/* MODAL EDIT */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalDrag} />
            <Text style={s.modalTitle}>Ajuster le Taux</Text>
            <Text style={[s.modalSubTitle, { color: theme.primary }]}>{selectedPair?.label}</Text>

            <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>1 {pairInfo?.from} =</Text>
                <TextInput
                    style={s.input}
                    value={newRate}
                    onChangeText={setNewRate}
                    keyboardType="decimal-pad"
                    placeholder="Ex: 655.95"
                    placeholderTextColor="#CBD5E1"
                    autoFocus
                />
                <Text style={s.inputLabel}>{pairInfo?.to}</Text>
            </View>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.8 }]} onPress={saveRate} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveText}>SAUVEGARDER LE TAUX</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#FFF", fontSize: 20, fontFamily: FONTS.heading, fontWeight: "800" },
  backBtn: { padding: 4 },

  container: { flex: 1, backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  list: { padding: 24, paddingBottom: 60 },

  noticeBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1 },
  notice: { flex: 1, fontFamily: FONTS.body, fontSize: 12, fontWeight: '600', marginLeft: 10, lineHeight: 18 },

  card: { backgroundColor: "#FFF", padding: 20, borderRadius: 20, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  info: { flex: 1 },
  pairLabel: { fontSize: 15, fontFamily: FONTS.body, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  pairCodeBox: { alignSelf: 'flex-start', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 4 },
  pairCode: { fontSize: 10, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 0.5 },
  lastUpdate: { fontSize: 11, fontFamily: FONTS.body, color: "#94A3B8", fontWeight: "600" },

  rateContainer: { flexDirection: "row", alignItems: "center", gap: 14 },
  rateValue: { fontSize: 22, fontFamily: FONTS.heading, fontWeight: "900", color: "#1E293B" },
  editBtn: { padding: 10, borderRadius: 12 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFF", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, alignItems: "center" },
  modalDrag: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  modalSubTitle: { fontSize: 14, fontFamily: FONTS.body, fontWeight: "700", marginBottom: 24 },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, paddingHorizontal: 20, width: '100%', marginBottom: 30 },
  inputLabel: { fontSize: 16, fontFamily: FONTS.body, color: "#64748B", fontWeight: "800" },
  input: { flex: 1, paddingVertical: 20, fontSize: 32, fontFamily: FONTS.heading, fontWeight: "900", textAlign: "center", color: "#0F172A" },
  
  saveBtn: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  saveText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
  cancelBtn: { marginTop: 16, padding: 10 },
  cancelText: { color: "#64748B", fontFamily: FONTS.body, fontWeight: "700", fontSize: 15 },
});