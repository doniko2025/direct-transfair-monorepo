//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/edit.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

export default function EditAgencyScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
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
          setName(data.name);
          setCity(data.city);
          setAddress(data.address);
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
      if (!name || !email) return Alert.alert("Erreur", "Nom et Email requis");
      
      console.log("Envoi mise à jour pour ID:", id); // LOG DE DEBUG
      
      setSaving(true);
      try {
          // Appel de la méthode qui existe maintenant dans api.ts
          await api.updateAgency(id as string, { name, city, address, phone, email, code });
          
          Alert.alert("Succès", "Agence modifiée !", [{ text: "OK", onPress: () => router.back() }]);
      } catch (e: any) {
          console.error(e);
          const msg = e.response?.data?.message || "Erreur lors de la modification";
          Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier l'Agence</Text>
          <View style={{width:24}}/>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.alertBox}>
              <Ionicons name="information-circle" size={20} color="#1E40AF" />
              <Text style={styles.alertText}>Modifier l'email changera aussi l'identifiant de connexion du responsable.</Text>
          </View>

          <View style={styles.card}>
              <Text style={styles.label}>Nom de l'agence</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />
              <Text style={styles.label}>Code Agence</Text>
              <TextInput style={styles.input} value={code} onChangeText={setCode} />
              <Text style={styles.label}>Email (Login Agent)</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Text style={styles.label}>Téléphone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          <View style={styles.card}>
              <Text style={styles.label}>Ville</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} />
              <Text style={styles.label}>Adresse</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>ENREGISTRER</Text>}
          </TouchableOpacity>

          <View style={{height: 100}} /> 
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    center: { flex: 1, justifyContent:'center', alignItems:'center' },
    header: { flexDirection:'row', justifyContent:'space-between', padding: 20, backgroundColor:'#FFF', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
    headerTitle: { fontSize: 18, fontWeight:'700' },
    content: { padding: 20 },
    alertBox: { backgroundColor: '#EFF6FF', padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth:1, borderColor:'#DBEAFE' },
    alertText: { color: '#1E40AF', marginLeft: 10, flex: 1, fontSize: 13, lineHeight: 18 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 15 },
    label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 15 },
    saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    saveText: { color: '#FFF', fontWeight: '800', fontSize: 16 }
});