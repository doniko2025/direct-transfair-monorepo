//apps/direct-transfair-mobile/app/wallet-transfer.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, Pressable, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";
import { colors } from "../theme/colors";

export default function WalletTransferScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [recipient, setRecipient] = useState(""); 
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    const val = parseFloat(amount);
    
    if (!recipient || recipient.length < 3) return Alert.alert("Erreur", "Veuillez entrer un email ou numéro valide.");
    if (!val || val <= 0) return Alert.alert("Erreur", "Montant invalide.");
    
    const currentBalance = user?.balance ? Number(user.balance) : 0;
    if (val > currentBalance) return Alert.alert("Solde insuffisant", "Veuillez recharger votre compte.");

    setLoading(true);

    setTimeout(async () => {
        try {
            const newBalance = currentBalance - val;
            await api.updateProfile({ balance: newBalance } as any);
            await refreshUser();

            Alert.alert(
                "Transfert réussi ! 🎉", 
                `Vous avez envoyé ${val} EUR à ${recipient} sans frais.`,
                [{ text: "Super", onPress: () => router.back() }]
            );
        } catch (e) {
            Alert.alert("Erreur", "Le transfert a échoué.");
        } finally {
            setLoading(false);
        }
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Transfert entre amis</Text>
        <View style={{width: 24}} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        <View style={styles.freeBanner}>
            <View style={styles.iconCircle}>
                <Ionicons name="flash" size={20} color="#10B981" />
            </View>
            <View style={{flex:1}}>
                <Text style={styles.freeTitle}>Transfert Wallet à Wallet</Text>
                <Text style={styles.freeText}>Envoyez de l'argent instantanément et <Text style={{fontWeight:'bold'}}>sans aucun frais</Text>.</Text>
            </View>
        </View>

        <Text style={styles.label}>Pour qui ?</Text>
        <View style={styles.inputWrap}>
            {/* ✅ CORRECTION ICI : search-outline au lieu de person-search-outline */}
            <Ionicons name="search-outline" size={20} color="#6B7280" style={{marginRight:10}} />
            <TextInput 
                style={styles.input} 
                placeholder="Email ou N° de téléphone du client" 
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
                keyboardType="email-address"
            />
        </View>

        <Text style={styles.label}>Combien ?</Text>
        <View style={styles.inputWrap}>
            <Text style={styles.currency}>EUR</Text>
            <TextInput 
                style={[styles.input, {fontSize: 20, fontWeight:'bold'}]} 
                placeholder="0" 
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
            />
        </View>

        <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Frais de transaction</Text>
            <Text style={styles.feeValue}>0.00 EUR</Text>
        </View>

        <View style={{flex:1}} />

        <Pressable 
            style={({pressed}) => [styles.btn, pressed && {opacity: 0.9}]} 
            onPress={handleTransfer} 
            disabled={loading}
        >
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Envoyer sans frais</Text>}
        </Pressable>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    
    header: { backgroundColor: colors.primary, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 20, paddingHorizontal: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },

    content: { padding: 20, flexGrow: 1 },

    freeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 15, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#A7F3D0' },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    freeTitle: { color: '#065F46', fontWeight: '800', fontSize: 15, marginBottom: 2 },
    freeText: { color: '#047857', fontSize: 13 },

    label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 10 },
    
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 15, borderWidth: 1, borderColor: '#E5E7EB', shadowColor:'#000', shadowOpacity:0.02, shadowRadius:5 },
    input: { flex: 1, fontSize: 16, color: '#1F2937' },
    currency: { fontSize: 16, fontWeight: '700', color: '#9CA3AF', marginRight: 10 },

    feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 5 },
    feeLabel: { color: '#6B7280' },
    feeValue: { color: '#10B981', fontWeight: '800', fontSize: 16 },

    btn: { backgroundColor: '#10B981', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 40, shadowColor: "#10B981", shadowOpacity: 0.3, elevation: 5 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' }
});