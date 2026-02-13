//apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, StatusBar, FlatList, ActivityIndicator, Platform, Alert 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Charger les sociétés (Clients SaaS)
  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await api.getClients();
      if (Array.isArray(data)) {
        // On filtre pour ne pas afficher la société mère si besoin
        const filtered = data.filter(c => c.code !== 'DONIKO');
        setClients(filtered);
      }
    } catch (e) {
      console.error("Erreur chargement sociétés:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadClients(); }, []));

  const renderClientItem = ({ item }: any) => {
    const isActive = item.subscriptionStatus === 'ACTIVE';
    return (
      <TouchableOpacity 
        style={styles.clientCard} 
        onPress={() => router.push({ pathname: "/(tabs)/admin", params: { id: item.id } })}
      >
        <View style={[styles.statusIndicator, { backgroundColor: isActive ? '#10B981' : '#F59E0B' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.clientName}>{item.name}</Text>
          <Text style={styles.clientCode}>Code: {item.code} • {item.subscriptionType === 'PURCHASE' ? 'ACHAT' : 'LOCATION'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#111827" barStyle="light-content" />
      
      {/* HEADER PRO */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Espace Administrateur</Text>
          <Text style={styles.headerSubtitle}>Pilotage de l'activité globale</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(tabs)/admin")}>
          <Ionicons name="add-circle" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* ACTIONS RAPIDES (Fusion de Overview) */}
        <Text style={styles.sectionTitle}>Actions Rapides</Text>
        <View style={styles.grid}>
          <QuickAction 
            title="Trésorerie" 
            icon="cash-outline" 
            color="#10B981" 
            onPress={() => router.push("/(tabs)/admin/treasury")} 
          />
          <QuickAction 
            title="Taux Change" 
            icon="trending-up-outline" 
            color="#8B5CF6" 
            onPress={() => router.push("/(tabs)/admin/rates")} 
          />
          <QuickAction 
            title="Transactions" 
            icon="swap-horizontal-outline" 
            color="#3B82F6" 
            onPress={() => router.push("/(tabs)/admin/transactions")} 
          />
          <QuickAction 
            title="Utilisateurs" 
            icon="people-outline" 
            color="#6B7280" 
            onPress={() => router.push("/(tabs)/admin/users")} 
          />
        </View>

        {/* LISTE DES SOCIÉTÉS (Fusion de Dashboard) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Sociétés (Clients SaaS)</Text>
          <TouchableOpacity onPress={loadClients}>
            <Ionicons name="refresh" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          clients.map((item) => <View key={item.id}>{renderClientItem({ item })}</View>)
        )}

        {clients.length === 0 && !loading && (
          <Text style={styles.emptyText}>Aucune société créée pour le moment.</Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Sous-composant pour les tuiles
function QuickAction({ title, icon, color, onPress }: any) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#111827" },
  header: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: "#9CA3AF", fontSize: 13, marginTop: 4 },
  addBtn: { backgroundColor: '#FFF', borderRadius: 20 },
  
  scrollContainer: { backgroundColor: "#F3F4F6", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, minHeight: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 15 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  card: { width: '48%', backgroundColor: '#FFF', padding: 15, borderRadius: 16, marginBottom: 5, elevation: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" },

  clientCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', elevation: 1 },
  statusIndicator: { width: 4, height: 30, borderRadius: 2, marginRight: 12 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  clientCode: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 13 }
});