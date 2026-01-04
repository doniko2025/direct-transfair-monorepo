//apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { api } from "../../../services/api";
import type { Transaction, TransactionStatus } from "../../../services/types";
import { colors } from "../../../theme/colors";

export default function AdminTransactionsScreen() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.adminGetTransactions();
      setItems(data);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger les transactions admin.");
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

  const updateStatus = async (id: string, status: TransactionStatus) => {
    try {
      setUpdatingId(id);
      await api.adminUpdateTransactionStatus(id, status);
      await load();
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Mise à jour impossible.");
    } finally {
      setUpdatingId(null);
    }
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const date = new Date(item.createdAt);

    return (
      <View style={styles.card}>
        <Text style={styles.reference}>{item.reference}</Text>

        <Text style={styles.line}>
          {item.total} {item.currency}
        </Text>

        <Text style={[styles.status, styles[`status_${item.status}`]]}>
          {item.status}
        </Text>

        <Text style={styles.date}>
          {date.toLocaleDateString("fr-FR")}{" "}
          {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </Text>

        <View style={styles.actions}>
          <ActionButton
            label="Valider"
            disabled={item.status !== "PENDING"}
            loading={updatingId === item.id}
            onPress={() => updateStatus(item.id, "VALIDATED")}
          />

          <ActionButton
            label="Payée"
            disabled={item.status !== "VALIDATED"}
            loading={updatingId === item.id}
            onPress={() => updateStatus(item.id, "PAID")}
          />

          <ActionButton
            label="Annuler"
            danger
            disabled={item.status === "PAID"}
            loading={updatingId === item.id}
            onPress={() => updateStatus(item.id, "CANCELLED")}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Chargement des transactions…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune transaction admin.</Text>
        }
      />
    </View>
  );
}

/* ------------------ UI ------------------ */

function ActionButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      style={[
        styles.btn,
        props.danger ? styles.btnDanger : styles.btnPrimary,
        (props.disabled || props.loading) && styles.btnDisabled,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.btnText}>{props.label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    textAlign: "center",
    marginTop: 40,
    color: colors.muted,
  },

  card: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  reference: { fontWeight: "800", marginBottom: 4 },
  line: { fontSize: 14 },
  date: { fontSize: 12, color: colors.muted, marginTop: 4 },

  status: { fontWeight: "800", marginTop: 6 },
  status_PENDING: { color: "#f59e0b" },
  status_VALIDATED: { color: "#3b82f6" },
  status_PAID: { color: "#16a34a" },
  status_CANCELLED: { color: "#dc2626" },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 6,
  },

  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
