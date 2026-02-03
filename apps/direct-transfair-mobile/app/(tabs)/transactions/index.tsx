//apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// ✅ Vérifie que ce chemin est bon dans ton projet
import { api } from "../../../services/api";
import type { Transaction } from "../../../services/types";
import { colors } from "../../../theme/colors";

// --- MAP DES STATUTS (TRADUCTION & COULEURS) ---
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: "En attente", color: "#D97706", bg: "#FEF3C7" }, // Orange
    VALIDATED: { label: "Disponible", color: "#2563EB", bg: "#DBEAFE" }, // Bleu
    PAID: { label: "Payé", color: "#059669", bg: "#D1FAE5" }, // Vert
    CANCELLED: { label: "Annulé", color: "#DC2626", bg: "#FEE2E2" }, // Rouge
};

export default function TransactionsScreen() {
  const router = useRouter(); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (transactions.length === 0) setLoading(true);
      const res = await api.getTransactions();
      const sorted = res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
    } catch (e: any) {
      console.log("Erreur chargement transactions");
    } finally {
      setLoading(false);
    }
  }, [transactions.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const date = new Date(item.createdAt);
    // Récupérer le style du statut (ou défaut gris)
    const statusStyle = STATUS_MAP[item.status] || { label: item.status, color: "#6B7280", bg: "#F3F4F6" };
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.7}
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      >
        {/* LIGNE 1 : RÉFÉRENCE + DATE */}
        <View style={styles.rowTop}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <View style={styles.iconBox}>
                    <Ionicons name="receipt" size={16} color={colors.primary} />
                </View>
                <View>
                    <Text style={styles.reference}>{item.reference}</Text>
                    <Text style={styles.date}>
                        {date.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})} • {date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                    </Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DDD" />
        </View>

        {/* LIGNE 2 : MONTANT + STATUT (BADGE) */}
        <View style={styles.rowBottom}>
            <Text style={styles.amount}>
                {Number(item.amount).toLocaleString('fr-FR')} <Text style={{fontSize:12, color:'#999'}}>{item.currency}</Text>
            </Text>
            
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.badgeText, { color: statusStyle.color }]}>
                    {statusStyle.label}
                </Text>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && transactions.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListHeaderComponent={<Text style={styles.title}>Historique</Text>}
        ListEmptyComponent={
          <View style={styles.center}>
             <Ionicons name="document-text-outline" size={48} color="#DDD" />
             <Text style={styles.empty}>Aucune transaction effectuée.</Text>
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
  
  title: { fontSize: 24, fontWeight: "800", margin: 20, marginBottom: 10, color: '#1F2937' },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 10, fontSize: 14 },
  
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems:'center', marginBottom: 12, borderBottomWidth:1, borderBottomColor:'#F9FAFB', paddingBottom:10 },
  iconBox: { width:32, height:32, borderRadius:10, backgroundColor:'#F0FDF4', justifyContent:'center', alignItems:'center', marginRight:10 },
  
  reference: { fontWeight: "700", color: "#374151", fontSize: 13 },
  date: { fontSize: 11, color: "#9CA3AF", marginTop:2 },
  
  rowBottom: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  
  amount: { fontSize: 18, fontWeight: "800", color: '#111827' },
  
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontWeight: "700", fontSize: 10, textTransform:'uppercase', letterSpacing:0.5 },
});