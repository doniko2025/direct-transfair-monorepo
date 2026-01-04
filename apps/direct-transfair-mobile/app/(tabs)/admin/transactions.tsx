//apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
import React, { useCallback, useState } from "react";
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
// ✅ IMPORT IMPORTANT
import { useFocusEffect } from "expo-router"; 

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
      // Petite astuce : on ne met le loading true que si la liste est vide
      // pour éviter le clignotement si on a déjà des données
      if (items.length === 0) setLoading(true);
      
      const data = await api.adminGetTransactions();
      setItems(data);
    } catch (e) {
      console.error(e);
      // On évite l'alerte bloquante à chaque focus, un log suffit souvent
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  // ✅ CORRECTION MAJEURE : Rechargement automatique à chaque visite
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const updateStatus = async (id: string, status: TransactionStatus) => {
    try {
      setUpdatingId(id);
      await api.adminUpdateTransactionStatus(id, status);
      // On recharge la liste après la modif pour voir le changement de couleur
      const data = await api.adminGetTransactions(); 
      setItems(data);
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
        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text style={styles.reference}>{item.reference}</Text>
            <Text style={styles.amount}>{item.total} {item.currency}</Text>
        </View>

        <Text style={[styles.status, styles[`status_${item.status}` as keyof typeof styles]]}>
          {item.status}
        </Text>

        <Text style={styles.date}>
          {date.toLocaleDateString("fr-FR")}{" "}
          {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </Text>

        {/* LOGIQUE MÉTIER : 
            L'admin ne devrait intervenir que pour débloquer (PENDING -> VALIDATED)
            Le passage à PAID se fait normalement via le retrait par code, 
            mais on garde le bouton "Payée" ici pour le dépannage manuel.
        */}
        <View style={styles.actions}>
          {item.status === "PENDING" && (
             <ActionButton
                label="Valider (Anti-Fraude)"
                loading={updatingId === item.id}
                onPress={() => updateStatus(item.id, "VALIDATED")}
             />
          )}

          {item.status === "VALIDATED" && (
             <ActionButton
                label="Marquer Payée (Force)"
                loading={updatingId === item.id}
                onPress={() => updateStatus(item.id, "PAID")}
             />
          )}

          {item.status !== "PAID" && item.status !== "CANCELLED" && (
             <ActionButton
                label="Annuler"
                danger
                loading={updatingId === item.id}
                onPress={() => updateStatus(item.id, "CANCELLED")}
             />
          )}
        </View>
      </View>
    );
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <Text style={styles.empty}>Aucune transaction à gérer.</Text>
        }
        contentContainerStyle={{paddingBottom: 20}}
      />
    </View>
  );
}

/* ------------------ UI Components ------------------ */

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
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.btnText}>{props.label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { textAlign: "center", marginTop: 40, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reference: { fontWeight: "800", marginBottom: 4, color: colors.text },
  amount: { fontWeight: "800", color: colors.primary },
  date: { fontSize: 12, color: colors.muted, marginTop: 4 },
  status: { fontWeight: "800", marginTop: 6, fontSize: 12, textTransform: 'uppercase' },
  status_PENDING: { color: "#f59e0b" },
  status_VALIDATED: { color: "#3b82f6" },
  status_PAID: { color: "#16a34a" },
  status_CANCELLED: { color: "#dc2626" },
  actions: { flexDirection: "row", marginTop: 12, gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
});