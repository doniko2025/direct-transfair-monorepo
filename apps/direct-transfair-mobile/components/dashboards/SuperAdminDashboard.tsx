//apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, StatusBar, FlatList, ActivityIndicator, 
  Platform, Alert, Clipboard 
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

  // --- CHARGEMENT DES DONNÉES ---
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getClients();
      if (Array.isArray(data)) {
        // Filtre la société technique de base
        setClients(data.filter(c => c.code !== 'DONIKO'));
      }
    } catch (e) {
      console.error("Erreur de rafraîchissement :", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // --- FONCTION DE CRÉATION AVEC GÉNÉRATION AUTO ---
  const handleAddNewSociety = () => {
    // Génération automatique du code et du mot de passe
    const randomCode = "SOC" + Math.floor(1000 + Math.random() * 9000);
    const tempPassword = "Pass-" + Math.floor(1000 + Math.random() * 9000);

    // On copie immédiatement les infos générées pour ne pas les perdre
    const infoToCopy = `Société: ${randomCode}\nPass: ${tempPassword}`;
    Clipboard.setString(infoToCopy);
    
    Alert.alert(
      "Initialisation Nouvelle Société",
      `${infoToCopy}\n\nLes identifiants ont été copiés dans votre presse-papier.`,
      [{ text: "Continuer vers le formulaire", onPress: () => router.push("/(tabs)/admin") }]
    );
  };

  const renderClientItem = ({ item }: any) => {
    const isActive = item.subscriptionStatus === 'ACTIVE';
    return (
      <TouchableOpacity 
        style={styles.clientCard} 
        onPress={() => router.push({ pathname: "/(tabs)/admin", params: { id: item.id } })}
      >
        <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#F59E0B' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.clientName}>{item.name}</Text>
          <Text style={styles.clientSubtitle}>Code: {item.code} • {item.subscriptionType === 'PURCHASE' ? 'ACHAT' : 'LOCATION'}</Text>
        </View>
        <View style={styles.cardActions}>
            <Ionicons name="settings-outline" size={18} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />
      
      {/* HEADER MODERNE */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Super Console</Text>
          <Text style={styles.headerSubtitle}>Direct Transf'air Cloud</Text>
        </View>
        <TouchableOpacity style={styles.profileBadge}>
            <Ionicons name="shield-checkmark" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* STATS DE HAUT NIVEAU */}
        <View style={styles.statsRow}>
            <View style={styles.statBox}>
                <Text style={styles.statLabel}>SOCIÉTÉS</Text>
                <Text style={styles.statValue}>{clients.length}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
                <Text style={styles.statLabel}>FLUX GLOBAL</Text>
                <Text style={styles.statValue}>12.4k €</Text>
            </View>
        </View>

        {/* ACTIONS DE PILOTAGE */}
        <Text style={styles.sectionLabel}>PILOTAGE RÉSEAU</Text>
        <View style={styles.grid}>
          <PilotCard title="Trésorerie" icon="wallet-outline" color="#10B981" onPress={() => router.push("/(tabs)/admin/treasury")} />
          <PilotCard title="Taux EUR" icon="trending-up-outline" color="#8B5CF6" onPress={() => router.push("/(tabs)/admin/rates")} />
          <PilotCard title="Audit Transac" icon="analytics-outline" color="#3B82F6" onPress={() => router.push("/(tabs)/admin/transactions")} />
          <PilotCard title="Gestion Users" icon="people-outline" color="#64748B" onPress={() => router.push("/(tabs)/admin/users")} />
        </View>

        {/* GESTION DES SOCIÉTÉS (SaaS) */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionLabel}>CLIENTS SAAS (SOCIÉTÉS)</Text>
          <TouchableOpacity style={styles.plusButton} onPress={handleAddNewSociety}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : (
          <View style={styles.listContainer}>
            {clients.map((item) => <View key={item.id}>{renderClientItem({ item })}</View>)}
            {clients.length === 0 && <Text style={styles.emptyText}>Aucun client SaaS actif.</Text>}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- SOUS-COMPOSANTS ---
function PilotCard({ title, icon, color, onPress }: any) {
  return (
    <TouchableOpacity style={styles.pCard} onPress={onPress}>
      <View style={[styles.pIconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.pTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0F172A" },
  header: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A' },
  headerTitle: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#94A3B8", fontSize: 13, fontWeight: "500" },
  profileBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 15 },
  
  scrollContent: { backgroundColor: "#F8FAFC", borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 20, minHeight: '100%' },
  
  statsRow: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 25, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '800', letterSpacing: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginTop: 5 },

  sectionLabel: { fontSize: 12, fontWeight: "800", color: "#64748B", letterSpacing: 1.5, marginBottom: 15, marginLeft: 5 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  pCard: { width: '48%', backgroundColor: '#FFF', padding: 15, borderRadius: 18, elevation: 1, marginBottom: 5 },
  pIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  pTitle: { fontSize: 14, fontWeight: "700", color: "#334155" },

  plusButton: { backgroundColor: '#F59E0B', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#F59E0B', shadowOpacity: 0.3 },

  listContainer: { marginTop: 15 },
  clientCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 18, borderRadius: 20, marginBottom: 12, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.02 },
  statusDot: { width: 5, height: 35, borderRadius: 10, marginRight: 15 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  clientSubtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  cardActions: { padding: 5 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 14, fontWeight: '500' }
});