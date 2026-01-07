//apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api"; // Assure-toi que le chemin est bon
import { Transaction } from "../../../services/types";
import { colors } from "../../../theme/colors";

export default function AdminTransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.adminGetTransactions();
      setTransactions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.adminUpdateTransactionStatus(id, newStatus);
      Alert.alert("Succès", `Transaction ${newStatus}`);
      loadTransactions();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de mettre à jour le statut");
    }
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.ref}>{item.reference}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>

      <Text style={styles.amount}>
        {item.amount} {item.currency}
      </Text>
      <Text style={styles.fees}>Frais: {item.fees} {item.currency}</Text>

      <View style={styles.statusRow}>
        <StatusBadge status={item.status} />
      </View>

      {item.status === "PENDING" && (
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnReject]} 
            onPress={() => handleUpdateStatus(item.id, "CANCELLED")}
          >
            <Ionicons name="close" size={16} color="#B00020" />
            <Text style={styles.btnTextReject}>Rejeter</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, styles.btnValidate]}
            onPress={() => handleUpdateStatus(item.id, "VALIDATED")}
          >
            <Ionicons name="checkmark" size={16} color="#FFF" />
            <Text style={styles.btnTextValidate}>Valider</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Interne avec bouton retour */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion Transactions</Text>
        <View style={{width: 24}} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune transaction</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: string }) {
    let color = "#666";
    let bg = "#EEE";
    let label = status;
  
    if (status === "PENDING") { color = "#B45309"; bg = "#FEF3C7"; label = "EN ATTENTE"; }
    else if (status === "VALIDATED") { color = "#065F46"; bg = "#D1FAE5"; label = "VALIDÉE"; }
    else if (status === "PAID") { color = "#115E59"; bg = "#CCFBF1"; label = "PAYÉE"; }
    else if (status === "CANCELLED") { color = "#991B1B"; bg = "#FEE2E2"; label = "ANNULÉE"; }
  
    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { backgroundColor: "#1F2937", padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  
  card: { backgroundColor: "#FFF", padding: 16, marginBottom: 12, borderRadius: 8, elevation: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  ref: { fontSize: 12, color: "#999" },
  date: { fontSize: 12, color: "#999" },
  amount: { fontSize: 20, fontWeight: "800", color: "#000" },
  fees: { fontSize: 12, color: "#666", marginBottom: 8 },
  
  statusRow: { flexDirection: "row", marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  
  actions: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 12, borderRadius: 6 },
  btnReject: { backgroundColor: "#FEE2E2" },
  btnValidate: { backgroundColor: "#10B981" },
  btnTextReject: { color: "#B00020", fontWeight: "700", marginLeft: 6 },
  btnTextValidate: { color: "#FFF", fontWeight: "700", marginLeft: 6 },
  
  empty: { textAlign: "center", marginTop: 40, color: "#888" },
});