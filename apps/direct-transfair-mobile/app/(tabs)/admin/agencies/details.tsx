//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/details.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

export default function AgencyDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
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
      const confirmMessage = "Êtes-vous sûr de vouloir supprimer cette agence ? Cette action est irréversible.";
      
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
          if (window.confirm("Changer le statut de l'agence ?")) executeToggle(); 
      } else { 
          Alert.alert("Confirmation", "Changer le statut de l'agence ?", [
              { text: "Annuler", style: "cancel" }, 
              { text: "OUI", onPress: executeToggle }
          ]); 
      }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!agency) return <View style={styles.center}><Text>Agence introuvable</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>{agency.name}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: agency.id } })}>
              <Ionicons name="pencil" size={20} color="#FFF" />
          </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.balanceCard}>
              <View>
                  <Text style={styles.balanceLabel}>Solde Caisse</Text>
                  {/* ✅ AFFICHAGE DYNAMIQUE DEVISE */}
                  <Text style={styles.balanceValue}>
                      {(agency.balance || 0).toLocaleString()} {agency.currency || 'XOF'}
                  </Text>
              </View>
              <View style={[styles.statusBadge, {backgroundColor: agency.isActive ? '#D1FAE5' : '#FEE2E2'}]}>
                  <Text style={{color: agency.isActive ? '#065F46' : '#991B1B', fontWeight:'700', fontSize:12}}>
                      {agency.isActive ? 'ACTIVE' : 'SUSPENDUE'}
                  </Text>
              </View>
          </View>

          <View style={styles.section}>
              <Text style={styles.sectionTitle}>INFORMATIONS</Text>
              <InfoRow label="Code Agence" value={agency.code || "N/A"} icon="qr-code" />
              <InfoRow label="Devise" value={agency.currency || "XOF"} icon="cash" /> 
              <InfoRow label="Email" value={agency.email || "N/A"} icon="mail" />
              <InfoRow label="Téléphone" value={agency.phone || "N/A"} icon="call" />
              <View style={styles.divider} />
              <InfoRow label="Ville" value={agency.city} icon="location" />
              <InfoRow label="Adresse" value={agency.address} icon="map" />
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 15, marginBottom:10}]}>ACTIONS SENSIBLES</Text>
          <View style={styles.actionsContainer}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnSuspend]} onPress={handleToggleStatus} disabled={processing}>
                  {processing ? <ActivityIndicator size="small" color="#D97706" /> : <><Ionicons name={agency.isActive ? "pause" : "play"} size={18} color="#D97706" /><Text style={styles.btnTextSuspend}>{agency.isActive ? "Suspendre" : "Activer"}</Text></>}
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionBtn, styles.btnDelete]} onPress={handleDelete} disabled={processing}>
                  {processing ? <ActivityIndicator size="small" color="#DC2626" /> : <><Ionicons name="trash" size={18} color="#DC2626" /><Text style={styles.btnTextDelete}>Supprimer</Text></>}
              </TouchableOpacity>
          </View>
          <View style={{height: 120}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow = ({label, value, icon}: any) => (
    <View style={styles.infoRow}>
        <View style={styles.iconSmall}><Ionicons name={icon} size={16} color="#6B7280" /></View>
        <View style={{flex:1}}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    center: { flex: 1, justifyContent:'center', alignItems:'center' },
    header: { flexDirection:'row', justifyContent:'space-between', padding: 20, backgroundColor:'#FFF', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
    headerTitle: { fontSize: 18, fontWeight:'700' },
    editBtn: { backgroundColor: colors.primary, padding:8, borderRadius:10 },
    content: { padding: 20 },
    balanceCard: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 20, elevation:5 },
    balanceLabel: { color:'rgba(255,255,255,0.8)', fontSize:12, fontWeight:'600' },
    balanceValue: { color:'#FFF', fontSize:24, fontWeight:'800', marginTop:4 },
    statusBadge: { paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
    section: { backgroundColor:'#FFF', borderRadius: 16, padding: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 12, color:'#9CA3AF', fontWeight:'800', marginBottom: 15, letterSpacing:1 },
    infoRow: { flexDirection:'row', alignItems:'center', marginBottom: 16 },
    iconSmall: { width: 32, height: 32, backgroundColor:'#F3F4F6', borderRadius:8, justifyContent:'center', alignItems:'center', marginRight: 12 },
    infoLabel: { fontSize: 12, color:'#6B7280' },
    infoValue: { fontSize: 15, color:'#1F2937', fontWeight:'600' },
    divider: { height:1, backgroundColor:'#F3F4F6', marginVertical:10 },
    actionsContainer: { flexDirection: 'row', gap: 15 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
    btnSuspend: { backgroundColor: '#FFF', borderColor: '#FCD34D' },
    btnTextSuspend: { color: '#D97706', fontWeight: '700' },
    btnDelete: { backgroundColor: '#FFF', borderColor: '#FCA5A5' },
    btnTextDelete: { color: '#DC2626', fontWeight: '700' }
});