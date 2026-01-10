//apps/direct-transfair-mobile/app/agent/withdraw.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, Pressable, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AgentWithdrawScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [transaction, setTransaction] = useState<any>(null); // Stocker la transaction trouvée

  // 1. Vérifier le code
  const handleCheckCode = () => {
    if (code.length < 5) return Alert.alert("Erreur", "Code invalide");
    
    setChecking(true);
    // Simulation API
    setTimeout(() => {
        setChecking(false);
        // On simule une transaction trouvée
        setTransaction({
            id: 'TX-12345',
            sender: 'Mamadou Diallo',
            amount: 50000,
            currency: 'FCFA',
            status: 'PENDING'
        });
    }, 1500);
  };

  // 2. Valider le paiement (Donner le cash)
  const handlePayOut = () => {
      Alert.alert(
          "Confirmation", 
          `Confirmez-vous avoir remis ${transaction.amount} ${transaction.currency} au client ?`,
          [
              { text: "Annuler", style: 'cancel' },
              { text: "CONFIRMER", onPress: () => {
                  // Ici, on appellerait l'API pour valider le retrait
                  // Et le solde virtuel de l'agent augmenterait
                  Alert.alert("Succès", "Retrait validé. Votre solde virtuel a été crédité.", [
                      { text: "OK", onPress: () => router.back() }
                  ]);
              }}
          ]
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Retrait Espèces</Text>
        <View style={{width: 24}} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1, padding: 20}}>
        
        {/* ÉTAPE 1 : SAISIE DU CODE */}
        {!transaction ? (
            <View style={styles.centerBox}>
                <Ionicons name="qr-code-outline" size={60} color="#EF4444" style={{marginBottom: 20}} />
                <Text style={styles.label}>Entrez le code de retrait du client</Text>
                
                <TextInput 
                    style={styles.codeInput} 
                    placeholder="DT-XXXXXX" 
                    value={code}
                    onChangeText={text => setCode(text.toUpperCase())}
                    autoCapitalize="characters"
                />

                <Pressable style={styles.btn} onPress={handleCheckCode} disabled={checking}>
                    {checking ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Vérifier le code</Text>}
                </Pressable>
            </View>
        ) : (
            // ÉTAPE 2 : CONFIRMATION
            <View style={styles.resultBox}>
                <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={40} color="#FFF" />
                </View>
                <Text style={styles.resultTitle}>Code Valide !</Text>
                
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Montant à payer :</Text>
                    <Text style={styles.detailValue}>{transaction.amount} {transaction.currency}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expéditeur :</Text>
                    <Text style={styles.detailValue}>{transaction.sender}</Text>
                </View>

                <View style={styles.warningBox}>
                    <Text style={styles.warningText}>⚠️ Vérifiez l'identité du client avant de remettre les fonds.</Text>
                </View>

                <Pressable style={[styles.btn, {backgroundColor: '#10B981'}]} onPress={handlePayOut}>
                    <Text style={styles.btnText}>Confirmer le paiement</Text>
                </Pressable>
                
                <Pressable style={{marginTop: 20}} onPress={() => setTransaction(null)}>
                    <Text style={{color: '#6B7280'}}>Annuler</Text>
                </Pressable>
            </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { backgroundColor: '#064E3B', padding: 20, paddingTop: Platform.OS==='android'?40:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },

    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    label: { fontSize: 16, color: '#374151', marginBottom: 15 },
    codeInput: { fontSize: 24, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#EF4444', width: '80%', textAlign: 'center', padding: 10, marginBottom: 30, color: '#1F2937' },

    resultBox: { flex: 1, alignItems: 'center', paddingTop: 40 },
    successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    resultTitle: { fontSize: 24, fontWeight: '800', color: '#065F46', marginBottom: 30 },
    
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15, paddingHorizontal: 20 },
    detailLabel: { fontSize: 16, color: '#6B7280' },
    detailValue: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },

    warningBox: { backgroundColor: '#FEF2F2', padding: 15, borderRadius: 10, marginVertical: 30 },
    warningText: { color: '#B91C1C', fontWeight: '600' },

    btn: { backgroundColor: '#EF4444', padding: 18, borderRadius: 12, alignItems: 'center', width: '100%', shadowColor: "#000", shadowOpacity: 0.1, elevation: 5 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' }
});