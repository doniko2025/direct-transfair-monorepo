//apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
import React, { useState, useCallback } from "react";
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, 
    SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF" },
  AGENT: { primary: "#78350F", light: "#FFF7ED" },
  USER: { primary: "#059669", light: "#ECFDF5" },
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", role: "AGENT"
  });

  const notify = (title: string, msg: string) => {
    Platform.OS === 'web' ? window.alert(`${title}: ${msg}`) : Alert.alert(title, msg);
  };

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch (e) { 
      console.log("Erreur chargement users", e); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
        return notify("Erreur", "Tous les champs sont obligatoires.");
    }
    try {
        setCreating(true);
        await api.createUser(form);
        notify("Succès", "Utilisateur créé avec succès !");
        setModalVisible(false);
        setForm({ firstName: "", lastName: "", email: "", password: "", role: "AGENT" });
        loadUsers();
    } catch (e: any) {
        const msg = e.response?.data?.message || "La création a échoué.";
        notify("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
        setCreating(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={s.card}>
        <View style={[s.avatar, { backgroundColor: theme.light }]}>
            <Text style={[s.avatarText, { color: theme.primary }]}>{item.firstName?.[0]}{item.lastName?.[0]}</Text>
        </View>
        <View style={{flex:1}}>
            <Text style={s.name}>{item.firstName} {item.lastName}</Text>
            <Text style={s.email}>{item.email}</Text>
            <View style={s.metaRow}>
                <View style={[s.roleBadge, item.role === 'COMPANY_ADMIN' ? {backgroundColor:'#FEF3C7'} : {backgroundColor: '#F1F5F9'}]}>
                    <Text style={[s.roleText, item.role === 'COMPANY_ADMIN' ? {color:'#D97706'} : {color: '#64748B'}]}>{item.role.replace("_", " ")}</Text>
                </View>
            </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </View>
  );

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      <View style={[s.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={s.title}>Utilisateurs</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={s.addBtn}>
            <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={s.container}>
        <FlatList 
            data={usersList} 
            renderItem={renderItem} 
            keyExtractor={i => i.id.toString()} 
            contentContainerStyle={s.list} 
            refreshing={loading} 
            onRefresh={loadUsers} 
            ListEmptyComponent={
              <View style={s.emptyState}>
                <Ionicons name="people" size={48} color="#CBD5E1" />
                <Text style={s.emptyText}>Aucun utilisateur trouvé.</Text>
              </View>
            }
        />
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{width: '100%', maxHeight: '90%'}}>
                <View style={s.modalContent}>
                    <View style={s.modalDrag} />
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Nouvel Utilisateur</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                      <View style={{flexDirection: 'row', gap: 12}}>
                        <View style={{flex: 1}}><Text style={s.label}>Prénom</Text><TextInput style={s.input} placeholder="Ex: Jean" placeholderTextColor="#9CA3AF" value={form.firstName} onChangeText={t => setForm({...form, firstName: t})} /></View>
                        <View style={{flex: 1}}><Text style={s.label}>Nom</Text><TextInput style={s.input} placeholder="Ex: Dupont" placeholderTextColor="#9CA3AF" value={form.lastName} onChangeText={t => setForm({...form, lastName: t})} /></View>
                      </View>

                      <Text style={s.label}>Email de connexion</Text>
                      <TextInput style={s.input} placeholder="jean@societe.com" placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={t => setForm({...form, email: t})} />

                      <Text style={s.label}>Mot de passe</Text>
                      <TextInput style={s.input} placeholder="Secret123!" placeholderTextColor="#9CA3AF" secureTextEntry value={form.password} onChangeText={t => setForm({...form, password: t})} />

                      <Text style={s.label}>Rôle attribué</Text>
                      <View style={s.roleSelector}>
                          {['AGENT', 'COMPANY_ADMIN'].map(r => (
                              <TouchableOpacity key={r} onPress={() => setForm({...form, role: r})} style={[s.roleOption, form.role === r && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                                  <Text style={[s.roleOptionText, form.role === r && {color: '#FFF'}]}>{r.replace("_", " ")}</Text>
                              </TouchableOpacity>
                          ))}
                      </View>

                      <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.primary }, creating && { opacity: 0.7 }]} onPress={handleCreate} disabled={creating}>
                          {creating ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitText}>CRÉER L'UTILISATEUR</Text>}
                      </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: "#FFF", fontSize: 20, fontFamily: FONTS.heading, fontWeight: "800" },
  backBtn: { padding: 4 },
  addBtn: { backgroundColor: "#FFF", padding: 6, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.1, elevation: 2 },

  container: { flex: 1, backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  list: { padding: 20, paddingTop: 30 },
  
  card: { backgroundColor: "#FFF", padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems:'center', gap: 16, shadowColor:"#000", shadowOpacity:0.02, shadowRadius: 5, elevation:1, borderWidth: 1, borderColor: '#F1F5F9' },
  avatar: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '900', fontSize: 18, fontFamily: FONTS.heading },
  name: { fontWeight: '800', fontSize: 16, fontFamily: FONTS.body, color:'#0F172A', marginBottom: 2 },
  email: { color: '#64748B', fontSize: 13, fontFamily: FONTS.body, marginBottom: 6 },
  metaRow: { flexDirection:'row', alignItems:'center' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 10, fontWeight: '900', fontFamily: FONTS.body, letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#94A3B8', fontFamily: FONTS.body, fontSize: 15, marginTop: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24 },
  modalDrag: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:24 },
  modalTitle: { fontSize: 22, fontFamily: FONTS.heading, fontWeight: '800', color:'#0F172A' },
  closeBtn: { backgroundColor: '#F1F5F9', padding: 6, borderRadius: 12 },
  
  label: { fontSize: 12, fontFamily: FONTS.body, fontWeight: '800', color: '#64748B', marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  input: { backgroundColor:'#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 16, borderRadius: 16, fontSize: 15, fontFamily: FONTS.body, color: '#0F172A', fontWeight: '600' },
  
  roleSelector: { flexDirection: 'row', gap: 12, backgroundColor: '#F8FAFC', padding: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  roleOption: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  roleOptionText: { fontFamily: FONTS.body, fontWeight: '700', color: '#64748B', fontSize: 13 },

  submitBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 30, shadowColor: "#000", shadowOpacity:0.2, shadowRadius: 10, elevation:4 },
  submitText: { color:'#FFF', fontFamily: FONTS.body, fontWeight:'900', fontSize:15, letterSpacing: 1 },
});