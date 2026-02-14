//apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

type RatePair =
  | "EUR_XOF"
  | "USD_XOF"
  | "XOF_GNF"
  | "EUR_GNF"
  | "USD_GNF"
  | "EUR_USD";

type StandardPairItem = {
  pair: RatePair;
  label: string;
};

type DbRate = {
  pair: RatePair;
  rate: number;
  updatedAt?: string | null;
};

type RateItem = {
  pair: RatePair;
  label: string;
  rate: number; // 0 => pas configuré
  lastUpdate: string | null;
};

// Liste des paires standard à surveiller
const STANDARD_PAIRS: StandardPairItem[] = [
  { pair: "EUR_XOF", label: "Euro -> CFA" },
  { pair: "USD_XOF", label: "Dollar -> CFA" },
  { pair: "XOF_GNF", label: "CFA -> Franc Guinéen" },
  { pair: "EUR_GNF", label: "Euro -> Franc Guinéen" },
  { pair: "USD_GNF", label: "Dollar -> Franc Guinéen" },
  { pair: "EUR_USD", label: "Euro -> Dollar" },
];

function safeSplitPair(pair: string): { from: string; to: string } {
  const [from, to] = pair.split("_");
  return { from: from ?? "", to: to ?? "" };
}

export default function AdminRatesScreen() {
  const router = useRouter();

  const [rates, setRates] = useState<RateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPair, setSelectedPair] = useState<RateItem | null>(null);
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRates = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // ✅ IMPORTANT :
      // - ce code suppose que api.getExchangeRates() existe et renvoie un tableau
      // - si ton API renvoie { data: [] }, adapte dans services/api.ts
      const dbRatesUnknown = await api.getExchangeRates();

      const dbRates: DbRate[] = Array.isArray(dbRatesUnknown)
        ? (dbRatesUnknown as DbRate[])
        : [];

      const mergedList: RateItem[] = STANDARD_PAIRS.map((std) => {
        const found = dbRates.find((r) => r.pair === std.pair);
        return {
          ...std,
          rate: found?.rate ?? 0,
          lastUpdate: found?.updatedAt ?? null,
        };
      });

      setRates(mergedList);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger les taux");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ FIX: ne pas retourner de Promise dans useFocusEffect
  useFocusEffect(
    useCallback(() => {
      void loadRates();
      // pas de return => OK pour EffectCallback
    }, [loadRates]),
  );

  const handleEdit = (item: RateItem) => {
    setSelectedPair(item);
    setNewRate(item.rate > 0 ? String(item.rate) : "");
    setModalVisible(true);
  };

  const saveRate = async (): Promise<void> => {
    if (!selectedPair) return;

    const trimmed = newRate.trim().replace(",", ".");
    const val = Number(trimmed);

    if (!Number.isFinite(val) || val <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un taux valide");
      return;
    }

    setSaving(true);
    try {
      // ✅ IMPORTANT : api.updateExchangeRate(pair, rate) doit exister
      await api.updateExchangeRate(selectedPair.pair, val);
      setModalVisible(false);
      void loadRates();
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: RateItem }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.pairLabel}>{item.label}</Text>
        <Text style={styles.pairCode}>{item.pair}</Text>
        {item.lastUpdate ? (
          <Text style={styles.lastUpdate}>
            Maj: {new Date(item.lastUpdate).toLocaleDateString("fr-FR")}
          </Text>
        ) : null}
      </View>

      <View style={styles.rateContainer}>
        <Text style={styles.rateValue}>
          {item.rate > 0 ? item.rate : "Par défaut"}
        </Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const pairInfo = selectedPair ? safeSplitPair(selectedPair.pair) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuration des Taux</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={rates}
          keyExtractor={(item) => item.pair}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20 }}
          ListHeaderComponent={
            <Text style={styles.notice}>
              Définissez ici les taux de conversion. Si un taux est à 0, le
              système utilisera une valeur par défaut.
            </Text>
          }
        />
      )}

      {/* MODAL EDIT */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le Taux</Text>

            <Text style={styles.modalSubTitle}>
              {selectedPair?.label} ({selectedPair?.pair})
            </Text>

            <Text style={styles.inputLabel}>
              1 {pairInfo?.from} vaut combien de {pairInfo?.to} ?
            </Text>

            <TextInput
              style={styles.input}
              value={newRate}
              onChangeText={setNewRate}
              keyboardType="numeric"
              placeholder="Ex: 655.957"
              autoFocus
            />

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveRate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveText}>ENREGISTRER</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: "#666" }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    backgroundColor: "#1E293B",
    padding: 20,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },

  notice: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 18,
  },

  card: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  info: { flex: 1 },
  pairLabel: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  pairCode: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    fontWeight: "bold",
  },
  lastUpdate: { fontSize: 11, color: "#94A3B8", marginTop: 4 },

  rateContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  rateValue: { fontSize: 18, fontWeight: "800", color: "#059669" },
  editBtn: { backgroundColor: colors.primary, padding: 8, borderRadius: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 5,
  },
  modalSubTitle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F3F4F6",
    width: "100%",
    padding: 15,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  saveBtn: {
    backgroundColor: colors.primary,
    width: "100%",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  saveText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  cancelBtn: { padding: 10 },
});
