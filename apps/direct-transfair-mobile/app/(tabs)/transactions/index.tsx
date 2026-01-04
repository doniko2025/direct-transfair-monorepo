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
// ✅ Import pour la navigation et le focus
import { useRouter, useFocusEffect } from "expo-router";

// ✅ CORRECTION DES CHEMINS (3 niveaux pour remonter à la racine)
import { api } from "../../../services/api";
import type { Transaction } from "../../../services/types";
import { colors } from "../../../theme/colors";

export default function TransactionsScreen() {
  const router = useRouter(); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fonction de chargement des données
  const load = useCallback(async () => {
    try {
      // On affiche le loader seulement si la liste est vide (premier chargement)
      if (transactions.length === 0) {
        setLoading(true);
      }
      
      const res = await api.getTransactions();
      
      // Tri : Les plus récentes en haut
      const sorted = res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTransactions(sorted);
    } catch (e: any) {
      console.error(e);
      // On log juste l'erreur pour ne pas spammer l'utilisateur avec des alertes
      console.log("Erreur chargement transactions");
    } finally {
      setLoading(false);
    }
  }, [transactions.length]);

  // Recharge les données à chaque fois qu'on affiche l'écran
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Fonction pour le "Pull to Refresh" (glisser vers le bas)
  const onRefresh = async () => {
    setRefreshing(true);
    try {
        const res = await api.getTransactions();
        const sorted = res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransactions(sorted);
    } catch(e) {
        Alert.alert("Erreur", "Impossible de rafraîchir l'historique.");
    } finally {
        setRefreshing(false);
    }
  };

  // Rendu d'une carte de transaction
  const renderItem = ({ item }: { item: Transaction }) => {
    const date = new Date(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        // ✅ C'est ici qu'on navigue vers le détail (Ticket de caisse)
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      >
        <View style={styles.row}>
            <Text style={styles.reference}>{item.reference}</Text>
            {/* Style dynamique selon le statut (PENDING, PAID...) */}
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
      </TouchableOpacity>
    );
  };

  // Affichage du loader initial
  if (loading && !refreshing && transactions.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{marginTop: 10, color: colors.muted}}>Chargement de l'historique...</Text>
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
        ListHeaderComponent={
          <Text style={styles.title}>Historique</Text>
        }
        ListEmptyComponent={
          <View style={styles.center}>
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
  
  title: { fontSize: 22, fontWeight: "bold", margin: 20, color: colors.text },
  empty: { textAlign: "center", color: colors.muted, marginTop: 20, fontSize: 16 },
  
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    // Ombres
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  reference: { fontWeight: "bold", color: "#555", fontSize: 12 },
  
  amount: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  date: { fontSize: 12, color: "#999" },
  
  status: { fontWeight: "700", fontSize: 12 },
  // Couleurs dynamiques selon le statut
  status_PENDING: { color: "#FF9800" }, // Orange
  status_VALIDATED: { color: "#2196F3" }, // Bleu
  status_PAID: { color: "#4CAF50" }, // Vert
  status_CANCELLED: { color: "#F44336" }, // Rouge
});