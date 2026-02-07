//components/dashboards/CompanyDashboard.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Modal, TextInput, ActivityIndicator, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { DashboardLayout, MenuCard } from "./DashboardShared";

export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const handleSubmitDeclare = async () => {
      // (Même logique que ton ancien fichier)
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return alert("Montant invalide");
      setProcessing(true);
      try {
          await api.declareBankTransfer(Number(amount), refBancaire);
          setModalVisible(false);
          alert("Paiement déclaré avec succès !");
          loadData();
      } catch (e: any) {
          alert("Erreur: " + (e.response?.data?.message || "Erreur technique"));
      } finally {
          setProcessing(false);
      }
  };

  return (
    <DashboardLayout 
      title={user?.client?.name || "Admin"} 
      subtitle="Pilotage Société" 
      badge="business" 
      badgeColor="#F59E0B" 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
    >
      <View style={[styles.balanceCard, {backgroundColor: '#1E293B'}]}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
              <Text style={styles.balanceLabel}>Trésorerie Globale</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/admin/treasury")}>
                 <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </TouchableOpacity>
          </View>
          <Text style={styles.balanceValue}>{user?.balance ? Number(user.balance).toLocaleString('fr-FR') : "0"} XOF</Text>
          
          <TouchableOpacity style={styles.fundBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name="card" size={20} color="#1E293B" />
              <Text style={styles.fundText}>Payer Facture / Service</Text>
          </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Gestion</Text>
      <View style={styles.grid}>
          <MenuCard title="Créer une Agence" subtitle="Ajout réseau" icon="add-circle" color="#8B5CF6" onPress={() => router.push("/(tabs)/admin/agencies/create")} />
          <View style={{flexDirection:'row', gap:10}}>
            <MenuCard title="Mes Agences" subtitle="Liste" icon="storefront" color="#3B82F6" onPress={() => router.push("/(tabs)/admin/agencies")} fullWidth={false} />
            <MenuCard title="Utilisateurs" subtitle="Staff" icon="people" color="#F59E0B" onPress={() => router.push("/(tabs)/admin/users")} fullWidth={false} />
          </View>
          <MenuCard title="Commissions" subtitle="Configs & Historique" icon="pie-chart" color="#EF4444" onPress={() => router.push("/(tabs)/admin/commissions/config")} />
      </View>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Payer une Facture</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Montant (FCFA)" />
                <TextInput style={styles.input} value={refBancaire} onChangeText={setRefBancaire} placeholder="Référence Virement" />
                
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitDeclare} disabled={processing}>
                    {processing ? <ActivityIndicator color="#FFF"/> : <Text style={styles.confirmText}>VALIDER</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={{alignItems:'center', padding:10}}>
                    <Text style={{color:'#666'}}>Annuler</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  balanceCard: { padding: 20, borderRadius: 18, marginBottom: 10 },
  balanceLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 4, fontWeight:'500' },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom:5 },
  fundBtn: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  fundText: { color: '#1E293B', fontWeight: '700', fontSize: 13, marginLeft: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#374151', marginTop: 20 },
  grid: { gap: 10 },
  
  // Modal Styles simplifiés
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  input: { backgroundColor: '#F3F4F6', padding: 15, borderRadius: 10, marginBottom: 15 },
  confirmBtn: { backgroundColor: '#F59E0B', padding: 15, borderRadius: 10, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: 'bold' }
});