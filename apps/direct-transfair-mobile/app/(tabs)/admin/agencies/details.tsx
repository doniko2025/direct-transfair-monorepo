//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/details.tsx
import React, { useEffect, useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, SafeAreaView, Alert, Platform, StatusBar 
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
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
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

export default function AgencyDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;

  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useFocusEffect(
    useCallback(() => { if (id) fetchDetails(); }, [id])
  );

  const fetchDetails = async () => {
    try {
      const data = await api.getAgency(id as string);
      setAgency(data);
    } catch (e) {
      console.error(e);
      if ((e as any).response?.status === 404) router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'agence ${agency.name} ? Cette action est irréversible.`;
    
    const executeDelete = async () => {
      setProcessing(true);
      try {
        await api.deleteAgency(agency.id);
        if (Platform.OS === 'web') { 
          alert("Agence supprimée !"); 
          router.back(); 
        } else { 
          Alert.alert("Succès", "Agence supprimée !", [{ text: "OK", onPress: () => router.back() }]); 
        }
      } catch (e) { 
        Platform.OS === 'web' ? alert("Erreur lors de la suppression") : Alert.alert("Erreur", "Impossible de supprimer."); 
      } finally { 
        setProcessing(false); 
      }
    };

    if (Platform.OS === 'web') { 
      if (window.confirm(confirmMessage)) executeDelete(); 
    } else { 
      Alert.alert("Confirmation", confirmMessage, [
        { text: "Annuler", style: "cancel" }, 
        { text: "SUPPRIMER", style: "destructive", onPress: executeDelete }
      ]); 
    }
  };

  const handleToggleStatus = async () => {
    const executeToggle = async () => {
      setProcessing(true);
      try {
        await api.updateAgency(agency.id, { isActive: !agency.isActive } as any);
        setAgency({ ...agency, isActive: !agency.isActive });
      } catch (e) { 
        Platform.OS === 'web' ? alert("Erreur") : Alert.alert("Erreur", "Impossible de changer le statut."); 
      } finally { 
        setProcessing(false); 
      }
    };

    if (Platform.OS === 'web') { 
      if (window.confirm(`Voulez-vous ${agency.isActive ? 'suspendre' : 'activer'} l'agence ?`)) executeToggle(); 
    } else { 
      Alert.alert("Confirmation", `Voulez-vous ${agency.isActive ? 'suspendre' : 'activer'} l'agence ?`, [
        { text: "Annuler", style: "cancel" }, 
        { text: "OUI", onPress: executeToggle }
      ]); 
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}><ActivityIndicator color={theme.primary} size="large" /></View>;
  if (!agency) return <View style={styles.center}><Text style={{fontFamily: FONTS.body}}>Agence introuvable</Text></View>;

  const isActive = agency.isActive;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      {/* ─── HEADER ─── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={15}>
          <Ionicons name="arrow-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{agency.name}</Text>
        <TouchableOpacity 
          style={[styles.editBtn, { backgroundColor: '#FFF' }]} 
          onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: agency.id } })}
        >
          <Ionicons name="pencil" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* ─── CONTENU ─── */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* CARTE SOLDE */}
        <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
          <View>
            <Text style={styles.balanceLabel}>SOLDE CAISSE</Text>
            <Text style={styles.balanceValue}>
              {(agency.balance || 0).toLocaleString('fr-FR')} {agency.currency || 'XOF'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? '#D1FAE5' : '#FEE2E2' }]}>
            <Text style={{ color: isActive ? '#065F46' : '#991B1B', fontFamily: FONTS.body, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>
              {isActive ? 'ACTIVE' : 'SUSPENDUE'}
            </Text>
          </View>
        </View>

        {/* INFORMATIONS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS GÉNÉRALES</Text>
          <InfoRow label="Code Agence" value={agency.code || "N/A"} icon="qr-code-outline" theme={theme} />
          <InfoRow label="Devise" value={agency.currency || "XOF"} icon="cash-outline" theme={theme} /> 
          <InfoRow label="Email" value={agency.email || "N/A"} icon="mail-outline" theme={theme} />
          <InfoRow label="Téléphone" value={agency.phone || "N/A"} icon="call-outline" theme={theme} />
          
          <View style={styles.divider} />
          
          <InfoRow label="Ville" value={agency.city} icon="location-outline" theme={theme} />
          <InfoRow label="Adresse" value={agency.address} icon="map-outline" theme={theme} />
        </View>

        {/* ACTIONS SENSIBLES */}
        <Text style={[styles.sectionTitle, { marginTop: 15, marginBottom: 12, marginLeft: 4 }]}>ACTIONS RAPIDES</Text>
        <View style={styles.actionsContainer}>
          
          <TouchableOpacity 
            style={[styles.actionBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]} 
            onPress={handleToggleStatus} 
            disabled={processing}
          >
            {processing ? <ActivityIndicator size="small" color="#D97706" /> : (
              <>
                <Ionicons name={isActive ? "pause" : "play"} size={22} color="#D97706" />
                <Text style={[styles.actionBoxText, { color: '#D97706' }]}>{isActive ? "Suspendre" : "Activer"}</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]} 
            onPress={handleDelete} 
            disabled={processing}
          >
            {processing ? <ActivityIndicator size="small" color="#DC2626" /> : (
              <>
                <Ionicons name="trash" size={22} color="#DC2626" />
                <Text style={[styles.actionBoxText, { color: '#DC2626' }]}>Supprimer</Text>
              </>
            )}
          </TouchableOpacity>

        </View>
        <View style={{height: 120}} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── COMPOSANTS ─────────────────────────────────────────────────────────

function InfoRow({ label, value, icon, theme }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconSmall, { backgroundColor: theme.light }]}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontFamily: FONTS.heading, color: '#FFF', fontWeight: '700' },
  editBtn: { padding: 8, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  
  content: { padding: 20, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30, flexGrow: 1 },
  
  balanceCard: { borderRadius: 20, padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: '#FFF', fontSize: 26, fontFamily: FONTS.body, fontWeight: '900', marginTop: 6, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  
  section: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionTitle: { fontSize: 12, color: '#94A3B8', fontFamily: FONTS.body, fontWeight: '900', marginBottom: 16, letterSpacing: 1.2 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconSmall: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  infoLabel: { fontSize: 12, color: '#64748B', fontFamily: FONTS.body, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#0F172A', fontFamily: FONTS.body, fontWeight: '700' },
  
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4, marginBottom: 16 },
  
  actionsContainer: { flexDirection: 'row', gap: 12 },
  actionBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 18, borderWidth: 1 },
  actionBoxText: { marginTop: 8, fontSize: 13, fontFamily: FONTS.body, fontWeight: "800", letterSpacing: 0.3 }
});