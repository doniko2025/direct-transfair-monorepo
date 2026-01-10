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
         {/* Carte Solde */}
         <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            
            {/* ✅ CORRECTION : Affichage dynamique + Fix Erreur TypeScript (as any) */}
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
            <MenuCard title="Envoyer" subtitle="Vers un proche" icon="paper-plane" color="#F59E0B" onPress={() => router.push("/(tabs)/send")} />
            <MenuCard title="Bénéficiaires" subtitle="Mes contacts" icon="people" color="#3B82F6" onPress={() => router.push("/(tabs)/beneficiaries")} />
            
            {/* ✅ LIEN VERS PARRAINAGE ACTIVÉ */}
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
      <DashboardLayout title="Espace Guichet" subtitle={`Agence: ${user.client?.name}`} badge="storefront" badgeColor="#10B981">
        <View style={[styles.balanceCard, {backgroundColor: '#064E3B'}]}>
            <Text style={styles.balanceLabel}>Solde Caisse (Virtuel)</Text>
            <Text style={styles.balanceValue}>5 000 000 FCFA</Text>
            <Text style={styles.balanceLabel}>Commissions: 12 500 FCFA</Text>
        </View>

        <Text style={styles.sectionTitle}>Opérations Client</Text>
        <View style={styles.grid}>
            <MenuCard title="Envoi Client" subtitle="Client sans compte" icon="send" color="#3B82F6" onPress={() => {}} />
            <MenuCard title="Dépôt (Cash-In)" subtitle="Recharger un Wallet" icon="arrow-down-circle" color="#10B981" onPress={() => {}} />
            <MenuCard title="Retrait (Cash-Out)" subtitle="Donner du cash" icon="arrow-up-circle" color="#EF4444" onPress={() => {}} />
            <MenuCard title="Recharge Tiers" subtitle="Orange Money / Wave" icon="phone-portrait" color="#F97316" onPress={() => {}} />
        </View>
      </DashboardLayout>
    );
  }

  // ============================================================
  // 3. ADMIN SOCIÉTÉ (Gestionnaire)
  // ============================================================
  if (user.role === 'COMPANY_ADMIN') {
    return (
      <DashboardLayout title={user.client?.name || "Administration"} subtitle="Pilotage Agences" badge="business" badgeColor="#F59E0B">
        <Text style={styles.sectionTitle}>Gestion</Text>
        <View style={styles.grid}>
            <MenuCard title="Mes Agences" subtitle="Créer / Modifier" icon="storefront" color="#8B5CF6" onPress={() => {}} />
            <MenuCard title="Taux & Frais" subtitle="Configuration" icon="settings" color="#6B7280" onPress={() => router.push("/(tabs)/admin/rates")} />
            <MenuCard title="Utilisateurs" subtitle="Staff & Clients" icon="people" color="#3B82F6" onPress={() => router.push("/(tabs)/admin/users")} />
        </View>

        <Text style={styles.sectionTitle}>Rapports</Text>
        <View style={styles.grid}>
            <MenuCard title="Comptabilité" subtitle="Soldes et profits" icon="calculator" color="#10B981" onPress={() => {}} />
            <MenuCard title="Exports" subtitle="PDF / Excel" icon="document-text" color="#EF4444" onPress={() => {}} />
        </View>
      </DashboardLayout>
    );
  }

  // ============================================================
  // 4. SUPER ADMIN (Propriétaire Plateforme)
  // ============================================================
  return (
      <DashboardLayout title="Super Admin" subtitle="Direct Transf'air" badge="shield-checkmark" badgeColor="#FFD700">
        <Text style={styles.sectionTitle}>SaaS Management</Text>
        <View style={styles.grid}>
            <MenuCard title="Sociétés" subtitle="Gestion des Clients" icon="briefcase" color="#F59E0B" onPress={() => router.push("/(tabs)/admin/super-dashboard")} />
            <MenuCard title="Paiements" subtitle="Encaissements Loyer" icon="card" color="#10B981" onPress={() => {}} />
            <MenuCard title="Contrats" subtitle="Générer documents" icon="document-attach" color="#3B82F6" onPress={() => {}} />
            <MenuCard title="Config Globale" subtitle="Devises & Taux" icon="globe" color="#6B7280" onPress={() => router.push("/(tabs)/admin/rates")} />
        </View>
      </DashboardLayout>
  );
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

function MenuCard({ title, subtitle, icon, color, onPress }: any) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
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
  
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#374151', marginTop: 10 },
  grid: { gap: 10 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 2, borderWidth:1, borderColor:'#F3F4F6', shadowColor: "#000", shadowOpacity: 0.02, elevation: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  cardSubtitle: { fontSize: 11, color: "#6B7280" },

  balanceCard: { backgroundColor: colors.primary, padding: 20, borderRadius: 18, marginBottom: 25, alignItems:'center', shadowColor: "#000", shadowOpacity: 0.1, elevation: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 4, fontWeight:'500' },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom:12 },
  topUpBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  topUpText: { color:'#FFF', fontWeight:'600', fontSize:12, marginLeft:6 }
});