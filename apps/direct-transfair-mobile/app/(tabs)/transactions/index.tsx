// apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Platform, SafeAreaView, StatusBar, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider"; 

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEME_CLIENT = { primary: "#059669", light: "#ECFDF5", bg: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B", border: "#E2E8F0" };

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: "EN ATTENTE", color: "#D97706", bg: "#FEF3C7" },
    VALIDATED: { label: "DISPONIBLE", color: "#2563EB", bg: "#DBEAFE" },
    PAID: { label: "PAYÉ", color: "#059669", bg: "#D1FAE5" },
    CANCELLED: { label: "ANNULÉ", color: "#DC2626", bg: "#FEE2E2" },
};

export default function TransactionsScreen() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try {
      if (transactions.length === 0 && !refreshing) setLoading(true);
      const res = await api.getTransactions();
      const safeList = Array.isArray(res) ? res : [];
      const sorted = safeList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
    } catch (e) { setTransactions([]); } finally { setLoading(false); setRefreshing(false); }
  }, [refreshing, transactions.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); };

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => {
      const bName = t.beneficiary?.fullName?.toLowerCase() || "";
      const bPhone = t.beneficiary?.phone || "";
      const sName = (t.senderFirstName && t.senderLastName) ? `${t.senderFirstName} ${t.senderLastName}`.toLowerCase() : "";
      return bName.includes(q) || bPhone.includes(q) || sName.includes(q) || t.reference?.toLowerCase().includes(q);
    });
  }, [transactions, searchQuery]);

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.createdAt);
    const statusStyle = STATUS_MAP[item.status] || { label: item.status, color: "#64748B", bg: "#F1F5F9" };

    const isRefill = item.type === 'REFILL' || item.type === 'AGENCY_REFILL';
    const isDeposit = item.type === 'DEPOSIT';
    const isIncoming = item.beneficiaryId === user?.id || isDeposit || (isRefill && item.agencyId === user?.agencyId);
    
    let titleLabel = "Envoi d'argent";
    let sign = "-";
    let amountColor = THEME_CLIENT.text; 
    let icon = "paper-plane";
    let iconColor = "#D97706"; 
    let iconBg = "#FFFBEB";
    let detailText = "";

    if (isRefill) {
        titleLabel = "Alimentation Caisse"; sign = "+"; amountColor = THEME_CLIENT.primary; icon = "download"; iconColor = THEME_CLIENT.primary; iconBg = THEME_CLIENT.light;
    } else if (isIncoming) {
        titleLabel = isDeposit ? "Dépôt en agence" : "Transfert reçu"; sign = "+"; amountColor = THEME_CLIENT.primary; icon = "arrow-down"; iconColor = THEME_CLIENT.primary; iconBg = THEME_CLIENT.light;
        if (item.senderFirstName && item.senderLastName) detailText = `${item.senderFirstName} ${item.senderLastName}`;
    } else {
        if (item.beneficiary) detailText = item.beneficiary.fullName || item.beneficiary.phone;
    }

    return (
      <View style={s.cardWrapper}>
        <TouchableOpacity style={s.card} activeOpacity={0.8} onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}>
          <View style={s.cardMain}>
            <View style={[s.iconBox, {backgroundColor: iconBg}]}><Ionicons name={icon as any} size={22} color={iconColor} /></View>
            <View style={s.infoContainer}>
                <Text style={s.title} numberOfLines={1}>{titleLabel}</Text>
                {detailText ? <Text style={s.details} numberOfLines={1}>{detailText}</Text> : null}
                <Text style={s.dateSubtitle} numberOfLines={1}>{date.toLocaleDateString('fr-FR')} • Réf: {item.reference?.substring(0, 10) || "N/A"}</Text>
            </View>
            <View style={s.amountContainer}>
                <Text style={[s.amount, {color: amountColor}]} adjustsFontSizeToFit numberOfLines={1}>{sign} {Number(item.amount).toLocaleString('fr-FR')} <Text style={s.currency}>{item.currency}</Text></Text>
                <View style={[s.badge, { backgroundColor: statusStyle.bg }]}><Text style={[s.badgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text></View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_CLIENT.bg} />
      <View style={s.header}>
        <Text style={s.pageTitle}>Historique</Text>
        <View style={s.searchContainer}>
          <Ionicons name="search" size={20} color={THEME_CLIENT.muted} />
          <TextInput style={s.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Tél., Réf., Nom de contact" placeholderTextColor={THEME_CLIENT.muted} />
        </View>
      </View>
      <View style={s.container}>
        {loading && !refreshing && transactions.length === 0 ? (
          <ActivityIndicator size="large" color={THEME_CLIENT.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList data={filteredTransactions} keyExtractor={(item) => item.id.toString()} renderItem={renderItem} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME_CLIENT.primary} />} contentContainerStyle={s.listContainer} ListEmptyComponent={<View style={s.empty}><View style={s.emptyIconBg}><Ionicons name="document-text" size={40} color={THEME_CLIENT.border} /></View><Text style={s.emptyText}>Aucune transaction trouvée.</Text></View>} />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME_CLIENT.bg },
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 16, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  pageTitle: { fontSize: 32, fontFamily: FONTS.heading, fontWeight: "800", color: THEME_CLIENT.text },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME_CLIENT.surface, borderRadius: 16, paddingHorizontal: 16, height: 50, marginTop: 20, borderWidth: 1, borderColor: THEME_CLIENT.border, shadowColor: THEME_CLIENT.text, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: FONTS.body, color: THEME_CLIENT.text, fontWeight: '600' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  cardWrapper: { marginBottom: 12 },
  card: { backgroundColor: THEME_CLIENT.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME_CLIENT.border, shadowColor: THEME_CLIENT.text, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardMain: { flexDirection: "row", alignItems: "center" },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent:'center', alignItems:'center' },
  infoContainer: { flex: 1, marginLeft: 14, marginRight: 8, justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: FONTS.heading, fontWeight: "800", color: THEME_CLIENT.text, marginBottom: 2 },
  details: { fontSize: 13, fontFamily: FONTS.body, color: THEME_CLIENT.text, fontWeight: "700", marginBottom: 2 },
  dateSubtitle: { fontSize: 11, fontFamily: FONTS.body, color: THEME_CLIENT.muted, fontWeight: "600" },
  amountContainer: { alignItems: 'flex-end', justifyContent: 'center' },
  amount: { fontSize: 16, fontFamily: FONTS.heading, fontWeight: "900", marginBottom: 6 },
  currency: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontFamily: FONTS.body, fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME_CLIENT.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: THEME_CLIENT.border },
  emptyText: { fontFamily: FONTS.body, color: THEME_CLIENT.muted, fontSize: 16, fontWeight: "600", textAlign: 'center' },
});