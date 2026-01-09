//apps/direct-transfair-mobile/app/topup.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useAuth } from "../providers/AuthProvider";

export default function TopUpScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'CARD' | 'OM'>('CARD');

  const handleTopUp = async () => {
    const val = parseFloat(amount);
    if (!val || val < 1) return Alert.alert("Erreur", "Montant invalide");

    setLoading(true);
    // Simulation d'appel API de paiement (Stripe / Orange Money)
    setTimeout(async () => {
        try {
            // Ici, normalement tu appelles api.initiatePayment(...)
            // Pour la démo, on suppose que ça a marché et on rafraichit le user
            
            // ⚠️ TODO: Appeler une vraie API de dépôt ici si elle existe
            // await api.deposit({ amount: val, method }); 

            await refreshUser(); // On met à jour le solde localement
            Alert.alert("Succès", "Votre compte a été rechargé !", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (e) {
            Alert.alert("Erreur", "Le paiement a échoué.");
        } finally {
            setLoading(false);
        }
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{padding:10}}>
            <Ionicons name="close" size={28} color="#000" />
        </Pressable>
        <Text style={styles.title}>Recharger mon compte</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Combien voulez-vous ajouter ?</Text>
        <View style={styles.inputWrap}>
            <TextInput 
                style={styles.input} 
                value={amount} 
                onChangeText={setAmount} 
                keyboardType="numeric" 
            />
            <Text style={styles.currency}>EUR</Text>
        </View>

        <Text style={styles.label}>Moyen de paiement</Text>
        <View style={styles.methods}>
            <Pressable 
                style={[styles.methodCard, method === 'CARD' && styles.methodSelected]} 
                onPress={() => setMethod('CARD')}
            >
                <Ionicons name="card" size={24} color={method === 'CARD' ? colors.primary : '#666'} />
                <Text style={styles.methodText}>Carte Bancaire</Text>
            </Pressable>
            
            <Pressable 
                style={[styles.methodCard, method === 'OM' && styles.methodSelected]} 
                onPress={() => setMethod('OM')}
            >
                <Ionicons name="phone-portrait" size={24} color={method === 'OM' ? colors.primary : '#666'} />
                <Text style={styles.methodText}>Orange Money</Text>
            </Pressable>
        </View>

        <Pressable style={styles.btn} onPress={handleTopUp} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Payer {amount} EUR</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { padding: 15, flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    content: { padding: 20 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#374151' },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 30, borderWidth: 1, borderColor: '#E5E7EB' },
    input: { flex: 1, fontSize: 24, fontWeight: 'bold' },
    currency: { fontSize: 20, fontWeight: '600', color: '#6B7280' },
    methods: { flexDirection: 'row', gap: 15, marginBottom: 30 },
    methodCard: { flex: 1, padding: 20, backgroundColor: '#FFF', borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
    methodSelected: { borderColor: colors.primary, backgroundColor: '#FFF7ED' },
    methodText: { marginTop: 10, fontWeight: '600', fontSize: 12 },
    btn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});