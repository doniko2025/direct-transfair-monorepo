//apps/direct-transfair-mobile/app/(tabs)/admin/commissions.tsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, ScrollView 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
// ✅ CORRECTION DES CHEMINS (3 niveaux pour remonter à la racine 'app')
import { api } from "../../../services/api"; 
import { colors } from "../../../theme/colors";

const PERIODS = [
  { key: 'TODAY', label: "Aujourd'hui" },
  { key: 'WEEK', label: "7 Jours" },
  { key: 'MONTH', label: "Ce Mois" },
  { key: 'QUARTER', label: "Trimestre" },
  { key: 'YEAR', label: "Année" },
];

export default function AdminCommissionsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('TODAY');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalFees: 0,
    platformNet: 0,
    distributed: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.http.get(`/commissions/history?period=${period}`);
      const data = res.data || [];
      setHistory(data);
      calculateStats(data);
    } catch (e) {
      console.log("Erreur chargement commissions admin:", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateStats = (data: any[]) => {
    let totalF = 0;
    let platF = 0;
    let distF = 0;

    data.forEach(tx => {
        const fees = Number(tx.fees || 0);
        const plat = Number(tx.breakdown?.platform?.amount || 0);
        const dist = fees - plat;

        totalF += fees;
        platF += plat;
        distF += dist;
    });

    setStats({ totalFees: totalF, platformNet: platF, distributed: distF });
  };

  const renderFilter = () => (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 16}}>
        {PERIODS.map((p) => {
          const isActive = period === p.key;
          return (
            <TouchableOpacity 
              key={p.key} 
              style={[styles.pill, isActive && styles.pillActive]} 
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderHeader = () => (
    <View>
        {renderFilter()}
        <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Marge Nette (Plateforme)</Text>
            <Text style={styles.summaryAmount}>{stats.platformNet.toLocaleString('fr-FR')} XOF</Text>
            
            <View style={styles.rowStats}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Frais</Text>
                    <Text style={styles.statValue}>{stats.totalFees.toLocaleString('fr-FR')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Reversé Agents</Text>
                    <Text style={[styles.statValue, {color: '#F59E0B'}]}>{stats.distributed.toLocaleString('fr-FR')}</Text>
                </View>
            </View>
        </View>
        <Text style={styles.sectionTitle}>Détail des transactions ({history.length})</Text>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
      const breakdown = item.breakdown || {};
      const platformShare = Number(breakdown.platform?.amount || 0);
      const senderShare = Number(breakdown.sender?.amount || 0);
      const payerShare = Number(breakdown.payer?.amount || 0);

      return (
        <View style={styles.card}>
            <View style={styles.rowBetween}>
                <Text style={styles.refText}>{item.reference}</Text>
                <Text style={styles.dateText}>
                    {new Date(item.date).toLocaleDateString('fr-FR', {day: '2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                </Text>
            </View>

            <View style={[styles.rowBetween, {marginTop: 8}]}>
                <Text style={styles.label}>Montant Transféré</Text>
                <Text style={styles.amountText}>{Number(item.amount).toLocaleString('fr-FR')} XOF</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                    <Text style={styles.bdLabel}>Frais Client</Text>
                    <Text style={styles.bdValueBold}>{Number(item.fees).toLocaleString('fr-FR')} XOF</Text>
                </View>
                
                <View style={styles.bdSubRow}>
                    <Ionicons name="return-down-forward" size={14} color="#9CA3AF" />
                    <Text style={styles.bdSmall}>Plateforme:</Text>
                    <Text style={[styles.bdSmallVal, {color: colors.primary}]}>+{platformShare}</Text>
                </View>
                
                <View style={styles.bdSubRow}>
                    <Ionicons name="return-down-forward" size={14} color="#9CA3AF" />
                    <Text style={styles.bdSmall}>Envoi ({breakdown.sender?.name?.substring(0,10)}..):</Text>
                    <Text style={[styles.bdSmallVal, {color: '#F59E0B'}]}>-{senderShare}</Text>
                </View>

                <View style={styles.bdSubRow}>
                    <Ionicons name="return-down-forward" size={14} color="#9CA3AF" />
                    <Text style={styles.bdSmall}>Retrait ({breakdown.payer?.name?.substring(0,10)}..):</Text>
                    <Text style={[styles.bdSmallVal, {color: '#F59E0B'}]}>-{payerShare}</Text>
                </View>
            </View>
        </View>
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi Commissions</Text>
        <View style={{width: 24}} />
      </View>

      {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} />
      ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={{paddingBottom: 20}}
            ListEmptyComponent={
                <Text style={styles.emptyText}>Aucune transaction validée sur cette période.</Text>
            }
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { backgroundColor: '#1E293B', padding: 16, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 4 },
  filterContainer: { paddingVertical: 12, backgroundColor: '#FFF', marginBottom: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  pillText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  pillTextActive: { color: '#FFF' },
  summaryCard: { marginHorizontal: 16, backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 4 },
  summaryTitle: { color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  summaryAmount: { color: '#FFF', fontSize: 32, fontWeight: '800', marginVertical: 8 },
  rowStats: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  statItem: { flex: 1 },
  statLabel: { color: '#94A3B8', fontSize: 11 },
  statValue: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginLeft: 16, marginBottom: 10 },
  card: { backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.03, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  dateText: { fontSize: 11, color: '#94A3B8' },
  label: { fontSize: 13, color: '#64748B' },
  amountText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  breakdownContainer: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bdLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  bdValueBold: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  bdSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingLeft: 4 },
  bdSmall: { fontSize: 11, color: '#64748B', marginLeft: 4, flex: 1 },
  bdSmallVal: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94A3B8' }
});