//apps/direct-transfair-mobile/app/(tabs)/admin/index.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../../providers/AuthProvider"; // ✅ Import User

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth(); // ✅ Récupération du User

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#111827" barStyle="light-content" />
      
      {/* HEADER SOMBRE "PRO" */}
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>Espace Administrateur</Text>
            <Text style={styles.headerSubtitle}>Pilotage de l'activité</Text>
        </View>
        <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={20} color="#FFD700" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        <Text style={styles.sectionTitle}>Actions Rapides</Text>

        <View style={styles.grid}>
            
            {/* ✅ BOUTON SUPER ADMIN (VISIBLE SEULEMENT POUR TOI) */}
            {user?.role === 'SUPER_ADMIN' && (
                <AdminCard 
                    title="Gérer Sociétés" 
                    subtitle="Créer clients SaaS" 
                    icon="business" 
                    color="#F59E0B" // Orange
                    onPress={() => router.push("/(tabs)/admin/super-dashboard")}
                />
            )}

            {/* BOUTON TRANSACTIONS */}
            <AdminCard 
                title="Transactions" 
                subtitle="Valider les envois" 
                icon="swap-horizontal" 
                color="#3B82F6" // Bleu
                onPress={() => router.push("/(tabs)/admin/transactions")}
            />

            {/* BOUTON TAUX */}
            <AdminCard 
                title="Taux de Change" 
                subtitle="Modifier EUR/XOF" 
                icon="trending-up" 
                color="#10B981" // Vert
                onPress={() => router.push("/(tabs)/admin/rates")}
            />

            <AdminCard 
                title="Utilisateurs" 
                subtitle="Gérer les comptes" 
                icon="people" 
                color="#8B5CF6" // Violet
                onPress={() => {}}
            />

            <AdminCard 
                title="Retraits" 
                subtitle="Suivi agences" 
                icon="cash" 
                color="#F59E0B" // Orange
                onPress={() => {}}
            />
        </View>

        {/* STATS RAPIDES */}
        <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Volume du jour</Text>
            <Text style={styles.statsValue}>12 450.00 €</Text>
            <View style={styles.trendBadge}>
                <Ionicons name="caret-up" size={12} color="#065F46" />
                <Text style={styles.trendText}>+12% vs hier</Text>
            </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function AdminCard({ title, subtitle, icon, color, onPress }: any) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={28} color={color} />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#111827" }, 
  header: { backgroundColor: "#111827", padding: 24, paddingBottom: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#9CA3AF", fontSize: 14, marginTop: 4 },
  adminBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },

  container: { flexGrow: 1, backgroundColor: "#F3F4F6", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, minHeight: '100%' },
  
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 16 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: { width: '48%', backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: "#6B7280" },

  statsCard: { marginTop: 12, backgroundColor: '#FFF', padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsTitle: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  statsValue: { fontSize: 24, fontWeight: "800", color: "#1F2937" },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  trendText: { color: '#065F46', fontSize: 12, fontWeight: '700', marginLeft: 4 }
});