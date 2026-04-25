// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  StatusBar, Alert, Platform, Modal, TextInput, ActivityIndicator, RefreshControl, KeyboardAvoidingView 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

type RefillResponse = {
  sent?: number;
  amount?: number;
};

// ─── THÈMES & TYPOGRAPHIES ──────────────────────────────────────────────
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF" },
};

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

export default function TreasuryScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const role = user?.role || "COMPANY_ADMIN";
  const theme = THEMES[role as keyof typeof THEMES] || THEMES.COMPANY_ADMIN;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  
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

  useEffect(() => {
      if (user?.balance !== undefined) {
          setLocalBalance(Number(user.balance));
      }
  }, [user?.balance]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

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

  // ─── ACTIONS MODALES ───
  const handleOpenPaySuperAdmin = () => {
      setAmount(""); setRefBancaire(""); setModalType('PAY_SUPER'); setModalVisible(true);
  }

  const handleOpenRefill = (agency: any) => {
      setTargetAgency(agency); setAmount(""); setModalType('REFILL_AGENCY'); setModalVisible(true);
  };

  const handleOpenFundSelf = () => {
      setTargetAgency(null); setAmount(""); setModalType('FUND_SELF'); setModalVisible(true);
  };

  const showAlert = (title: string, message: string) => {
      if (Platform.OS === 'web') alert(`${title}\n\n${message}`);
      else Alert.alert(title, message);
  };

  const handleSubmit = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          return showAlert("Erreur", "Veuillez entrer un montant valide.");
      }
      
      const val = Number(amount);
      setProcessing(true);

      try {
          if (modalType === 'PAY_SUPER') {
              if (!refBancaire) throw new Error("La référence bancaire est obligatoire.");
              await api.declareBankTransfer(val, refBancaire);
              setLocalBalance(prev => prev - val);
              showAlert("Succès", "Paiement envoyé ! En attente de validation par le Super Admin.");
          } 
          else if (modalType === 'REFILL_AGENCY' && targetAgency) {
              const res = await api.adminRefillAgency(targetAgency.id, val) as RefillResponse | undefined;
              const sent = typeof res?.sent === "number" ? res.sent : typeof res?.amount === "number" ? res.amount : val;
              setLocalBalance(prev => prev - sent);
              showAlert("Succès", `L'agence ${targetAgency.name} a été rechargée de ${sent} XOF.`);
          }
          else if (modalType === 'FUND_SELF') {
             const res = await api.adminFundSelf(val) as any;
             if (res && res.newBalance !== undefined) setLocalBalance(Number(res.newBalance));
             else setLocalBalance(prev => prev + val);
             showAlert("Succès", "Fonds ajoutés avec succès à votre compte.");
          }

          setModalVisible(false);
          await loadData();

      } catch (e: any) {
          console.error("Erreur API :", e);
          const err = e?.response?.data?.message || e?.message || "Erreur technique";
          const errMsg = Array.isArray(err) ? err.join(", ") : String(err);
          showAlert("Échec de l'opération", errMsg);
      } finally {
          setProcessing(false);
      }
  };

  function getFlag(countryName: string) {
    if(!countryName) return "🌍";
    if(countryName.toLowerCase().includes("sénégal")) return "🇸🇳";
    if(countryName.toLowerCase().includes("guinée")) return "🇬🇳";
    if(countryName.toLowerCase().includes("mali")) return "🇲🇱";
    return "🌍";
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={theme.primary} barStyle="light-content" />
      
      {/* ─── HEADER COLORÉ ─── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={15}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trésorerie Globale</Text>
          <View style={{width: 26}}/>
      </View>

      {/* ─── CONTENU ─── */}
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary}/>}
      >
        
        {/* CARTE PRINCIPALE DE TRÉSORERIE */}
        <View style={[styles.adminCard, { backgroundColor: theme.primary }]}>
            <View style={{ flex: 1 }}>
                <Text style={styles.adminLabel}>SOLDE {isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN SOCIÉTÉ'}</Text>
                <Text style={styles.adminBalance} numberOfLines={1} adjustsFontSizeToFit>
                    {localBalance.toLocaleString('fr-FR')} XOF
                </Text>
            </View>
            
            <View style={styles.actionButtonsCol}>
                {!isSuperAdmin && (
                    <TouchableOpacity style={[styles.fundBtn, { backgroundColor: '#DBEAFE' }]} onPress={handleOpenPaySuperAdmin}>
                        <Ionicons name="receipt-outline" size={16} color="#1E3A8A" />
                        <Text style={[styles.fundText, { color: '#1E3A8A' }]}>Payer Facture</Text>
                    </TouchableOpacity>
                )}

                {!isSuperAdmin && (
                    <TouchableOpacity style={[styles.fundBtn, { backgroundColor: '#FEF3C7' }]} onPress={handleOpenFundSelf}>
                        <Ionicons name="add-circle" size={16} color="#B45309" />
                        <Text style={[styles.fundText, { color: '#B45309' }]}>Alimenter</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>

        <Text style={styles.sectionTitle}>AGENCES DU RÉSEAU ({agencies.length})</Text>

        {loading && !refreshing && <ActivityIndicator color={theme.primary} style={{marginTop: 30}} size="large" />}

        {!loading && agencies.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="storefront" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>Aucune agence trouvée.</Text>
            </View>
        )}

        {!loading && agencies.map((agency) => (
            <View key={agency.id} style={styles.agencyCard}>
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: theme.light }]}>
                        <Text style={{fontSize: 22}}>{getFlag(agency.country)}</Text>
                    </View>
                    <View style={{flex: 1, paddingRight: 10}}>
                        <Text style={styles.agencyName} numberOfLines={1}>{agency.name}</Text>
                        <Text style={styles.agencyLocation}>{agency.city}</Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                        <Text style={styles.agencyBalanceLabel}>SOLDE</Text>
                        <Text style={[styles.agencyBalance, { color: theme.primary }]}>
                            {Number(agency.balance).toLocaleString('fr-FR')}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.actionsRow}>
                    <View style={[styles.statusBadge, agency.isActive ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.badgeText, agency.isActive ? {color:'#065F46'} : {color:'#991B1B'}]}>
                        {agency.isActive ? 'Opérationnelle' : 'Suspendue'}
                      </Text>
                    </View>
                    
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.light }]} onPress={() => handleOpenRefill(agency)}>
                        <Ionicons name="paper-plane" size={16} color={theme.primary} />
                        <Text style={[styles.actionText, { color: theme.primary }]}>Recharger Caisse</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ))}
        <View style={{height: 120}} />
      </ScrollView>

      {/* ─── MODALE D'ACTION ─── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
              <View style={styles.modalContent}>
                  <View style={styles.modalDrag} />
                  
                  <View style={styles.modalHeader}>
                    <View style={[styles.modalIconBox, { backgroundColor: theme.light }]}>
                      <Ionicons name={modalType === 'PAY_SUPER' ? "receipt" : "wallet"} size={28} color={theme.primary} />
                    </View>
                    <Text style={styles.modalTitle}>
                        {modalType === 'REFILL_AGENCY' ? `Recharger ${targetAgency?.name}` : 
                         modalType === 'PAY_SUPER' ? "Paiement Super Admin" : 
                         "Alimentation de Caisse"}
                    </Text>
                  </View>
                  
                  <Text style={styles.modalSubtitle}>
                      {modalType === 'REFILL_AGENCY' ? "Transfert immédiat du compte Admin vers l'agence sélectionnée." :
                       modalType === 'PAY_SUPER' ? "Déclarez le paiement effectué par virement bancaire pour validation." :
                       "Ajoutez des fonds virtuels à votre trésorerie principale."}
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>MONTANT (XOF)</Text>
                    <TextInput 
                      style={styles.input} 
                      value={amount} 
                      onChangeText={setAmount} 
                      keyboardType="numeric" 
                      placeholder="0" 
                      placeholderTextColor="#CBD5E1"
                      autoFocus={modalType !== 'PAY_SUPER'} 
                    />
                  </View>

                  {modalType === 'PAY_SUPER' && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>RÉFÉRENCE BANCAIRE</Text>
                        <TextInput 
                            style={styles.input} 
                            value={refBancaire} 
                            onChangeText={setRefBancaire} 
                            placeholder="Ex: VIREMENT-12345" 
                            placeholderTextColor="#CBD5E1"
                        />
                      </View>
                  )}

                  <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleSubmit} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>CONFIRMER L'OPÉRATION</Text>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={processing}>
                      <Text style={styles.cancelText}>Annuler</Text>
                  </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4, zIndex: 10 },
    headerTitle: { fontSize: 22, fontFamily: FONTS.heading, fontWeight: '700', color: '#FFF' },
    
    container: { padding: 20, paddingTop: 24 },
    
    adminCard: { borderRadius: 24, padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    adminLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 1 },
    adminBalance: { color: '#FFF', fontSize: 32, fontFamily: FONTS.heading, fontWeight: '800', marginTop: 4 },
    actionButtonsCol: { flexDirection: 'column', gap: 10, marginLeft: 10 },
    fundBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    fundText: { fontFamily: FONTS.body, fontWeight: '800', fontSize: 12, marginLeft: 6 },
    
    sectionTitle: { color: '#64748B', fontSize: 13, fontFamily: FONTS.body, fontWeight: '900', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4 },
    
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#94A3B8', fontFamily: FONTS.body, fontSize: 15, fontWeight: '600', marginTop: 12 },

    agencyCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    agencyName: { color: '#0F172A', fontSize: 17, fontFamily: FONTS.heading, fontWeight: '700', marginBottom: 2 },
    agencyLocation: { color: '#64748B', fontSize: 13, fontFamily: FONTS.body, fontWeight: '600' },
    agencyBalanceLabel: { color: '#94A3B8', fontSize: 10, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 0.5, textAlign: 'right' },
    agencyBalance: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: '800', textAlign: 'right', marginTop: 2 },
    
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
    
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    badgeActive: { backgroundColor: '#D1FAE5' },
    badgeInactive: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 10, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 0.5 },
    
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    actionText: { fontFamily: FONTS.body, fontWeight: '800', fontSize: 13, marginLeft: 8 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
    modalDrag: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
    
    modalHeader: { alignItems: 'center', marginBottom: 12 },
    modalIconBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
    modalSubtitle: { fontSize: 14, fontFamily: FONTS.body, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20, paddingHorizontal: 10 },
    
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '800', color: '#64748B', marginBottom: 8, letterSpacing: 0.5 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 18, fontFamily: FONTS.body, fontWeight: '700', color: '#0F172A' },
    
    confirmBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    confirmText: { color: '#FFF', fontFamily: FONTS.body, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
    
    cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
    cancelText: { color: '#64748B', fontFamily: FONTS.body, fontWeight: '800', fontSize: 15 }
});