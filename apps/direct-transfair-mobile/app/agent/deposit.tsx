//apps/direct-transfair-mobile/app/agent/deposit.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api"; 
import { colors } from "../../theme/colors";

export default function AgentDepositScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!phone.trim() || !amount.trim()) {
        if(Platform.OS === 'web') alert("Erreur: Veuillez remplir le numéro et le montant.");
        else Alert.alert("Erreur", "Veuillez remplir le numéro et le montant.");
        return;
    }

    const confirmMsg = `Confirmez-vous le dépôt de ${amount} sur le compte ${phone} ?`;

    if (Platform.OS === 'web') {
        if (confirm(confirmMsg)) processDeposit();
    } else {
        Alert.alert("Confirmation Dépôt", confirmMsg, [
            { text: "Annuler", style: "cancel" },
            { text: "CONFIRMER", onPress: processDeposit }
        ]);
    }
  };

  const processDeposit = async () => {
      setLoading(true);
      try {
          // Note: Assurez-vous que votre api.ts a bien une méthode depositAgent ou un appel POST générique
          await api.http.post('/transactions/deposit', {
              userPhone: phone.trim(),
              amount: parseFloat(amount)
          });
          
          if (Platform.OS === 'web') {
              alert("Succès : Dépôt effectué !");
              router.back();
          } else {
              Alert.alert("Succès", "Dépôt effectué avec succès !", [
                  { text: "OK", onPress: () => router.back() }
              ]);
          }
      } catch (e: any) {
          const msg = e.response?.data?.message || "Le dépôt a échoué.";
          if (Platform.OS === 'web') alert(`Erreur: ${msg}`);
          else Alert.alert("Erreur", msg);
      } finally {
          setLoading(false);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Dépôt Client (Cash-In)</Text>
            <View style={{width:24}} />
        </View>

        <View style={styles.content}>
            <View style={styles.card}>
                <Text style={styles.label}>Numéro du client</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="Ex: 770000000" 
                    placeholderTextColor="#999"
                    keyboardType="phone-pad" 
                    value={phone} 
                    onChangeText={setPhone} 
                />

                <Text style={styles.label}>Montant à créditer</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="Ex: 5000" 
                    placeholderTextColor="#999"
                    keyboardType="numeric" 
                    value={amount} 
                    onChangeText={setAmount} 
                />

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#3B82F6" />
                    <Text style={styles.infoText}>
                        Le client recevra les fonds instantanément sur son Wallet.
                    </Text>
                </View>

                <TouchableOpacity style={styles.btn} onPress={handleDeposit} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.btnText}>VALIDER LE DÉPÔT</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, backgroundColor:'#FFF', borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
    backBtn: { padding: 5 },
    title: { fontSize:18, fontWeight:'800', color:'#111827' },
    content: { padding:20 },
    card: { backgroundColor:'#FFF', padding:20, borderRadius:16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    label: { fontWeight:'700', marginBottom:8, color:'#374151', fontSize:14 },
    input: { backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:14, marginBottom:20, fontSize:16, color:'#1F2937' },
    btn: { backgroundColor: colors.primary, padding:16, borderRadius:12, alignItems:'center', marginTop: 10 },
    btnText: { color:'#FFF', fontWeight:'800', fontSize:16 },
    infoBox: { flexDirection:'row', backgroundColor:'#EFF6FF', padding:12, borderRadius:10, marginBottom:20, alignItems:'center' },
    infoText: { color:'#1E40AF', marginLeft:10, flex:1, fontSize:13, lineHeight: 18 }
});