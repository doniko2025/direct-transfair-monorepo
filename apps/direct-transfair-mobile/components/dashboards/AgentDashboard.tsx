//components/dashboards/AgentDashboard.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { DashboardLayout, MenuCard } from "./DashboardShared";

export default function AgentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
        if (user?.agencyId) {
            const data = await api.getAgency(user.agencyId);
            setAgencyData(data);
        }
    } catch (e) {
        console.log(e);
    } finally {
        setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const agencyName = user?.agency?.name || agencyData?.name || "Agence";
  const currency = agencyData?.currency || "XOF";

  return (
    <DashboardLayout 
      title="Espace Guichet" 
      subtitle={`Agence: ${agencyName}`} 
      badge="storefront" 
      badgeColor="#10B981" 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
    >
      <View style={[styles.balanceCard, {backgroundColor: '#064E3B'}]}>
          <Text style={styles.balanceLabel}>Solde Caisse (Agence)</Text>
          <Text style={styles.balanceValue}>
              {agencyData?.balance ? Number(agencyData.balance).toLocaleString('fr-FR') : "0"} {currency}
          </Text>
      </View>
      
      <Text style={styles.sectionTitle}>Opérations Guichet</Text>
      <View style={styles.grid}>
          <MenuCard title="Dépôt Client" subtitle="Recharger un compte" icon="arrow-down-circle" color="#10B981" onPress={() => router.push("/agent/deposit")} />
          <MenuCard title="Retrait Espèces" subtitle="Payer un code" icon="wallet" color="#EF4444" onPress={() => router.push("/agent/withdraw")} />
          <MenuCard title="Envoi Espèces" subtitle="Client de passage" icon="paper-plane" color="#3B82F6" onPress={() => router.push("/agent/send-cash")} />
          
          {/* ✅ LE BOUTON AJOUTÉ ICI */}
          <MenuCard title="Historique & Coms" subtitle="Mes gains & logs" icon="time" color="#D97706" onPress={() => router.push("/agent/transactions")} />
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  balanceCard: { padding: 20, borderRadius: 18, marginBottom: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 4, fontWeight:'500' },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom:5 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#374151', marginTop: 20 },
  grid: { gap: 10 },
});