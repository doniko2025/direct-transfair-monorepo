//apps/direct-transfair-mobile/app/agent/deposit.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, Pressable, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AgentDepositScreen() {
  const router = useRouter();
  
  const [clientPhone, setClientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeposit = () => {
    if (!clientPhone || !amount) {
        return Alert.alert("Erreur", "Veuillez remplir le numéro du client et le montant.");
    }

    setLoading(true);
    // Simulation API
    setTimeout(() => {
        setLoading(false);
        Alert.alert(
            "Dépôt Réussi ✅",
            `Le compte du client (+221 ${clientPhone}) a été rechargé de ${amount} FCFA avec succès.`,
            [{ text: "OK", onPress: () => router.back() }]
        );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Dépôt / Cash-In</Text>
        <View style={{width: 24}} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#065F46" />
            <Text style={styles.infoText}>
                Vous allez recharger le compte virtuel d'un client. Assurez-vous d'avoir reçu les espèces.
            </Text>
        </View>

        {/* --- CLIENT --- */}
        <Text style={styles.label}>Numéro du Client</Text>
        <View style={styles.inputWrap}>
            <Ionicons name="phone-portrait-outline" size={20} color="#6B7280" style={{marginRight:10}} />
            <TextInput 
                style={styles.input} 
                placeholder="Ex: 77 000 00 00" 
                keyboardType="phone-pad"
                value={clientPhone}
                onChangeText={setClientPhone}
            />
        </View>

        {/* --- MONTANT --- */}
        <Text style={styles.label}>Montant à déposer</Text>
        <View style={styles.inputWrap}>
            <Text style={styles.currency}>FCFA</Text>
            <TextInput 
                style={[styles.input, {fontSize: 20, fontWeight:'bold'}]} 
                placeholder="0" 
                keyboardType="numeric" 
                value={amount}
                onChangeText={setAmount}
            />
        </View>

        <Pressable 
            style={({pressed}) => [styles.btn, pressed && {opacity: 0.9}]} 
            onPress={handleDeposit} 
            disabled={loading}
        >
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Valider le Dépôt</Text>}
        </Pressable>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { backgroundColor: '#064E3B', padding: 20, paddingTop: Platform.OS==='android'?40:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },
    content: { padding: 20 },

    infoBox: { flexDirection:'row', backgroundColor:'#D1FAE5', padding:15, borderRadius:12, marginBottom:25, alignItems:'center' },
    infoText: { marginLeft:10, color:'#065F46', flex:1, fontSize:13 },

    label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    input: { flex: 1, fontSize: 16, color: '#1F2937' },
    currency: { fontSize: 16, fontWeight: '700', color: '#9CA3AF', marginRight: 10 },

    btn: { backgroundColor: '#10B981', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, shadowColor: "#10B981", shadowOpacity: 0.3, elevation: 5 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' }
});