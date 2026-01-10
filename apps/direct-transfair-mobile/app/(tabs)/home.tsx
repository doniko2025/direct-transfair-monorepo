//apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  // ============================================================
  // 1. CLIENT (Wallet Personnel)
  // ============================================================
  if (user.role === 'USER') {
    return (
      <DashboardLayout title={`Bonjour ${user.firstName}`} subtitle="Mon Portefeuille" badge="wallet" badgeColor={colors.primary}>
         <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceValue}>
                {user.balance ? Number(user.balance).toLocaleString('fr-FR') : "0"} {(user as any).currency || 'EUR'}
            </Text>
            <TouchableOpacity style={styles.topUpBtn} onPress={() => router.push("/topup")}>
                <Ionicons name="add-circle" size={18} color="#FFF" />
                <Text style={styles.topUpText}>Recharger mon compte</Text>
            </TouchableOpacity>
         </View>
         
         <Text style={styles.sectionTitle}>Actions Rapides</Text>
         <View style={styles.grid}>
            <View style={styles.row}>
                <MenuCard title="Envoyer" subtitle="International" icon="paper-plane" color="#F59E0B" onPress={() => router.push("/(tabs)/send")} fullWidth={false}/>
                <MenuCard title="Wallet à Wallet" subtitle="Gratuit & Instantané" icon="swap-horizontal" color="#10B981" onPress={() => router.push("/wallet-transfer")} fullWidth={false}/>
            </View>
            <MenuCard title="Bénéficiaires" subtitle="Mes contacts" icon="people" color="#3B82F6" onPress={() => router.push("/(tabs)/beneficiaries")} />
            <MenuCard title="Parrainer" subtitle="Gagner des bonus" icon="gift" color="#EC4899" onPress={() => router.push("/referral")} />
         </View>
      </DashboardLayout>
    );
  }

  // ============================================================
  // 2. AGENT (Guichetier)
  // ============================================================
  if (user.role === 'AGENT') {
    return (
      <DashboardLayout title="Espace Guichet" subtitle={`Agence: ${user.client?.name || 'Principale'}`} badge="storefront" badgeColor="#10B981">
        
        <View style={[styles.balanceCard, {backgroundColor: '#064E3B'}]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', width:'100%', marginBottom: 10}}>
                <Text style={styles.balanceLabel}>Solde Caisse (Virtuel)</Text>
                <View style={{alignItems:'flex-end'}}>
                    <Text style={{color:'#A7F3D0', fontSize:10, fontWeight:'700'}}>PLAFOND</Text>
                    <Text style={{color:'#FFF', fontSize:12, fontWeight:'700'}}>5 000 000 FCFA</Text>
                </View>
            </View>
            <Text style={styles.balanceValue}>
                {user.balance ? Number(user.balance).toLocaleString('fr-FR') : "2 500 000"} FCFA
            </Text>
            <View style={{flexDirection:'row', backgroundColor:'rgba(255,255,255,0.1)', padding:8, borderRadius:20, marginTop:5}}>
                <Ionicons name="trending-up" size={16} color="#34D399" style={{marginRight:5}} />
                <Text style={{color:'#FFF', fontSize:12, fontWeight:'600'}}>Commissions du jour: 12 500 FCFA</Text>
            </View>
        </View>

        <Text style={styles.sectionTitle}>Opérations Guichet</Text>
        <View style={styles.grid}>
            <View style={styles.row}>
                <MenuCard 
                    title="Envoi Espèces" 
                    subtitle="Client de passage" 
                    icon="paper-plane" 
                    color="#3B82F6" 
                    onPress={() => router.push("/agent/send-cash")} 
                    fullWidth={false}
                />
                <MenuCard 
                    title="Retrait / Cash-Out" 
                    subtitle="Payer un code" 
                    icon="wallet" 
                    color="#EF4444" 
                    onPress={() => router.push("/agent/withdraw")} 
                    fullWidth={false}
                />
            </View>

            <View style={styles.row}>
                <MenuCard 
                    title="Dépôt / Cash-In" 
                    subtitle="Recharger un client" 
                    icon="arrow-down-circle" 
                    color="#10B981" 
                    // ✅ CÂBLAGE DU BOUTON DÉPÔT
                    onPress={() => router.push("/agent/deposit")} 
                    fullWidth={false}
                />
                <MenuCard 
                    title="Recharger Caisse" 
                    subtitle="Via OM / Wave" 
                    icon="add-circle" 
                    color="#F59E0B" 
                    onPress={() => router.push("/topup")} 
                    fullWidth={false}
                />
            </View>
            
            <MenuCard 
                title="Mes Transactions" 
                subtitle="Historique de la journée" 
                icon="list" 
                color="#6B7280" 
                onPress={() => router.push("/(tabs)/transactions")} 
            />
        </View>
      </DashboardLayout>
    );
  }

  // ... (Code Admin inchangé)
  if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') {
      return <DashboardLayout title="Admin" subtitle="Administration" badge="business" badgeColor="#F59E0B"><Text>Mode Admin</Text></DashboardLayout>;
  }

  return null;
}

// --- UI COMPONENTS ---
function DashboardLayout({ title, subtitle, badge, badgeColor, children }: any) {
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
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
                {/* ✅ CORRECTION ICI : Suppression de numberOfLines={1} pour éviter la coupure */}
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            {fullWidth && <Ionicons name="chevron-forward" size={18} color="#E5E7EB" />}
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#374151', marginTop: 10 },
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 }, // Alignement horizontal

  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    padding: 14, 
    borderRadius: 14, 
    marginBottom: 2, 
    borderWidth:1, 
    borderColor:'#F3F4F6', 
    shadowColor: "#000", 
    shadowOpacity: 0.02, 
    elevation: 1,
    minHeight: 80 // Hauteur minimale pour accommoder 2 lignes si besoin
  },
  iconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", flexWrap: 'wrap' }, // Permet le retour à la ligne
  cardSubtitle: { fontSize: 11, color: "#6B7280", marginTop: 2, flexWrap: 'wrap' },

  balanceCard: { backgroundColor: colors.primary, padding: 20, borderRadius: 18, marginBottom: 25, alignItems:'center', shadowColor: "#000", shadowOpacity: 0.1, elevation: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 4, fontWeight:'500' },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom:12 },
  topUpBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  topUpText: { color:'#FFF', fontWeight:'600', fontSize:12, marginLeft:6 }
});