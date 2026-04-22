// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  StatusBar, Alert, Platform, Modal, TextInput, ActivityIndicator, RefreshControl 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

type RefillResponse = {
  sent?: number;
  amount?: number;
};

export default function TreasuryScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [localBalance, setLocalBalance] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [targetAgency, setTargetAgency] = useState<any>(null); 
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState(""); 
  
  const [modalType, setModalType] = useState<'FUND_SELF' | 'REFILL_AGENCY' | 'PAY_SUPER'>('FUND_SELF');
  const [processing, setProcessing] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
      if (user?.balance !== undefined) {
          setLocalBalance(Number(user.balance));
      }
  }, [user?.balance]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
      setLoading(true);
      try {
          await refreshUser();
          const data = await api.getAgencies();
          setAgencies(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
          setRefreshing(false);
      }
  };

  const handleRefresh = async () => { setRefreshing(true); await loadData(); };

  const handleOpenPaySuperAdmin = () => {
      setAmount("");
      setRefBancaire("");
      setModalType('PAY_SUPER');
      setModalVisible(true);
  }

  const handleOpenRefill = (agency: any) => {
      setTargetAgency(agency);
      setAmount("");
      setModalType('REFILL_AGENCY');
      setModalVisible(true);
  };

  const handleOpenFundSelf = () => {
      setTargetAgency(null);
      setAmount("");
      setModalType('FUND_SELF');
      setModalVisible(true);
  };

  const handleSubmit = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          if (Platform.OS === 'web') alert("Montant invalide");
          else Alert.alert("Erreur", "Montant invalide");
          return;
      }
      
      const val = Number(amount);
      setProcessing(true);

      try {
          if (modalType === 'PAY_SUPER') {
              if (!refBancaire) throw new Error("Référence bancaire requise");
              await api.declareBankTransfer(val, refBancaire);
              setLocalBalance(prev => prev - val);

              const msg = "Paiement envoyé ! En attente de validation par le Super Admin.";
              if (Platform.OS === 'web') alert(msg);
              else Alert.alert("Succès", msg);
          } 
          else if (modalType === 'REFILL_AGENCY' && targetAgency) {
              const res = await api.adminRefillAgency(targetAgency.id, val) as RefillResponse | undefined;
              const sent = typeof res?.sent === "number" ? res.sent : typeof res?.amount === "number" ? res.amount : val;
              
              setLocalBalance(prev => prev - sent);

              const msg = `Agence rechargée de ${sent} XOF avec succès.`;
              if (Platform.OS === 'web') alert(msg);
              else Alert.alert("Succès", msg);
          }
          else if (modalType === 'FUND_SELF') {
             const res = await api.adminFundSelf(val) as any;
             
             if (res && res.newBalance !== undefined) {
                 setLocalBalance(Number(res.newBalance));
             } else {
                 setLocalBalance(prev => prev + val);
             }

             if (Platform.OS === 'web') alert("Compte alimenté avec succès !");
             else Alert.alert("Succès", "Fonds ajoutés.");
          }

          setModalVisible(false);
          await loadData();

      } catch (e: any) {
          console.error("Erreur API :", e);
          
          // ✅ CORRECTIF WEB: Affichage forcé de l'erreur pour ne plus jamais bloquer silencieusement
          const err = e?.response?.data?.message || e?.message || "Erreur technique";
          const errMsg = Array.isArray(err) ? err.join(", ") : String(err);
          
          if (Platform.OS === 'web') {
              alert(`❌ Échec de l'opération : ${errMsg}`);
          } else {
              Alert.alert("Erreur", errMsg);
          }
      } finally {
          setProcessing(false);
      }
  };

  function getFlag(countryName: string) {
    if(!countryName) return "🌍";
    if(countryName.includes("Sénégal")) return "🇸🇳";
    if(countryName.includes("Guinée")) return "🇬🇳";
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
        <View style={styles.adminCard}>
            <View>
                <Text style={styles.adminLabel}>Trésorerie ({isSuperAdmin ? 'Super Admin' : 'Admin Société'})</Text>
                <Text style={styles.adminBalance}>
                    {localBalance.toLocaleString('fr-FR')} XOF
                </Text>
            </View>
            
            <View style={{flexDirection:'column', gap: 8}}>
                {!isSuperAdmin && (
                    <TouchableOpacity style={[styles.fundBtn, {backgroundColor:'#DBEAFE'}]} onPress={handleOpenPaySuperAdmin}>
                        <Ionicons name="card-outline" size={18} color="#1E3A8A" />
                        <Text style={[styles.fundText, {color:'#1E3A8A'}]}>Payer Service</Text>
                    </TouchableOpacity>
                )}

                {!isSuperAdmin && (
                    <TouchableOpacity style={styles.fundBtn} onPress={handleOpenFundSelf}>
                        <Ionicons name="add-circle-outline" size={18} color="#1E1B4B" />
                        <Text style={styles.fundText}>Auto-Alim.</Text>
                    </TouchableOpacity>
                )}
            </View>
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
                        <Text style={styles.agencyLocation}>{agency.city}</Text>
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
                        <Text style={styles.actionText}>Recharger Agence</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ))}
        <View style={{height: 100}} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                      {modalType === 'REFILL_AGENCY' ? `Recharger ${targetAgency?.name}` : 
                       modalType === 'PAY_SUPER' ? "Payer le Super Admin" : 
                       "Alimenter mon compte"}
                  </Text>
                  
                  <Text style={styles.modalSubtitle}>
                      {modalType === 'REFILL_AGENCY' ? "Envoi de fonds vers une agence du réseau." :
                       modalType === 'PAY_SUPER' ? "Règlement de frais de service ou location." :
                       "Injection de fonds virtuels (Cash-In)."}
                  </Text>

                  <Text style={styles.inputLabel}>Montant (FCFA)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={amount} 
                    onChangeText={setAmount} 
                    keyboardType="numeric" 
                    placeholder="Ex: 500000" 
                    autoFocus={modalType !== 'PAY_SUPER'} 
                  />

                  {modalType === 'PAY_SUPER' && (
                      <>
                        <Text style={styles.inputLabel}>Référence du Virement (Preuve)</Text>
                        <TextInput 
                            style={styles.input} 
                            value={refBancaire} 
                            onChangeText={setRefBancaire} 
                            placeholder="Ex: REF-BANQUE-123" 
                        />
                      </>
                  )}

                  <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>VALIDER</Text>}
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
    adminCard: { backgroundColor: '#F59E0B', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
    adminLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
    adminBalance: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
    fundBtn: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginBottom: 5 },
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