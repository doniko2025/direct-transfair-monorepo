// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Alert
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider"; 
import { colors } from "../../../theme/colors";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: "En attente", color: "#D97706", bg: "#FEF3C7" },
    VALIDATED: { label: "Disponible", color: "#2563EB", bg: "#DBEAFE" },
    PAID: { label: "Payé", color: "#059669", bg: "#D1FAE5" },
    CANCELLED: { label: "Annulé", color: "#DC2626", bg: "#FEE2E2" },
};

export default function TransactionsScreen() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (transactions.length === 0 && !refreshing) setLoading(true);
      
      let res;
      // Sélection de la méthode API selon le rôle
      if (user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN') {
          res = await api.adminGetTransactions();
      } else {
          res = await api.getTransactions();
      }

      const safeList = Array.isArray(res) ? res : [];
      const sorted = safeList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
    } catch (e) { 
        console.log("Erreur chargement transactions", e); 
        setTransactions([]);
    } finally { 
        setLoading(false); 
        setRefreshing(false);
    }
  }, [user?.role, refreshing, transactions.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const handleValidateB2B = async (id: string) => {
      setValidating(id);
      try {
          await api.validateBankTransfer(id);
          if (Platform.OS === 'web') alert("Virement validé !");
          else Alert.alert("Succès", "Virement validé, solde de la société débité.");
          onRefresh(); // Recharger la liste
      } catch (e: any) {
          const err = e.response?.data?.message || "Erreur validation";
          if (Platform.OS === 'web') alert(err);
          else Alert.alert("Erreur", err);
      } finally {
          setValidating(null);
      }
  };

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.createdAt);
    const statusStyle = STATUS_MAP[item.status] || { label: item.status, color: "#6B7280", bg: "#F3F4F6" };
    
    // B2B Logic
    const isB2B = item.type === 'SERVICE_PAYMENT';
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const canValidateB2B = isB2B && isSuperAdmin && item.status === 'PENDING';

    // ✅ NOUVELLE LOGIQUE D'AFFICHAGE AGENCE
    // Est-ce moi qui ai traité le retrait ?
    const isMyWithdrawal = item.withdrawal?.processedById === user?.id;
    // Est-ce moi qui ai envoyé l'argent ?
    const isMySend = item.senderId === user?.id;

    // Définition des textes et couleurs
    let label = isMyWithdrawal ? "Retrait Client" : (isB2B ? "Paiement Service" : "Envoi d'argent");
    let amountColor = isMyWithdrawal ? "#10B981" : "#111827"; // Vert si retrait (gain virtuel), Noir si envoi
    let icon = isMyWithdrawal ? "arrow-down-circle" : "arrow-up-circle"; // Flèche bas (entrée) ou haut (sortie)
    let sign = isMyWithdrawal ? "+" : "-";

    return (
      <View style={styles.cardWrapper}>
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.7} 
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      >
        <View style={styles.rowTop}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                {/* Icône dynamique selon le type */}
                <View style={[styles.iconBox, isB2B && {backgroundColor:'#DBEAFE'}, isMyWithdrawal && {backgroundColor:'#D1FAE5'}]}>
                    <Ionicons 
                        name={isB2B ? "briefcase" : (isMyWithdrawal ? "arrow-down" : "paper-plane")} 
                        size={16} 
                        color={isB2B ? "#1E3A8A" : (isMyWithdrawal ? "#059669" : colors.primary)} 
                    />
                </View>
                <View>
                    <Text style={styles.reference}>
                        {label} <Text style={{fontWeight:'400', color:'#6B7280'}}>• {item.reference}</Text>
                    </Text>
                    <Text style={styles.date}>{date.toLocaleDateString('fr-FR')} • {date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DDD" />
        </View>
        <View style={styles.rowBottom}>
            {/* Montant avec Signe et Couleur */}
            <Text style={[styles.amount, {color: amountColor}]}>
                {sign} {Number(item.amount).toLocaleString('fr-FR')} <Text style={{fontSize:14, color:'#6B7280', fontWeight:'600'}}>{item.currency}</Text>
            </Text>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}><Text style={[styles.badgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text></View>
        </View>
      </TouchableOpacity>

      {/* BOUTON VALIDATION RAPIDE (SUPER ADMIN) */}
      {canValidateB2B && (
          <TouchableOpacity 
            style={styles.validateBtn} 
            onPress={() => handleValidateB2B(item.id)}
            disabled={validating === item.id}
          >
              {validating === item.id ? <ActivityIndicator size="small" color="#FFF"/> : <Text style={styles.validateText}>Valider le Paiement</Text>}
          </TouchableOpacity>
      )}
      </View>
    );
  };

  if (loading && !refreshing && transactions.length === 0) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
            <View style={{margin: 20, marginBottom: 10}}>
                <Text style={styles.title}>
                    {user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' ? "Supervision Transactions" : "Historique"}
                </Text>
            </View>
        }
        ListEmptyComponent={
            <View style={styles.center}>
                <Ionicons name="document-text-outline" size={48} color="#DDD" />
                <Text style={styles.empty}>Aucune transaction trouvée.</Text>
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
  title: { fontSize: 24, fontWeight: "800", color: '#1F2937' },
  empty: { textAlign: "center", color: "#9CA3AF", marginTop: 10, fontSize: 14 },
  cardWrapper: { marginHorizontal: 20, marginBottom: 10 },
  card: { padding: 15, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#F3F4F6", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems:'center', marginBottom: 12, borderBottomWidth:1, borderBottomColor:'#F9FAFB', paddingBottom:10 },
  iconBox: { width:32, height:32, borderRadius:10, backgroundColor:'#F0FDF4', justifyContent:'center', alignItems:'center', marginRight:10 },
  reference: { fontWeight: "700", color: "#374151", fontSize: 13 },
  date: { fontSize: 11, color: "#9CA3AF", marginTop:2 },
  rowBottom: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  amount: { fontSize: 18, fontWeight: "800", color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontWeight: "700", fontSize: 10, textTransform:'uppercase', letterSpacing:0.5 },
  validateBtn: { backgroundColor: '#10B981', padding: 12, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, marginTop: -5, alignItems: 'center', zIndex: -1 },
  validateText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 }
});