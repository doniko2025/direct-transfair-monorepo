//apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  StatusBar, Alert, Platform, Modal, TextInput, ActivityIndicator, RefreshControl 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

export default function TreasuryScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [targetAgency, setTargetAgency] = useState<any>(null); 
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  // Charger les données à l'arrivée sur l'écran
  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
      setLoading(true);
      try {
          await refreshUser(); // Met à jour le solde Admin affiché en haut
          const data = await api.getAgencies();
          setAgencies(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
          setRefreshing(false);
      }
  };

  const handleRefresh = async () => {
      setRefreshing(true);
      await loadData();
  };

  const handleOpenFundSelf = () => {
      setTargetAgency(null);
      setAmount("");
      setModalVisible(true);
  };

  const handleOpenRefill = (agency: any) => {
      setTargetAgency(agency);
      setAmount("");
      setModalVisible(true);
  };

  const handleSubmit = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          if (Platform.OS === 'web') alert("Montant invalide");
          else Alert.alert("Erreur", "Veuillez saisir un montant valide et positif.");
          return;
      }
      
      const val = Number(amount);
      setProcessing(true);

      try {
          if (targetAgency) {
              // 1. Recharger une agence
              const res = await api.adminRefillAgency(targetAgency.id, val);
              const msg = `Envoyé: ${res.sent}\nReçu: ${res.received}\nTaux: ${res.rate}`;
              
              if (Platform.OS === 'web') alert(msg);
              else Alert.alert("Succès", msg);

          } else {
              // 2. S'alimenter soi-même (Admin)
              await api.adminFundSelf(val);
              
              if (Platform.OS === 'web') alert("Compte alimenté !");
              else Alert.alert("Succès", "Fonds ajoutés au compte Admin.");
          }

          setModalVisible(false);
          // 🚀 Rafraîchissement automatique après succès
          setTimeout(() => loadData(), 500); 

      } catch (e: any) {
          const err = e.response?.data?.message || "Erreur technique";
          if (Platform.OS === 'web') alert(err);
          else Alert.alert("Erreur", Array.isArray(err) ? err[0] : err);
      } finally {
          setProcessing(false);
      }
  };

  function getFlag(countryName: string) {
    if(!countryName) return "🌍";
    if(countryName.includes("Sénégal")) return "🇸🇳";
    if(countryName.includes("Guinée")) return "🇬🇳";
    if(countryName.includes("France")) return "🇫🇷";
    if(countryName.includes("Mali")) return "🇲🇱";
    if(countryName.includes("Côte")) return "🇨🇮";
    return "🏳️";
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#1E1B4B" barStyle="light-content" />
      
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Gestion Trésorerie</Text>
          <View style={{width:24}}/>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFF"/>}
      >
        {/* CARTE PRINCIPALE ADMIN */}
        <View style={styles.adminCard}>
            <View>
                <Text style={styles.adminLabel}>Ma Trésorerie (Admin)</Text>
                <Text style={styles.adminBalance}>
                    {user?.balance ? Number(user.balance).toLocaleString('fr-FR') : "0"} XOF
                </Text>
            </View>
            <TouchableOpacity style={styles.fundBtn} onPress={handleOpenFundSelf}>
                <Ionicons name="add" size={20} color="#1E1B4B" />
                <Text style={styles.fundText}>S'alimenter</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Réseau d'Agences</Text>

        {loading && !refreshing && <ActivityIndicator color="#FFF" style={{marginTop:20}} />}

        {!loading && agencies.length === 0 && (
            <Text style={{color:'#6B7280', textAlign:'center', marginTop:20}}>Aucune agence trouvée.</Text>
        )}

        {!loading && agencies.map((agency) => (
            <View key={agency.id} style={styles.agencyCard}>
                <View style={styles.row}>
                    <View style={styles.iconBox}>
                        <Text style={{fontSize:20}}>{getFlag(agency.country)}</Text>
                    </View>
                    <View style={{flex:1}}>
                        <Text style={styles.agencyName}>{agency.name}</Text>
                        <Text style={styles.agencyLocation}>{agency.city} • {agency.currency}</Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                        <Text style={styles.agencyBalanceLabel}>Solde Caisse</Text>
                        <Text style={styles.agencyBalance}>
                            {Number(agency.balance).toLocaleString('fr-FR')} {agency.currency}
                        </Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenRefill(agency)}>
                        <Ionicons name="paper-plane-outline" size={16} color="#2563EB" />
                        <Text style={styles.actionText}>Envoyer des fonds</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ))}
        <View style={{height: 100}} />
      </ScrollView>

      {/* MODAL TRANSACTION */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                      {targetAgency ? `Recharger ${targetAgency.name}` : "Alimenter mon compte"}
                  </Text>
                  
                  {targetAgency ? (
                      <Text style={styles.modalSubtitle}>
                          Vous envoyez des <Text style={{fontWeight:'bold'}}>FCFA</Text>. 
                          L'agence recevra des <Text style={{fontWeight:'bold'}}>{targetAgency.currency}</Text>.
                      </Text>
                  ) : (
                      <Text style={styles.modalSubtitle}>
                          Injection de fonds depuis la Banque Centrale (Virtuel).
                      </Text>
                  )}

                  <Text style={styles.inputLabel}>Montant à envoyer (FCFA)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={amount} 
                    onChangeText={setAmount} 
                    keyboardType="numeric" 
                    placeholder="Ex: 5000000" 
                    autoFocus 
                  />

                  <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>VALIDER LA TRANSACTION</Text>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={processing}>
                      <Text style={styles.cancelText}>Annuler</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#111827" },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
    container: { padding: 20 },
    adminCard: { backgroundColor: '#F59E0B', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    adminLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
    adminBalance: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
    fundBtn: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    fundText: { color: '#1E1B4B', fontWeight: '700', fontSize: 12, marginLeft: 4 },
    sectionTitle: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
    agencyCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    agencyName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    agencyLocation: { color: '#9CA3AF', fontSize: 12 },
    agencyBalanceLabel: { color: '#6B7280', fontSize: 10, textAlign: 'right' },
    agencyBalance: { color: '#34D399', fontSize: 16, fontWeight: '700', textAlign: 'right' },
    divider: { height: 1, backgroundColor: '#374151', marginVertical: 12 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    actionText: { color: '#2563EB', fontWeight: '700', fontSize: 12, marginLeft: 6 },
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