//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/history.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

const FILTERS = [
    { label: "Aujourd'hui", value: "TODAY" },
    { label: "7 Jours", value: "WEEK" },
    { label: "Ce Mois", value: "MONTH" },
    { label: "Trimestre", value: "QUARTER" },
    { label: "Année", value: "YEAR" },
];

export default function CommissionHistoryScreen() {
  const [period, setPeriod] = useState("TODAY");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ platform: 0, fees: 0 });

  useEffect(() => {
      fetchHistory();
  }, [period]); // Recharge quand la période change

  const fetchHistory = async () => {
      setLoading(true);
      try {
          const data = await api.getCommissionHistory(period);
          setHistory(data);
          
          // Calcul des totaux locaux pour l'affichage
          const totalFees = data.reduce((acc: number, item: any) => acc + item.fees, 0);
          const totalPlatform = data.reduce((acc: number, item: any) => acc + item.breakdown.platform.amount, 0);
          setTotals({ fees: totalFees, platform: totalPlatform });

      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
        <View style={styles.rowBetween}>
            <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                <View style={[styles.iconBox, item.status === 'PAID' ? {backgroundColor:'#D1FAE5'} : {backgroundColor:'#FEF3C7'}]}>
                    <Ionicons name={item.status === 'PAID' ? "checkmark" : "time"} size={14} color={item.status === 'PAID' ? "#059669" : "#D97706"} />
                </View>
                <View>
                    <Text style={styles.ref}>{item.reference}</Text>
                    <Text style={styles.date}>{new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                </View>
            </View>
            <Text style={styles.fees}>Frais: {item.fees} F</Text>
        </View>

        <View style={styles.divider} />

        {/* Répartition */}
        <View style={styles.breakdown}>
            <View style={styles.part}>
                <Text style={styles.label}>Envoyeur ({item.breakdown.sender.name.substring(0, 10)}..)</Text>
                <Text style={styles.value}>+{item.breakdown.sender.amount.toFixed(0)} F</Text>
            </View>
            <View style={styles.part}>
                <Text style={styles.label}>Payeur ({item.breakdown.payer.substring(0, 10)}..)</Text>
                <Text style={styles.value}>+{item.breakdown.payer.amount.toFixed(0)} F</Text>
            </View>
            <View style={styles.part}>
                <Text style={[styles.label, {fontWeight:'bold', color:colors.primary}]}>Société</Text>
                <Text style={[styles.value, {fontWeight:'bold', color:colors.primary}]}>+{item.breakdown.platform.amount.toFixed(0)} F</Text>
            </View>
        </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Historique Commissions</Text>
        </View>

        {/* BARRE DE FILTRES */}
        <View style={styles.filterContainer}>
            <FlatList 
                horizontal 
                showsHorizontalScrollIndicator={false}
                data={FILTERS}
                keyExtractor={item => item.value}
                contentContainerStyle={{paddingHorizontal: 15, gap: 10}}
                renderItem={({item}) => (
                    <TouchableOpacity 
                        style={[styles.filterChip, period === item.value && styles.activeChip]}
                        onPress={() => setPeriod(item.value)}
                    >
                        <Text style={[styles.filterText, period === item.value && {color:'#FFF'}]}>{item.label}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>

        {/* RÉSUMÉ PÉRIODE */}
        <View style={styles.summary}>
            <View>
                <Text style={styles.summaryLabel}>Total Frais Générés</Text>
                <Text style={styles.summaryValue}>{totals.fees.toLocaleString()} F</Text>
            </View>
            <View style={{alignItems:'flex-end'}}>
                <Text style={styles.summaryLabel}>Gain Société Net</Text>
                <Text style={[styles.summaryValue, {color:'#10B981'}]}>+{totals.platform.toLocaleString()} F</Text>
            </View>
        </View>

        {/* LISTE */}
        {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} />
        ) : (
            <FlatList
                data={history}
                keyExtractor={item => item.id}
                contentContainerStyle={{padding: 15, paddingBottom: 100}}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 50, color:'#9CA3AF'}}>Aucune commission sur cette période.</Text>}
            />
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { padding: 20, backgroundColor: '#1E293B' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
    
    filterContainer: { backgroundColor: '#1E293B', paddingBottom: 15 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#334155' },
    activeChip: { backgroundColor: colors.primary },
    filterText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },

    summary: { flexDirection:'row', justifyContent:'space-between', backgroundColor:'#FFF', margin:15, padding:15, borderRadius:12, elevation:2 },
    summaryLabel: { fontSize: 11, color:'#64748B', textTransform:'uppercase', fontWeight:'700' },
    summaryValue: { fontSize: 20, fontWeight:'800', color:'#1E293B' },

    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 10, elevation: 1 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBox: { width: 24, height: 24, borderRadius: 12, justifyContent:'center', alignItems:'center' },
    ref: { fontWeight: '700', color: '#334155', fontSize: 13 },
    date: { color: '#94A3B8', fontSize: 11 },
    fees: { fontWeight: '700', color: '#64748B' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
    
    breakdown: { flexDirection: 'row', justifyContent: 'space-between' },
    part: { alignItems: 'center', flex: 1 },
    label: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
    value: { fontSize: 13, fontWeight: '700', color: '#334155' }
});