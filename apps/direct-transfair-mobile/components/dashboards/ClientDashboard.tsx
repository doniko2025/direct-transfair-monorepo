//components/dashboards/ClientDashboard.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";
import { DashboardLayout, MenuCard } from "./DashboardShared";

export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  return (
    <DashboardLayout 
      title={`Bonjour ${user?.firstName}`} 
      subtitle="Mon Portefeuille" 
      badge="wallet" 
      badgeColor={colors.primary}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
    >
       <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceValue}>
            {/* ✅ CORRECTION ICI : Ajout de (user as any) */}
            {user?.balance ? Number(user.balance).toLocaleString('fr-FR') : "0"} {(user as any)?.currency || 'XOF'}
          </Text>
          <TouchableOpacity style={styles.topUpBtn} onPress={() => router.push("/topup")}>
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.topUpText}>Recharger</Text>
          </TouchableOpacity>
       </View>

       <Text style={styles.sectionTitle}>Actions</Text>
       <View style={styles.grid}>
          <MenuCard title="Envoyer" subtitle="International" icon="paper-plane" color="#F59E0B" onPress={() => router.push("/(tabs)/send")} />
          <MenuCard title="Bénéficiaires" subtitle="Mes contacts" icon="people" color="#3B82F6" onPress={() => router.push("/(tabs)/beneficiaries")} />
       </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: colors.primary, padding: 20, borderRadius: 18, marginBottom: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 4, fontWeight:'500' },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom:5 },
  topUpBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:6, borderRadius:20, alignSelf:'flex-start' },
  topUpText: { color:'#FFF', fontWeight:'600', fontSize:12, marginLeft:6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#374151', marginTop: 20 },
  grid: { gap: 10 },
});