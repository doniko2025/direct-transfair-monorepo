// apps/direct-transfair-mobile/app/(tabs)/admin/clients/details.tsx
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

function isDigitsOnly(s: string): boolean {
  return /^[0-9]+$/.test(s);
}

export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;

  const idStr = Array.isArray(id) ? id[0] : id;
  const clientId = idStr && isDigitsOnly(idStr) ? Number(idStr) : NaN;

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!Number.isFinite(clientId)) {
      setErrorMsg("ID société invalide.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getClient(clientId);
      setClient(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.response?.status === 404 ? "Société introuvable (404)." : "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useFocusEffect(useCallback(() => { void fetchDetails(); return () => {}; }, [fetchDetails]));

  const handleToggleStatus = async () => {
    const current = String(client.subscriptionStatus ?? "").toUpperCase();
    const nextStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    
    const executeToggle = async () => {
      setProcessing(true);
      try {
        const updated = await api.updateClientStatus(client.id, nextStatus as any);
        setClient(updated);
      } catch (e) { 
        Platform.OS === 'web' ? alert("Erreur") : Alert.alert("Erreur", "Impossible de changer le statut."); 
      } finally { 
        setProcessing(false); 
      }
    };

    if (Platform.OS === 'web') { 
      if (window.confirm(`Voulez-vous ${nextStatus === 'ACTIVE' ? 'activer' : 'suspendre'} cette société ?`)) executeToggle(); 
    } else { 
      Alert.alert("Confirmation", `Voulez-vous ${nextStatus === 'ACTIVE' ? 'activer' : 'suspendre'} cette société ?`, [
        { text: "Annuler", style: "cancel" }, 
        { text: "OUI", onPress: executeToggle }
      ]); 
    }
  };

  const handleDelete = async () => {
    const executeDelete = async () => {
      setProcessing(true);
      try {
        await api.deleteClient(client.id);
        if (Platform.OS === 'web') { 
          alert("Société supprimée !"); 
          router.back(); 
        } else { 
          Alert.alert("Succès", "Société supprimée !", [{ text: "OK", onPress: () => router.back() }]); 
        }
      } catch (e: any) { 
        const msg = e?.response?.data?.message || "Impossible de supprimer.";
        Platform.OS === 'web' ? alert(msg) : Alert.alert("Erreur", msg); 
      } finally { 
        setProcessing(false); 
      }
    };

    if (Platform.OS === 'web') { 
      if (window.confirm("Supprimer cette société ? Action irréversible.")) executeDelete(); 
    } else { 
      Alert.alert("Confirmation", "Supprimer cette société ? Action irréversible.", [
        { text: "Annuler", style: "cancel" }, 
        { text: "SUPPRIMER", style: "destructive", onPress: executeDelete }
      ]); 
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}><ActivityIndicator color={theme.primary} size="large" /></View>;
  
  if (errorMsg || !client) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#0F172A", fontFamily: FONTS.heading, marginBottom: 8, fontSize: 24, fontWeight: "700" }}>Oups !</Text>
        <Text style={{ color: "#64748B", fontFamily: FONTS.body, textAlign: "center", marginBottom: 24 }}>{errorMsg}</Text>
        <TouchableOpacity style={[styles.backBtnError, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
          <Text style={styles.backBtnTextError}>Retourner à la liste</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isActive = String(client.subscriptionStatus ?? "").toUpperCase() === "ACTIVE";
  const formatName = (f?: string | null, l?: string | null) => `${f || ""} ${l || ""}`.trim() || "Non renseigné";

  // ─── PARSEUR INTELLIGENT D'ADRESSE ───
  const rawAddress = client.ownerAddress || client.address || "";
  const addressParts = rawAddress.split(',').map((s: string) => s.trim());
  
  const streetPart = addressParts[0] || "";
  const streetMatch = streetPart.match(/^(\S+)\s+(.*)/); // Extrait le 1er mot (Numéro) et le reste (Libellé)
  const numero = streetMatch ? streetMatch[1] : "N/A";
  const libelle = streetMatch ? streetMatch[2] : (streetPart || "N/A");

  const cityPart = addressParts[1] || "";
  const cityMatch = cityPart.match(/^(\S+)\s+(.*)/); // Extrait le 1er mot (Code Postal) et le reste (Ville)
  const zipCode = cityMatch ? cityMatch[1] : "N/A";
  const city = cityMatch ? cityMatch[2] : (cityPart || "N/A");

  const pays = addressParts[2] || client.ownerCountry || "N/A";
  const nationalite = client.ownerCountry || "N/A";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      {/* ─── HEADER ─── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={15}>
          <Ionicons name="arrow-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{client.name}</Text>
        <View style={{width: 26}} />
      </View>

      {/* ─── CONTENU ─── */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* CARTE PRINCIPALE (CODE & STATUT) */}
        <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
          <View>
            <Text style={styles.balanceLabel}>CODE SOCIÉTÉ</Text>
            <Text style={styles.balanceValue}>{client.code}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? '#D1FAE5' : '#FEE2E2' }]}>
            <Text style={{ color: isActive ? '#065F46' : '#991B1B', fontFamily: FONTS.body, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>
              {isActive ? 'ACTIVE' : 'SUSPENDUE'}
            </Text>
          </View>
        </View>

        {/* STATISTIQUES (2 Cartes) */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: theme.light }]}><Ionicons name="people" size={20} color={theme.primary} /></View>
            <Text style={styles.statValue}>{client._count?.users ?? 0}</Text>
            <Text style={styles.statLabel}>Utilisateurs</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: theme.light }]}><Ionicons name="business" size={20} color={theme.primary} /></View>
            <Text style={styles.statValue}>{client._count?.agencies ?? 0}</Text>
            <Text style={styles.statLabel}>Agences</Text>
          </View>
        </View>

        {/* INFORMATIONS SOCIÉTÉ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SOCIÉTÉ & CONTACT</Text>
          <InfoRow label="Email Administrateur" value={client.email || client.contactEmail || "Non renseigné"} icon="mail" theme={theme} />
          <InfoRow label="Téléphone Contact" value={client.phone || client.contactPhone || "Non renseigné"} icon="call" theme={theme} />
          <InfoRow label="Secteur d'activité" value={client.activitySector || "Non renseigné"} icon="briefcase" theme={theme} />
          <View style={styles.divider} />
          <InfoRow label="Contrat SaaS" value={client.subscriptionType === "PURCHASE" ? "Achat" : "Location"} icon="document-text" theme={theme} />
        </View>

        {/* INFORMATIONS GÉRANT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS GÉRANT</Text>
          <InfoRow label="Nom complet" value={formatName(client.ownerFirstName, client.ownerLastName)} icon="person" theme={theme} />
          <InfoRow label="Naissance" value={`${client.ownerBirthDate || "Date N/A"} • ${client.ownerBirthPlace || "Lieu N/A"}`} icon="calendar" theme={theme} />
        </View>

        {/* ADRESSE ÉCLATÉE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCALISATION & ADRESSE</Text>
          
          <InfoRow label="Nationalité" value={nationalite} icon="flag" theme={theme} />
          <InfoRow label="Pays de résidence" value={pays} icon="earth" theme={theme} />
          
          <View style={styles.divider} />
          
          <View style={styles.grid2}>
            <View style={{ flex: 0.4 }}>
              <Text style={styles.infoLabel}>Numéro</Text>
              <Text style={styles.infoValue}>{numero}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Libellé de la voie</Text>
              <Text style={styles.infoValue}>{libelle}</Text>
            </View>
          </View>

          <View style={[styles.grid2, { marginTop: 16 }]}>
            <View style={{ flex: 0.4 }}>
              <Text style={styles.infoLabel}>Code Postal</Text>
              <Text style={styles.infoValue}>{zipCode}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Ville</Text>
              <Text style={styles.infoValue}>{city}</Text>
            </View>
          </View>
        </View>

        {/* ACTIONS SENSIBLES */}
        <Text style={[styles.sectionTitle, { marginTop: 15, marginBottom: 12, marginLeft: 4 }]}>ACTIONS RAPIDES</Text>
        <View style={styles.actionsContainer}>
          
          {/* ✅ BOUTON MODIFIER AJOUTÉ ICI */}
          <TouchableOpacity 
            style={[styles.actionBox, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]} 
            onPress={() => router.push({ pathname: "/(tabs)/admin/clients/edit", params: { id: client.id } })}
          >
            <Ionicons name="pencil" size={22} color="#3B82F6" />
            <Text style={[styles.actionBoxText, { color: '#3B82F6' }]}>Modifier</Text>
          </TouchableOpacity>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  backBtnError: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  backBtnTextError: { color: '#FFF', fontFamily: FONTS.body, fontWeight: '800' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontFamily: FONTS.heading, color: '#FFF', fontWeight: '700' },
  
  content: { padding: 20, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30, flexGrow: 1 },
  
  balanceCard: { borderRadius: 20, padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 1 },
  balanceValue: { color: '#FFF', fontSize: 28, fontFamily: FONTS.heading, fontWeight: '900', marginTop: 6, letterSpacing: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },

  statsContainer: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: '#FFF', padding: 16, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontFamily: FONTS.heading, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: FONTS.body, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  section: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionTitle: { fontSize: 12, color: '#94A3B8', fontFamily: FONTS.body, fontWeight: '900', marginBottom: 16, letterSpacing: 1.2 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconSmall: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  infoLabel: { fontSize: 11, color: '#64748B', fontFamily: FONTS.body, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#0F172A', fontFamily: FONTS.body, fontWeight: '700' },
  
  grid2: { flexDirection: 'row', gap: 16 },
  
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4, marginBottom: 16 },
  
  actionsContainer: { flexDirection: 'row', gap: 10 },
  actionBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  actionBoxText: { marginTop: 8, fontSize: 12, fontFamily: FONTS.body, fontWeight: "800", letterSpacing: 0.3 }
});