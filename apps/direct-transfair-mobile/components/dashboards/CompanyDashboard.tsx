//components/dashboards/CompanyDashboard.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { DashboardLayout, MenuCard } from "./DashboardShared";

function toNumberSafe(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatXof(value: unknown): string {
  const n = toNumberSafe(value);
  return `${n.toLocaleString("fr-FR")} XOF`;
}

function getErrorMessage(err: unknown): string {
  // axios error shape (sans dépendre de axios.isAxiosError ici)
  if (typeof err === "object" && err !== null) {
    const e = err as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      e.response?.data?.message ??
      e.message ??
      "Erreur technique. Réessaie."
    );
  }
  return "Erreur technique. Réessaie.";
}

export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  const title = useMemo(() => user?.client?.name || "Admin", [user?.client?.name]);
  const balanceLabel = useMemo(() => formatXof(user?.balance), [user?.balance]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setAmount("");
    setRefBancaire("");
  };

  const handleSubmitDeclare = async () => {
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      Alert.alert("Montant invalide", "Saisis un montant supérieur à 0.");
      return;
    }

    setProcessing(true);
    try {
      await api.declareBankTransfer(n, refBancaire);
      closeModal();
      Alert.alert("Succès", "Paiement déclaré avec succès !");
      await loadData();
    } catch (e) {
      Alert.alert("Erreur", getErrorMessage(e));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout
      title={title}
      subtitle="Pilotage Société"
      badge="business"
      badgeColor="#F59E0B"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} />
      }
    >
      <View style={[styles.balanceCard, { backgroundColor: "#1E293B" }]}>
        <View style={styles.balanceHeaderRow}>
          <Text style={styles.balanceLabel}>Trésorerie Globale</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/admin/treasury")}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.balanceValue}>{balanceLabel}</Text>

        <TouchableOpacity
          style={styles.fundBtn}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
        >
          <Ionicons name="card-outline" size={20} color="#1E293B" />
          <Text style={styles.fundText}>Payer Facture / Service</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Gestion</Text>

      <View style={styles.grid}>
        <MenuCard
          title="Créer une Agence"
          subtitle="Ajout réseau"
          icon="add-circle"
          color="#8B5CF6"
          onPress={() => router.push("/(tabs)/admin/agencies/create")}
        />

        <View style={styles.row}>
          <MenuCard
            title="Mes Agences"
            subtitle="Liste"
            icon="storefront"
            color="#3B82F6"
            onPress={() => router.push("/(tabs)/admin/agencies")}
            fullWidth={false}
          />
          <MenuCard
            title="Utilisateurs"
            subtitle="Staff"
            icon="people"
            color="#F59E0B"
            onPress={() => router.push("/(tabs)/admin/users")}
            fullWidth={false}
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
          Commissions & Finance
        </Text>

        <View style={styles.row}>
          <MenuCard
            title="Config. Règles"
            subtitle="Taux %"
            icon="settings"
            color="#64748B"
            onPress={() => router.push("/(tabs)/admin/commissions/config")}
            fullWidth={false}
          />
          <MenuCard
            title="Suivi Global"
            subtitle="Audit & Gains"
            icon="pie-chart"
            color="#EF4444"
            onPress={() => router.push("/admin/commissions")}
            fullWidth={false}
          />
        </View>

        <MenuCard
          title="Taux de Change"
          subtitle="Devises & Conversion"
          icon="cash"
          color="#059669"
          onPress={() => router.push("/(tabs)/admin/rates")}
        />
      </View>

      {/* MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Payer une Facture</Text>

              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Montant (FCFA)"
                placeholderTextColor="#9CA3AF"
              />

              <TextInput
                style={styles.input}
                value={refBancaire}
                onChangeText={setRefBancaire}
                placeholder="Référence Virement (optionnel)"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[styles.confirmBtn, processing ? styles.btnDisabled : null]}
                onPress={handleSubmitDeclare}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.confirmText}>VALIDER</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closeModal}
                style={styles.cancelBtn}
                disabled={processing}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  balanceCard: { padding: 20, borderRadius: 18, marginBottom: 10 },
  balanceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: { color: "#94A3B8", fontSize: 12, marginBottom: 4, fontWeight: "500" },
  balanceValue: { color: "#FFF", fontSize: 28, fontWeight: "800", marginBottom: 5 },

  fundBtn: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  fundText: { color: "#1E293B", fontWeight: "700", fontSize: 13, marginLeft: 8 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#374151",
    marginTop: 20,
  },

  grid: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  input: {
    backgroundColor: "#F3F4F6",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    color: "#111827",
  },

  confirmBtn: {
    backgroundColor: "#F59E0B",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  confirmText: { color: "#FFF", fontWeight: "bold" },

  cancelBtn: { alignItems: "center", padding: 10 },
  cancelText: { color: "#6B7280", fontWeight: "600" },
});
