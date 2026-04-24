//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/index.tsx
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, ActivityIndicator, TouchableOpacity, RefreshControl, TextInput, Modal, Alert, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

// ─── THÈMES & TYPOGRAPHIES ──────────────────────────────────────────────
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF" },
  AGENT: { primary: "#78350F", light: "#FFF7ED" },
  USER: { primary: "#065F46", light: "#ECFDF5" },
};

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', // Simule Cormorant Garamond
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif', // Simule Sora
};

type Agency = {
  id: string | number;
  name: string;
  city: string;
  phone?: string;
  type: 'PARTNER' | 'PRIVATE';
  balance?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  managerName?: string;
  currency?: string;
};

export default function AgenciesListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [filteredAgencies, setFilteredAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState("");

  // --- ÉTATS DES MODALES ---
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);
  
  const [isDeleteFlow, setIsDeleteFlow] = useState(false);
  const [securityPhone, setSecurityPhone] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => { loadAgencies(); }, [])
  );

  const loadAgencies = async () => {
    try {
      const res = await api.getAgencies(); 
      const list = Array.isArray(res) ? res : [];
      const formatted: Agency[] = list.map((a: any) => ({
        ...a,
        type: a.subscriptionType === 'PURCHASE' ? 'PARTNER' : 'PRIVATE',
        balance: a.balance || 0,
        phone: a.phone || 'Non renseigné',
        status: a.status || 'ACTIVE',
        currency: a.currency || 'XOF'
      }));
      setAgencies(formatted);
      setFilteredAgencies(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text) {
      setFilteredAgencies(agencies);
    } else {
      const lower = text.toLowerCase();
      setFilteredAgencies(agencies.filter(a => a.name.toLowerCase().includes(lower) || a.city.toLowerCase().includes(lower)));
    }
  };

  // ✅ ACTIONS DE LA CARTE
  const openMenu = (agency: Agency) => {
    setSelectedAgency(agency);
    setIsDeleteFlow(false);
    setSecurityPhone("");
    setMenuVisible(true);
  };

  const confirmSecureDeletion = async () => {
    if (!securityPhone.trim() || securityPhone.length < 8) {
      return Alert.alert("Sécurité", "Veuillez entrer un numéro valide.");
    }
    setIsDeleting(true);
    try {
      await api.deleteAgency(selectedAgency!.id.toString());
      Alert.alert("Supprimé", `L'agence ${selectedAgency!.name} a été supprimée avec succès.`);
      setMenuVisible(false);
      loadAgencies();
    } catch (e: any) {
      Alert.alert("Échec", e.response?.data?.message || "Erreur de suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderItem = ({ item }: { item: Agency }) => (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => openMenu(item)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: theme.light }]}>
          <Ionicons name="business" size={22} color={theme.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardCity}>{item.city} • {item.phone}</Text>
        </View>
        <View style={[styles.badge, item.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, item.status === 'ACTIVE' ? {color:'#065F46'} : {color:'#991B1B'}]}>
            {item.status === 'ACTIVE' ? 'ACTIF' : 'INACTIF'}
          </Text>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.label}>Responsable</Text>
          <Text style={styles.managerName}>{item.managerName || "Non assigné"}</Text>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={styles.label}>Solde Caisse</Text>
          <Text style={[styles.balanceValue, { color: theme.primary }]}>
            {(item.balance || 0).toLocaleString('fr-FR')} {item.currency}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={15}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Réseau d'Agences</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/admin/agencies/create")} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput 
            placeholder="Rechercher une agence..." 
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={filteredAgencies}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAgencies(); }} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyText}>Aucune agence trouvée.</Text>
            </View>
          }
        />
      )}

      {/* ✅ MODALE D'ACTIONS (MENU + SUPPRESSION) */}
      <Modal visible={isMenuVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDrag} />
            
            <Text style={styles.modalTitle}>{selectedAgency?.name}</Text>
            <Text style={styles.modalSubtitle}>{selectedAgency?.city}</Text>

            {!isDeleteFlow ? (
              <View style={styles.actionList}>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => { setMenuVisible(false); router.push({ pathname: "/(tabs)/admin/agencies/details", params: { id: selectedAgency!.id.toString() } }); }}
                >
                  <View style={[styles.actionIcon, {backgroundColor: '#EFF6FF'}]}><Ionicons name="eye" size={20} color="#3B82F6" /></View>
                  <Text style={styles.actionText}>Voir les détails de l'agence</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => { setMenuVisible(false); router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: selectedAgency!.id.toString() } }); }}
                >
                  <View style={[styles.actionIcon, {backgroundColor: '#F3F4F6'}]}><Ionicons name="pencil" size={20} color="#4B5563" /></View>
                  <Text style={styles.actionText}>Modifier les informations</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => setIsDeleteFlow(true)}>
                  <View style={[styles.actionIcon, {backgroundColor: '#FEE2E2'}]}><Ionicons name="trash" size={20} color="#DC2626" /></View>
                  <Text style={[styles.actionText, {color: '#DC2626', fontWeight: '700'}]}>Supprimer l'agence</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.deleteFlow}>
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={28} color="#DC2626" />
                  <Text style={styles.warningText}>Vous allez supprimer cette agence. Un email de confirmation sera envoyé.</Text>
                </View>
                
                <Text style={styles.modalLabel}>Confirmez avec votre téléphone :</Text>
                <TextInput
                  style={styles.securityInput}
                  placeholder="Numéro de l'admin"
                  keyboardType="phone-pad"
                  value={securityPhone}
                  onChangeText={setSecurityPhone}
                  editable={!isDeleting}
                />

                <TouchableOpacity style={[styles.confirmDeleteBtn, isDeleting && { opacity: 0.7 }]} onPress={confirmSecureDeletion} disabled={isDeleting}>
                  {isDeleting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmDeleteText}>Valider la suppression</Text>}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setMenuVisible(false)}>
              <Text style={styles.closeModalText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { padding: 24, paddingBottom: 30, paddingTop: Platform.OS === 'android' ? 40 : 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontFamily: FONTS.heading, color: '#FFF', fontWeight: '700' },
  addBtn: { backgroundColor: '#FFF', padding: 8, borderRadius: 12 },

  searchBox: { flexDirection:'row', alignItems:'center', backgroundColor:'#FFF', borderRadius:14, paddingHorizontal:16, height: 50, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  searchInput: { flex:1, marginLeft:10, fontSize:15, fontFamily: FONTS.body, color: '#111827' },

  list: { padding: 20, paddingBottom: 120 },
  empty: { alignItems:'center', marginTop: 80 },
  emptyText: { color:'#9CA3AF', fontFamily: FONTS.body, marginTop:12, fontSize: 16 },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 14 },
  cardName: { fontSize: 18, fontFamily: FONTS.heading, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  cardCity: { fontSize: 13, fontFamily: FONTS.body, color: '#64748B' },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#D1FAE5' },
  badgeInactive: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 11, fontFamily: FONTS.body, color: '#94A3B8', textTransform:'uppercase', fontWeight:'800', letterSpacing: 0.5 },
  managerName: { fontSize: 14, fontFamily: FONTS.body, color: '#334155', fontWeight:'600', marginTop:4 },
  balanceValue: { fontSize: 18, fontFamily: FONTS.body, fontWeight: '800', marginTop:4 },

  // Styles Modale Action
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalDrag: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, fontFamily: FONTS.body, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  
  actionList: { gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionText: { fontSize: 15, fontFamily: FONTS.body, fontWeight: '600', color: '#1E293B' },

  deleteFlow: { marginTop: 10 },
  warningBox: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  warningText: { flex: 1, marginLeft: 12, color: '#991B1B', fontSize: 13, lineHeight: 18, fontFamily: FONTS.body },
  modalLabel: { fontSize: 13, fontFamily: FONTS.body, fontWeight: '600', color: '#475569', marginBottom: 8 },
  securityInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, fontSize: 16, fontFamily: FONTS.body, marginBottom: 24 },
  confirmDeleteBtn: { backgroundColor: '#DC2626', padding: 16, borderRadius: 16, alignItems: 'center' },
  confirmDeleteText: { color: '#FFF', fontFamily: FONTS.body, fontWeight: '700', fontSize: 15 },
  
  closeModalBtn: { marginTop: 20, padding: 16, alignItems: 'center' },
  closeModalText: { fontSize: 15, fontFamily: FONTS.body, fontWeight: '700', color: '#64748B' },
});