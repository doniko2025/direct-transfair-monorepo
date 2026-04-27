//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/history.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator, Platform, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF" },
  AGENT: { primary: "#78350F", light: "#FFF7ED" },
  USER: { primary: "#059669", light: "#ECFDF5" },
};

const FILTERS = [
    { label: "Aujourd'hui", value: "TODAY" },
    { label: "7 Jours", value: "WEEK" },
    { label: "Ce Mois", value: "MONTH" },
    { label: "Trimestre", value: "QUARTER" },
    { label: "Année", value: "YEAR" },
];

export default function CommissionHistoryScreen() {
  const { user } = useAuth();
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;

  const [period, setPeriod] = useState("TODAY");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ platform: 0, fees: 0 });

  useEffect(() => {
    const initFetch = async () => { await fetchHistory(); };
    initFetch();
  }, [period]); 

  const fetchHistory = async () => {
      setLoading(true);
      try {
          if (typeof api.getCommissionHistory !== 'function') return;
          const data = await api.getCommissionHistory(period);
          const safeData = Array.isArray(data) ? data : [];
          setHistory(safeData);

          const totalFees = safeData.reduce((acc: number, item: any) => acc + (item.fees || 0), 0);
          const totalPlatform = safeData.reduce((acc: number, item: any) => acc + (item.breakdown?.platform?.amount || 0), 0);
          setTotals({ fees: totalFees, platform: totalPlatform });
      } catch (e) {
          console.error("Erreur historique commissions:", e);
      } finally {
          setLoading(false);
      }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={s.card}>
        <View style={s.rowBetween}>
            <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                <View style={[s.iconBox, item.status === 'PAID' ? {backgroundColor:'#D1FAE5'} : {backgroundColor:'#FEF3C7'}]}>
                    <Ionicons name={item.status === 'PAID' ? "checkmark" : "time"} size={16} color={item.status === 'PAID' ? "#059669" : "#D97706"} />
                </View>
                <View>
                    <Text style={s.ref}>{item.reference || 'REF-N/A'}</Text>
                    <Text style={s.date}>
                        {item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '--'} • 
                        {item.date ? new Date(item.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '--'}
                    </Text>
                </View>
            </View>
            <Text style={s.fees}>{item.fees || 0} F</Text>
        </View>

        <View style={s.divider} />

        <View style={s.breakdown}>
            <View style={s.part}>
                <Text style={s.label}>Envoyeur</Text>
                <Text style={s.value}>+{(item.breakdown?.sender?.amount || 0).toFixed(0)} F</Text>
            </View>
            <View style={s.dividerVert} />
            <View style={s.part}>
                <Text style={s.label}>Payeur</Text>
                <Text style={s.value}>+{(item.breakdown?.payer?.amount || 0).toFixed(0)} F</Text>
            </View>
            <View style={s.dividerVert} />
            <View style={s.part}>
                <Text style={[s.label, {color: theme.primary}]}>Plateforme</Text>
                <Text style={[s.value, {color: theme.primary, fontSize: 14}]}>+{(item.breakdown?.platform?.amount || 0).toFixed(0)} F</Text>
            </View>
        </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.primary }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        <View style={[s.header, { backgroundColor: theme.primary }]}>
            <Text style={s.headerTitle}>Historique Commissions</Text>
        </View>

        <View style={[s.filterContainer, { backgroundColor: theme.primary }]}>
            <FlatList 
                horizontal 
                showsHorizontalScrollIndicator={false}
                data={FILTERS}
                keyExtractor={item => item.value}
                contentContainerStyle={{paddingHorizontal: 20, gap: 10, paddingBottom: 20}}
                renderItem={({item}) => (
                    <TouchableOpacity 
                        style={[s.filterChip, period === item.value && s.activeChip]}
                        onPress={() => setPeriod(item.value)}
                        activeOpacity={0.8}
                    >
                        <Text style={[s.filterText, period === item.value && {color: theme.primary, fontWeight: '900'}]}>{item.label}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>

        <View style={s.container}>
          <View style={s.summary}>
              <View>
                  <Text style={s.summaryLabel}>Total Frais perçus</Text>
                  <Text style={s.summaryValue}>{totals.fees.toLocaleString('fr-FR')} F</Text>
              </View>
              <View style={{alignItems:'flex-end'}}>
                  <Text style={s.summaryLabel}>Gain Plateforme net</Text>
                  <Text style={[s.summaryValue, {color: '#10B981'}]}>+{totals.platform.toLocaleString('fr-FR')} F</Text>
              </View>
          </View>

          {loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{marginTop: 50}} />
          ) : (
              <FlatList
                  data={history}
                  keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                  contentContainerStyle={{padding: 20, paddingBottom: 100}}
                  renderItem={renderItem}
                  ListEmptyComponent={
                    <View style={s.emptyState}>
                      <Ionicons name="receipt" size={48} color="#CBD5E1" />
                      <Text style={s.emptyText}>Aucune commission sur cette période.</Text>
                    </View>
                  }
              />
          )}
        </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
    header: { padding: 24, paddingTop: Platform.OS === 'android' ? 40 : 10 },
    headerTitle: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: '800', color: '#FFF' },
    
    filterContainer: { paddingBottom: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'transparent' },
    activeChip: { backgroundColor: '#FFF', borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    filterText: { color: 'rgba(255,255,255,0.8)', fontFamily: FONTS.body, fontSize: 13, fontWeight: '700' },
    
    summary: { flexDirection:'row', justifyContent:'space-between', backgroundColor:'#FFF', margin: 20, padding: 20, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
    summaryLabel: { fontSize: 11, fontFamily: FONTS.body, color:'#94A3B8', textTransform:'uppercase', fontWeight:'900', letterSpacing: 0.5, marginBottom: 4 },
    summaryValue: { fontSize: 22, fontFamily: FONTS.heading, fontWeight:'900', color:'#0F172A' },
    
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBox: { width: 36, height: 36, borderRadius: 12, justifyContent:'center', alignItems:'center' },
    ref: { fontWeight: '800', fontFamily: FONTS.body, color: '#1E293B', fontSize: 14, marginBottom: 2 },
    date: { color: '#64748B', fontFamily: FONTS.body, fontSize: 11, fontWeight: '600' },
    fees: { fontWeight: '900', fontFamily: FONTS.heading, color: '#475569', fontSize: 16 },
    
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
    dividerVert: { width: 1, backgroundColor: '#F1F5F9', height: '100%' },
    
    breakdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    part: { alignItems: 'center', flex: 1 },
    label: { fontSize: 10, fontFamily: FONTS.body, color: '#94A3B8', fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
    value: { fontSize: 13, fontFamily: FONTS.body, fontWeight: '800', color: '#1E293B' },

    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { fontFamily: FONTS.body, color: '#94A3B8', marginTop: 10, fontSize: 14, fontWeight: '600' }
});