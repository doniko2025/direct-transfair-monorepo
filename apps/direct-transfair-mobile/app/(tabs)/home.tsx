//apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  StatusBar, SafeAreaView, RefreshControl, Modal, TextInput, ActivityIndicator, Alert, Platform 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";
import { api } from "../../services/api";

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);

  // Etats pour la modal de déclaration PAIEMENT SERVICE
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [user?.id])
  );

  const loadData = async () => {
      setRefreshing(true);
      try {
          await refreshUser();
          if (user?.role === 'AGENT' && user?.agencyId) {
              const data = await api.getAgency(user.agencyId);
              setAgencyData(data);
          }
      } catch (e) {
          console.log("Erreur chargement", e);
      } finally {
          setRefreshing(false);
      }
  };

  const handleOpenDeclare = () => {
      setAmount("");
      setRefBancaire("");
      setModalVisible(true);
  };

  const handleSubmitDeclare = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          if (Platform.OS === 'web') alert("Montant invalide");
          else Alert.alert("Erreur", "Montant invalide");
          return;
      }
      if (!refBancaire) {
          if (Platform.OS === 'web') alert("Référence requise");
          else Alert.alert("Erreur", "La référence du virement est requise");
          return;
      }

      setProcessing(true);
      try {
          await api.declareBankTransfer(Number(amount), refBancaire);
          setModalVisible(false);
          
          const msg = "Paiement déclaré. Votre solde sera débité après validation par le Super Admin.";
          if (Platform.OS === 'web') alert(msg);
          else Alert.alert("Succès", msg);
          
          loadData(); // Rafraîchir
      } catch (e: any) {
          const err = e.response?.data?.message || "Erreur technique";
          if (Platform.OS === 'web') alert(err);
          else Alert.alert("Erreur", err);
      } finally {
          setProcessing(false);
      }
  };

  if (!user) return null;

  // --- CLIENT (USER) ---
  if (user.role === 'USER') {
    return (
      <DashboardLayout title={`Bonjour ${user.firstName}`} subtitle="Mon Portefeuille" badge="wallet" badgeColor={colors.primary} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
         <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceValue}>{user.balance ? Number(user.balance).toLocaleString('fr-FR') : "0"} {(user as any).currency || 'XOF'}</Text>
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

  // --- AGENT ---
  if (user.role === 'AGENT') {
    const currency = agencyData?.currency || "XOF"; 
    const agencyName = (user as any).client?.name || agencyData?.name || "Agence";

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
        
        <Text style={styles.sectionTitle}>Guichet</Text>
        <View style={styles.grid}>
            <MenuCard title="Dépôt Client" subtitle="Recharger un compte" icon="arrow-down-circle" color="#10B981" onPress={() => router.push("/agent/deposit")} />
            <MenuCard title="Envoi Espèces" subtitle="Client de passage" icon="paper-plane" color="#3B82F6" onPress={() => router.push("/agent/send-cash")} />
            <MenuCard title="Retrait" subtitle="Payer un code" icon="wallet" color="#EF4444" onPress={() => router.push("/agent/withdraw")} />
        </View>
      </DashboardLayout>
    );
  }

  // --- ADMIN SOCIÉTÉ ---
  if (user.role === 'COMPANY_ADMIN') {
    return (
      <DashboardLayout title={user.client?.name || "Admin"} subtitle="Pilotage" badge="business" badgeColor="#F59E0B" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        
        {/* CARTE TRÉSORERIE */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/(tabs)/admin/treasury")}>
            <View style={[styles.balanceCard, {backgroundColor: '#1E293B'}]}>
                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                    <Text style={styles.balanceLabel}>Trésorerie Globale</Text>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </View>
                <Text style={styles.balanceValue}>{user.balance ? Number(user.balance).toLocaleString('fr-FR') : "0"} XOF</Text>
                
                {/* ✅ BOUTON PAIEMENT SERVICE (Visible et clair) */}
                <TouchableOpacity style={styles.fundBtn} onPress={handleOpenDeclare}>
                    <Ionicons name="card" size={20} color="#1E293B" />
                    <Text style={styles.fundText}>Payer Facture / Service</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Réseau & Agences</Text>
        <View style={styles.grid}>
            <MenuCard 
                title="Créer une Agence" 
                subtitle="Privée ou Partenaire" 
                icon="add-circle" 
                color="#8B5CF6" 
                onPress={() => router.push("/(tabs)/admin/agencies/create")} 
            />
            
            <View style={styles.row}>
                <MenuCard 
                    title="Mes Agences" 
                    subtitle="Liste & Soldes" 
                    icon="storefront" 
                    color="#3B82F6" 
                    onPress={() => router.push("/(tabs)/admin/agencies")} 
                    fullWidth={false} 
                />
                
                <MenuCard 
                    title="Utilisateurs" 
                    subtitle="Agents & Staff" 
                    icon="people" 
                    color="#F59E0B" 
                    onPress={() => router.push("/(tabs)/admin/users")} 
                    fullWidth={false} 
                />
            </View>
        </View>

        <Text style={styles.sectionTitle}>Finance & Commissions</Text>
        <View style={styles.grid}>
            <MenuCard title="Config. Commissions" subtitle="Répartition Partenaires" icon="pie-chart" color="#EF4444" onPress={() => router.push("/(tabs)/admin/commissions/config")} />
            <MenuCard title="Journal des Gains" subtitle="Qui a gagné quoi ?" icon="cash" color="#10B981" onPress={() => router.push("/(tabs)/admin/commissions/history")} />
        </View>

        {/* MODAL DECLARATION PAIEMENT */}
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Payer une Facture</Text>
                  <Text style={styles.modalSubtitle}>
                      Déclarez ici le virement effectué au Super Admin pour régler les frais de service ou la location du système.
                  </Text>

                  <Text style={styles.inputLabel}>Montant Payé (FCFA)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={amount} 
                    onChangeText={setAmount} 
                    keyboardType="numeric" 
                    placeholder="Ex: 500000" 
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                  />

                  <Text style={styles.inputLabel}>Référence du Virement</Text>
                  <TextInput 
                    style={styles.input} 
                    value={refBancaire} 
                    onChangeText={setRefBancaire} 
                    placeholder="Ex: REF-BANQUE-123"
                    placeholderTextColor="#9CA3AF" 
                  />

                  <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitDeclare} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>VALIDER LE PAIEMENT</Text>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={processing}>
                      <Text style={styles.cancelText}>Annuler</Text>
                  </TouchableOpacity>
              </View>
          </View>
        </Modal>

      </DashboardLayout>
    );
  }

  // --- SUPER ADMIN ---
  if (user.role === 'SUPER_ADMIN') {
    return (
        <DashboardLayout title="Super Admin" subtitle="Direct Transf'air" badge="shield-checkmark" badgeColor="#FFD700" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
          <Text style={styles.sectionTitle}>SaaS Management</Text>
          <View style={styles.grid}>
              <MenuCard title="Sociétés" subtitle="Gestion Clients" icon="briefcase" color="#F59E0B" onPress={() => router.push("/(tabs)/admin/super-dashboard")} />
              <MenuCard title="Trésorerie" subtitle="Recharges & Fonds" icon="cash" color="#10B981" onPress={() => router.push("/(tabs)/admin/treasury")} />
              <MenuCard title="Config Globale" subtitle="Taux & Devises" icon="globe" color="#6B7280" onPress={() => router.push("/(tabs)/admin/rates")} />
          </View>
        </DashboardLayout>
    );
  }

  return null;
}

