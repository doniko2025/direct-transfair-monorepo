// apps/direct-transfair-mobile/app/agent/transactions.tsx
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, SafeAreaView
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { Transaction } from "../../services/types";

export default function AgentHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      // Sécurité : ne rien charger si l'utilisateur n'est pas prêt
      if (!user?.id) {
        setTransactions([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!refreshing) setLoading(true);

      const data = await api.getTransactions();
      setTransactions(data);
    } catch (e) {
      console.log("Erreur historique agent:", e);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, user]);

  useFocusEffect(useCallback(() => { loadTransactions(); }, [loadTransactions]));
  const onRefresh = () => { setRefreshing(true); loadTransactions(); };

  const renderItem = ({ item }: { item: Transaction }) => {
    // Utilisation de cast 'any' temporaire pour éviter de casser les types si incomplets
    const withdrawal = (item as any)?.withdrawal as { processedById?: string } | undefined;
    const beneficiary = (item as any)?.beneficiary as { fullName?: string; firstName?: string } | undefined;
    const sender = (item as any)?.sender as { firstName?: string; lastName?: string } | undefined;

    const myId = String(user?.id || "N/A");
    const senderId = String((item as any)?.senderId || "N/A");
    const processorId = withdrawal?.processedById ? String(withdrawal.processedById) : "NULL";

    const isMyWithdrawal = (processorId === myId);
    const isSending = (senderId === myId);

    // On n'affiche QUE les transactions qui concernent l'agent (Envoi ou Retrait traité)
    if (!isMyWithdrawal && !isSending) return null;

    let iconName: any = "paper-plane";
    let iconColor = "#DC2626"; // Rouge (Sortie)
    let bgColor = "#FEE2E2";
    let title = "Envoi d'argent";
    let subTitle = `Vers ${beneficiary?.fullName || beneficiary?.firstName || 'Inconnu'}`;
    let amountColor = "#1F2937"; // Noir par défaut

    if (isMyWithdrawal) {
      iconName = "wallet"; 
      iconColor = "#059669"; // Vert (Entrée/Succès)
      bgColor = "#D1FAE5";
      title = "Retrait Effectué";
      subTitle = `Client: ${sender?.firstName || 'Inconnu'} ${sender?.lastName || ''}`;
      amountColor = "#059669"; // Montant en vert pour signifier un succès/gain
    }

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push({ pathname: "/(tabs)/transactions/[id]", params: { id: item.id } })}
      >
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={[styles.amount, { color: amountColor }]}>
                {(item as any)?.amount} {(item as any)?.currency}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={styles.subTitle}>{subTitle}</Text>
                <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    {' - '}
                    {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>

            {isMyWithdrawal && (
              <View style={styles.tag}>
                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                <Text style={styles.tagText}>Payé & Commissionné</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique & Commissions</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#064E3B" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#064E3B']} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="time-outline" size={50} color="#ccc" />
              <Text style={styles.emptyText}>Aucune opération récente.</Text>
              <Text style={{ color: '#666', marginTop: 5, fontSize: 12 }}>
                Les retraits validés apparaîtront ici.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    backgroundColor: '#064E3B', // Vert Agence Officiel
    padding: 16,
    paddingTop: 10, // Ajuster selon Platform.OS si besoin
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 4 },

  card: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },

  row: { flexDirection: "row", alignItems: "flex-start" },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },

  title: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  amount: { fontSize: 15, fontWeight: "800" },
  subTitle: { fontSize: 13, color: "#6B7280", marginTop: 2, flex: 1, marginRight: 10 },
  date: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8
  },
  tagText: { fontSize: 11, color: '#059669', fontWeight: '600', marginLeft: 4 },

  emptyText: {
    textAlign: "center",
    marginTop: 10,
    color: "#374151",
    fontSize: 16,
    fontWeight: '600'
  }
});