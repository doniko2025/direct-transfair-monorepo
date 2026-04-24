import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar 
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function EditAgencyScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const theme = THEMES[(user?.role as keyof typeof THEMES)] || THEMES.COMPANY_ADMIN;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => { if (id) fetchDetails(); }, [id]);

  const fetchDetails = async () => {
      try {
          const data = await api.getAgency(id as string);
          setName(data.name || "");
          setCity(data.city || "");
          setAddress(data.address || "");
          setPhone(data.phone || "");
          setEmail(data.email || "");
          setCode(data.code || "");
      } catch (e) {
          Alert.alert("Erreur", "Impossible de charger l'agence");
          router.back();
      } finally {
          setLoading(false);
      }
  };

  const handleUpdate = async () => {
      if (!name || !email) return Alert.alert("Erreur", "Le nom et l'email sont requis");
      
      setSaving(true);
      try {
          await api.updateAgency(id as string, { name, city, address, phone, email, code } as any);
          
          if (Platform.OS === 'web') {
              alert("Agence modifiée avec succès !");
              router.back();
          } else {
              Alert.alert("Succès", "Agence modifiée !", [{ text: "OK", onPress: () => router.back() }]);
          }
      } catch (e: any) {
          console.error(e);
          const msg = e.response?.data?.message || "Erreur lors de la modification";
          Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}><ActivityIndicator color={theme.primary} size="large" /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      
      {/* ─── HEADER ─── */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={15}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier l'Agence</Text>
          <View style={{width: 26}}/>
      </View>

      {/* ─── CONTENU ─── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            <View style={styles.alertBox}>
                <View style={styles.alertIconBg}>
                  <Ionicons name="information" size={20} color="#1E40AF" />
                </View>
                <Text style={styles.alertText}>
                  Attention : Modifier l'email changera l'identifiant de connexion du responsable.
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Nom de l'agence</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} />
                
                <Text style={styles.label}>Code Agence (Unique)</Text>
                <TextInput style={styles.input} value={code} onChangeText={setCode} />
                
                <Text style={styles.label}>Email (Login Responsable)</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                
                <Text style={styles.label}>Téléphone</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Ville</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} />
                
                <Text style={styles.label}>Adresse Complète</Text>
                <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Quartier, Rue..." placeholderTextColor="#9CA3AF" multiline />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleUpdate} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>ENREGISTRER LES MODIFICATIONS</Text>}
            </TouchableOpacity>

            <View style={{height: 120}} /> 
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent:'center', alignItems:'center' },
    
    header: { flexDirection:'row', justifyContent:'space-between', paddingHorizontal: 24, paddingVertical: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, alignItems:'center' },
    headerTitle: { fontSize: 22, fontFamily: FONTS.heading, color: '#FFF', fontWeight: '700' },
    
    content: { padding: 20, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30, flexGrow: 1 },
    
    alertBox: { backgroundColor: '#EFF6FF', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#DBEAFE' },
    alertIconBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    alertText: { color: '#1E40AF', flex: 1, fontSize: 13, fontFamily: FONTS.body, lineHeight: 18, fontWeight: '600' },
    
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
    
    label: { fontSize: 11, fontFamily: FONTS.body, fontWeight: '800', color: '#64748B', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.body, color: '#0F172A', fontWeight: '600' },
    
    saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    saveText: { color: '#FFF', fontFamily: FONTS.body, fontWeight: '800', fontSize: 14, letterSpacing: 1 }
});