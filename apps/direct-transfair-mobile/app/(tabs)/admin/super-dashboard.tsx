//apps/direct-transfair-mobile/app/(tabs)/admin/super-dashboard.tsx
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert,
  FlatList, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "", code: "", primaryColor: "#F7931E", subscriptionType: "RENTAL",
    email: "", adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "",
  });

  const loadClients = useCallback(async () => {
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (e) {
      console.log("Erreur loading", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadClients(); }, [loadClients]));

  // --- ACTIONS ---
  const confirmAction = (msg: string, action: () => void) => {
    if (Platform.OS === 'web') {
        if (window.confirm(msg)) action();
    } else {
        Alert.alert("Confirmation", msg, [{ text: "Annuler", style: "cancel" }, { text: "Oui", onPress: action }]);
    }
  };

  const notify = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert("Info", msg);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm({ name: "", code: "", primaryColor: "#F7931E", subscriptionType: "RENTAL", email: "", adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "" });
    setModalVisible(true);
  };

  const openEditModal = (client: any) => {
    setIsEditing(true);
    setEditingId(client.id);
    setForm({
        name: client.name, code: client.code, primaryColor: client.primaryColor, subscriptionType: client.subscriptionType,
        email: "", adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "" 
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) { notify("Nom et Code requis"); return; }
    try {
        setLoading(true);
        if (isEditing && editingId) {
            await api.updateClient(editingId, { name: form.name, code: form.code, primaryColor: form.primaryColor, subscriptionType: form.subscriptionType });
            notify("Société modifiée !");
        } else {
            if (!form.adminEmail || !form.adminPassword) { notify("Admin requis pour création"); setLoading(false); return; }
            await api.createClient(form);
            notify("Société créée !");
        }
        setModalVisible(false);
        loadClients();
    } catch (e: any) {
        notify("Erreur : " + (e.response?.data?.message || "Action impossible"));
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = (client: any) => {
    confirmAction(`Supprimer ${client.name} ?`, async () => {
        try {
            setLoading(true);
            await api.deleteClient(client.id);
            loadClients();
        } catch(e) { notify("Suppression échouée"); setLoading(false); }
    });
  };

  const handleToggleStatus = (client: any) => {
    confirmAction(`Changer statut de ${client.name} ?`, async () => {
        try {
            setLoading(true);
            const newStatus = client.subscriptionStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
            await api.updateClientStatus(client.id, newStatus);
            loadClients();
        } catch(e) { notify("Statut inchangé"); setLoading(false); }
    });
  };

  const renderClientItem = ({ item }: { item: any }) => {
    const isSuspended = item.subscriptionStatus === 'SUSPENDED';
    return (
        <View style={[styles.card, isSuspended && styles.cardSuspended]}>
          <View style={[styles.colorIndicator, { backgroundColor: item.primaryColor || '#999' }]} />
          <View style={{ flex: 1, paddingVertical: 4 }}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>Code: {item.code}</Text>
            <View style={{flexDirection:'row', alignItems:'center', marginTop:4, gap:6}}>
                 <View style={styles.tag}><Text style={styles.tagText}>{item.subscriptionType === 'PURCHASE' ? 'ACHAT' : 'LOC'}</Text></View>
                 {isSuspended && <View style={[styles.tag, {backgroundColor:'#FEE2E2'}]}><Text style={[styles.tagText, {color:'#B91C1C'}]}>SUSPENDU</Text></View>}
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}><Ionicons name="pencil" size={20} color="#3B82F6" /></TouchableOpacity>
            <TouchableOpacity onPress={() => handleToggleStatus(item)} style={styles.actionBtn}><Ionicons name={isSuspended ? "play" : "pause"} size={20} color={isSuspended ? "#10B981" : "#F59E0B"} /></TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}><Ionicons name="trash" size={20} color="#EF4444" /></TouchableOpacity>
          </View>
        </View>
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion Sociétés</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addBtn}><Ionicons name="add" size={24} color={colors.primary} /></TouchableOpacity>
      </View>
      <FlatList data={clients} keyExtractor={(item) => item.id.toString()} renderItem={renderClientItem} contentContainerStyle={styles.list} refreshing={loading} onRefresh={loadClients} ListEmptyComponent={<Text style={styles.emptyText}>Aucune société.</Text>} />
      
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? "Modifier Société" : "Nouvelle Société"}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={styles.label}>Nom</Text><TextInput style={styles.input} value={form.name} onChangeText={t => setForm({...form, name: t})} />
                <Text style={styles.label}>Code</Text><TextInput style={styles.input} value={form.code} onChangeText={t => setForm({...form, code: t})} />
                <Text style={styles.label}>Couleur (Hex)</Text><TextInput style={styles.input} value={form.primaryColor} onChangeText={t => setForm({...form, primaryColor: t})} />
                <Text style={styles.label}>Type</Text>
                <View style={styles.row}>
                    <TouchableOpacity style={[styles.radioBtn, form.subscriptionType === 'RENTAL' && styles.radioBtnActive]} onPress={() => setForm({...form, subscriptionType: 'RENTAL'})}><Text style={[styles.radioText, form.subscriptionType === 'RENTAL' && styles.radioTextActive]}>Location</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.radioBtn, form.subscriptionType === 'PURCHASE' && styles.radioBtnActive]} onPress={() => setForm({...form, subscriptionType: 'PURCHASE'})}><Text style={[styles.radioText, form.subscriptionType === 'PURCHASE' && styles.radioTextActive]}>Achat</Text></TouchableOpacity>
                </View>
                {!isEditing && (
                    <>
                        <View style={styles.separator} />
                        <Text style={styles.sectionHeader}>Admin</Text>
                        <TextInput style={styles.input} placeholder="Prénom" value={form.adminFirstName} onChangeText={t => setForm({...form, adminFirstName: t})} />
                        <TextInput style={[styles.input, {marginTop:10}]} placeholder="Nom" value={form.adminLastName} onChangeText={t => setForm({...form, adminLastName: t})} />
                        <TextInput style={[styles.input, {marginTop:10}]} placeholder="Email" value={form.adminEmail} onChangeText={t => setForm({...form, adminEmail: t})} />
                        <TextInput style={[styles.input, {marginTop:10}]} placeholder="Mot de passe" secureTextEntry value={form.adminPassword} onChangeText={t => setForm({...form, adminPassword: t})} />
                    </>
                )}
                <TouchableOpacity style={styles.submitBtn} onPress={handleSave}><Text style={styles.submitText}>ENREGISTRER</Text></TouchableOpacity>
                <View style={{height: 50}} />
              </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      {loading && <View style={styles.loaderOverlay}><ActivityIndicator size="large" color="#FFF" /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { backgroundColor: "#1F2937", padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 4 }, addBtn: { backgroundColor: "#FFF", padding: 8, borderRadius: 20 },
  list: { padding: 16 }, emptyText: { textAlign: 'center', marginTop: 50, color: '#666' },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, elevation: 2 },
  cardSuspended: { opacity: 0.7, backgroundColor: '#F9FAFB' },
  colorIndicator: { width: 4, height: '80%', borderRadius: 2, marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" }, cardSubtitle: { fontSize: 13, color: "#666" },
  tag: { backgroundColor: '#E5E7EB', paddingHorizontal:6, paddingVertical:2, borderRadius:4 }, tagText: { fontSize: 10, fontWeight:'700', color:'#4B5563' },
  actions: { flexDirection: 'row', marginLeft: 10 }, actionBtn: { padding: 10, backgroundColor:'#F9FAFB', borderRadius:8, marginLeft:6, borderWidth:1, borderColor:'#EEE' },
  modalHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF' },
  modalTitle: { fontSize: 18, fontWeight: '800' }, formContainer: { padding: 20 },
  sectionHeader: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 4 }, separator: { height: 1, backgroundColor: '#EEE', marginVertical: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 }, 
  radioBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, alignItems: 'center' },
  radioBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioText: { color: '#374151', fontWeight: '600' },
  radioTextActive: { color: '#FFF' },
  submitBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }
});