// --- UI HELPERS ---
function DashboardLayout({ title, subtitle, badge, badgeColor, children, refreshControl }: any) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor="#1F2937" barStyle="light-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Text style={styles.headerSubtitle}>{subtitle}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
                    <Ionicons name={badge} size={24} color={badgeColor} />
                </View>
            </View>
            <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
                {children}
            </ScrollView>
        </SafeAreaView>
    );
}

function MenuCard({ title, subtitle, icon, color, onPress, fullWidth = true }: any) {
    return (
        <TouchableOpacity style={[styles.card, !fullWidth && { flex: 1 }]} onPress={onPress}>
            <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={26} color={color} />
            </View>
            <View style={{flex:1}}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#E5E7EB" />
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1F2937" },
  header: { backgroundColor: "#1F2937", padding: 20, paddingBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: "#9CA3AF", fontSize: 13, marginTop:2 },
  badge: { padding: 8, borderRadius: 12 },
  container: { flexGrow: 1, backgroundColor: "#F9FAFB", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#374151', marginTop: 20 },
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 2, borderWidth:1, borderColor:'#F3F4F6', shadowColor: "#000", shadowOpacity: 0.02, elevation: 1, minHeight: 80 },
  iconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" }, 
  cardSubtitle: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  balanceCard: { backgroundColor: colors.primary, padding: 20, borderRadius: 18, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.1, elevation: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 4, fontWeight:'500' },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom:5 },
  topUpBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:6, borderRadius:20, alignSelf:'flex-start' },
  topUpText: { color:'#FFF', fontWeight:'600', fontSize:12, marginLeft:6 },
  
  // Style Bouton Payer Facture (Blanc, arrondi)
  fundBtn: { 
      backgroundColor: '#FFF', 
      paddingHorizontal: 16, 
      paddingVertical: 12, 
      borderRadius: 12, 
      flexDirection: 'row', 
      alignItems: 'center', 
      alignSelf: 'flex-start', 
      marginTop: 15,
      shadowColor: "#000", 
      shadowOpacity: 0.1, 
      elevation: 2 
  },
  fundText: { color: '#1E293B', fontWeight: '700', fontSize: 13, marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 350 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 18 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 24 },
  confirmBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  confirmText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#6B7280', fontWeight: '600' }
});