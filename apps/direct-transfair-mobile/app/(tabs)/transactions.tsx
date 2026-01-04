// apps/direct-transfair-mobile/app/(tabs)/transactions.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { api } from "../../services/api";
// On importe le type officiel pour éviter les conflits
import type { Transaction } from "../../services/types";

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // api.getTransactions retourne déjà un tableau (Transaction[]), pas besoin de .data
      const res = await api.getTransactions(); 
      setTransactions(res);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger les transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const date = new Date(item.createdAt);
    return (
      <View style={styles.card}>
        <View style={styles.row}>
            <Text style={styles.reference}>{item.reference}</Text>
            {/* Conversion explicite en String pour éviter les bugs si le backend renvoie un chiffre */}
            <Text style={[styles.status, styles[`status_${item.status}` as keyof typeof styles] || {}]}>
                {item.status}
            </Text>
        </View>
        <Text style={styles.amount}>
          {String(item.amount)} {item.currency}
        </Text>
        <Text style={styles.date}>
          {date.toLocaleDateString()} à{" "}
          {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    );
  };

  if (loading && !refreshing && transactions.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F7931E" />
        <Text style={{marginTop: 10}}>Chargement des transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <Text style={styles.title}>Historique des transactions</Text>
        }
        ListEmptyComponent={
          <View style={styles.center}>
             <Text style={styles.empty}>Aucune transaction pour le moment.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", margin: 20, color: "#333" },
  empty: { textAlign: "center", color: "#777", marginTop: 20, fontSize: 16 },
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  reference: { fontWeight: "bold", color: "#555", fontSize: 12 },
  amount: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 4 },
  date: { fontSize: 12, color: "#999" },
  status: { fontWeight: "700", fontSize: 12 },
  status_PENDING: { color: "#FF9800" },
  status_VALIDATED: { color: "#2196F3" },
  status_PAID: { color: "#4CAF50" },
  status_CANCELLED: { color: "#F44336" },
});