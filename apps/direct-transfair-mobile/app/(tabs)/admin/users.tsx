//apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
import React, { useState, useCallback } from "react";
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, 
    SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false); // Loader pour le bouton créer
  const [modalVisible, setModalVisible] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", role: "AGENT"
  });

  // --- HELPER ALERTES WEB/MOBILE ---
  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}: ${msg}`);
    } else {
        Alert.alert(title, msg);
    }
  };

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) { 
        console.log("Erreur chargement users", e); 
    } finally { 
        setLoading(false); 
    }
  }, []);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const handleCreate = async () => {
    // Validation
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
        notify("Erreur", "Tous les champs sont obligatoires.");
        return;
    }

    try {
        setCreating(true);
        console.log("Envoi du formulaire...", form); // Debug

        await api.createUser(form);
        
        notify("Succès", "Utilisateur créé avec succès !");
        setModalVisible(false);
        setForm({ firstName: "", lastName: "", email: "", password: "", role: "AGENT" });
        loadUsers();
    } catch (e: any) {
        console.error("Erreur API:", e);
        const msg = e.response?.data?.message || "La création a échoué.";
        notify("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
        setCreating(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
        <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.firstName?.[0]}{item.lastName?.[0]}</Text>
        </View>
        <View style={{flex:1}}>
            <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
            <Text style={styles.email}>{item.email}</Text>
            <View style={styles.metaRow}>
                <View style={[styles.roleBadge, item.role === 'COMPANY_ADMIN' ? {backgroundColor:'#FEF3C7'} : {}]}>
                    <Text style={[styles.roleText, item.role === 'COMPANY_ADMIN' ? {color:'#D97706'} : {}]}>{item.role}</Text>
                </View>
            </View>
        </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding:5}}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Utilisateurs</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList 
        data={users} 
        renderItem={renderItem} 
        keyExtractor={i => i.id.toString()} 
        contentContainerStyle={{padding:16}} 
        refreshing={loading} 
        onRefresh={loadUsers} 
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop:50, color:'#999'}}>Aucun utilisateur trouvé.</Text>}
      />

      {/* MODAL CRÉATION */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" transparent={false}>
        <SafeAreaView style={{flex:1, backgroundColor:'#FFF'}}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
                <ScrollView contentContainerStyle={{padding:20}}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Nouvel Utilisateur</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.label}>Prénom</Text>
                    <TextInput style={styles.input} placeholder="Ex: Jean" value={form.firstName} onChangeText={t => setForm({...form, firstName: t})} />
                    
                    <Text style={styles.label}>Nom</Text>
                    <TextInput style={styles.input} placeholder="Ex: Dupont" value={form.lastName} onChangeText={t => setForm({...form, lastName: t})} />
                    
                    <Text style={styles.label}>Email de connexion</Text>
                    <TextInput style={styles.input} placeholder="jean@societe.com" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={t => setForm({...form, email: t})} />
                    
                    <Text style={styles.label}>Mot de passe</Text>
                    <TextInput style={styles.input} placeholder="Secret123!" secureTextEntry value={form.password} onChangeText={t => setForm({...form, password: t})} />
                    
                    <Text style={styles.label}>Rôle</Text>
                    <View style={{flexDirection:'row', gap:10, marginVertical:10}}>
                        {['AGENT', 'COMPANY_ADMIN'].map(r => (
                            <TouchableOpacity key={r} onPress={() => setForm({...form, role: r})} style={[styles.roleSelect, form.role === r && styles.roleActive]}>
                                <Text style={form.role === r ? {color:'#FFF', fontWeight:'bold'} : {color:'#333'}}>{r}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
                        {creating ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={{color:'#FFF', fontWeight:'bold', fontSize:16}}>CRÉER L'UTILISATEUR</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { backgroundColor: "#1F2937", padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  addBtn: { backgroundColor: "#FFF", padding: 6, borderRadius: 20 },
  
  card: { backgroundColor: "#FFF", padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems:'center', gap: 15, shadowColor:"#000", shadowOpacity:0.05, elevation:2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primary, fontWeight: 'bold', fontSize: 18 },
  name: { fontWeight: 'bold', fontSize: 16, color:'#1F2937' },
  email: { color: '#666', fontSize: 13, marginBottom:4 },
  
  metaRow: { flexDirection:'row', alignItems:'center', gap:8 },
  roleBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontSize: 10, fontWeight: 'bold', color:'#1E40AF' },

  // Form
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color:'#111' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor:'#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', padding: 14, borderRadius: 10, fontSize: 16 },
  submitBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, shadowColor: colors.primary, shadowOpacity:0.3, elevation:4 },
  roleSelect: { padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, flex: 1, alignItems: 'center', backgroundColor:'#FFF' },
  roleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});