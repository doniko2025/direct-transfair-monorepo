//apps/direct-transfair-mobile/app/agent/withdraw.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, Pressable, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api"; 

export default function AgentWithdrawScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [transaction, setTransaction] = useState<any>(null);

  const showAlert = (title: string, msg: string) => {
      if (Platform.OS === 'web') alert(`${title}: ${msg}`);
      else Alert.alert(title, msg);
  };

  const handleCheckCode = async () => {
    // ✅ Code à 9 chiffres uniquement
    if (code.length !== 9) {
        showAlert("Erreur", "Le code doit contenir 9 chiffres");
        return;
    }

    setChecking(true);
    setTransaction(null);
    try {
        const res = await api.http.post('/withdrawals/agent/check', { code });
        setTransaction(res.data);
    } catch (e: any) {
        const msg = e.response?.data?.message || "Code invalide ou introuvable";
        showAlert("Erreur", msg);
    } finally {
        setChecking(false);
    }
  };

  const handlePayOut = () => {
      const msg = `Confirmez-vous avoir remis ${transaction.amount} ${transaction.currency} au client ?`;

      if (Platform.OS === 'web') {
          if (window.confirm(`CONFIRMATION\n\n${msg}`)) {
              processPayment();
          }
      } else {
          Alert.alert("Confirmation", msg, [
              { text: "Annuler", style: 'cancel' },
              { text: "CONFIRMER", onPress: processPayment }
          ]);
      }
  };

  const processPayment = async () => {
      setPaying(true);
      try {
          await api.http.post('/withdrawals/agent/pay', { code });

          if (Platform.OS === 'web') {
              alert("Succès : Paiement validé !");
              router.back();
          } else {
              Alert.alert("Succès", "Paiement validé !", [
                  { text: "OK", onPress: () => router.back() }
              ]);
          }
      } catch (e: any) {
          const msg = e.response?.data?.message || "Echec validation";
          showAlert("Erreur", msg);
      } finally {
          setPaying(false);
      }
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={{padding: 20, flexGrow: 1, justifyContent: 'center'}}>

        {!transaction ? (
            <View style={styles.centerBox}>
                <Ionicons name="qr-code-outline" size={80} color="#065F46" style={{marginBottom: 20, opacity: 0.8}} />
                <Text style={styles.label}>Entrez le code de retrait (9 chiffres)</Text>

                <TextInput 
                    style={styles.codeInput} 
                    placeholder="123456789" 
                    placeholderTextColor="#CBD5E1"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={9}
                />

                <Pressable 
                    style={({pressed}) => [styles.btn, pressed && {opacity:0.9}]} 
                    onPress={handleCheckCode} 
                    disabled={checking}
                >
                    {checking ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Vérifier le code</Text>}
                </Pressable>
            </View>
        ) : (
            <View style={styles.resultBox}>
                <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={40} color="#FFF" />
                </View>
                <Text style={styles.resultTitle}>Code Valide !</Text>

                <View style={styles.card}>
                    {/* MONTANT À PAYER */}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Montant à payer</Text>
                        <Text style={styles.amountValue}>{transaction.amount} <Text style={{fontSize:16}}>{transaction.currency}</Text></Text>
                    </View>
                    <View style={styles.divider} />
                    
                    {/* INFO EXPÉDITEUR */}
                    <View style={styles.detailRowSmall}>
                        <Text style={styles.detailLabelSmall}>Expéditeur</Text>
                        <Text style={styles.detailValueSmall}>{transaction.senderName}</Text>
                    </View>

                    {/* ✅ AJOUT : PAYS D'ORIGINE */}
                    <View style={styles.detailRowSmall}>
                        <Text style={styles.detailLabelSmall}>Pays d'origine</Text>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                            <Ionicons name="flag" size={14} color="#64748B" style={{marginRight:5}} />
                            <Text style={styles.detailValueSmall}>{transaction.originCountry || "Sénégal"}</Text> 
                        </View>
                    </View>

                    {/* ✅ AJOUT : NUMÉRO TRANSACTION */}
                    <View style={styles.detailRowSmall}>
                        <Text style={styles.detailLabelSmall}>Réf. Transaction</Text>
                        <Text style={[styles.detailValueSmall, {fontSize: 12, color: '#64748B'}]}>TX-{code}</Text>
                    </View>

                    {/* STATUT */}
                    <View style={styles.detailRowSmall}>
                        <Text style={styles.detailLabelSmall}>Statut</Text>
                        <View style={{backgroundColor:'#DBEAFE', paddingHorizontal:8, paddingVertical:2, borderRadius:4}}>
                            <Text style={{color:'#1E40AF', fontWeight:'bold', fontSize:12}}>{transaction.status}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.warningBox}>
                    <Ionicons name="warning" size={20} color="#B45309" style={{marginBottom:5}} />
                    <Text style={styles.warningText}>Vérifiez l'identité du client avant de remettre les fonds.</Text>
                </View>

                <Pressable 
                    style={[styles.btn, {backgroundColor: '#10B981', marginTop: 20}]} 
                    onPress={handlePayOut}
                    disabled={paying}
                >
                    {paying ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Confirmer le paiement</Text>}
                </Pressable>

                <Pressable style={{marginTop: 20, padding: 10}} onPress={() => setTransaction(null)}>
                    <Text style={{color: '#6B7280', textDecorationLine: 'underline'}}>Annuler / Retour</Text>
                </Pressable>
            </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { backgroundColor: '#064E3B', padding: 20, paddingTop: Platform.OS==='android'?40:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },

    centerBox: { alignItems: 'center', width: '100%' },
    label: { fontSize: 16, color: '#475569', marginBottom: 20, fontWeight: '500' },

    codeInput: { 
        fontSize: 28, fontWeight: 'bold', 
        borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#FFF',
        width: '100%', textAlign: 'center', padding: 15, marginBottom: 30, color: '#1F2937' 
    },

    resultBox: { alignItems: 'center', width: '100%' },
    successIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: "#10B981", shadowOpacity: 0.4, elevation: 5 },
    resultTitle: { fontSize: 24, fontWeight: '800', color: '#065F46', marginBottom: 20 },

    card: { backgroundColor: '#FFF', width: '100%', borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, elevation: 2 },

    detailLabel: { fontSize: 14, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

    detailRow: { alignItems: 'center', marginBottom: 15 },
    amountValue: { fontSize: 32, fontWeight: '900', color: '#1F2937' },

    divider: { height: 1, backgroundColor: '#F1F5F9', width: '100%', marginVertical: 15 },

    detailRowSmall: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, // Espace augmenté
    detailLabelSmall: { fontSize: 14, color: '#64748B' },
    detailValueSmall: { fontSize: 16, fontWeight: '600', color: '#334155' },

    warningBox: { backgroundColor: '#FFFBEB', padding: 15, borderRadius: 10, marginTop: 20, width: '100%', borderWidth: 1, borderColor: '#FCD34D', alignItems: 'center' },
    warningText: { color: '#B45309', fontWeight: '600', textAlign: 'center', fontSize: 13 },

    btn: { backgroundColor: '#064E3B', padding: 18, borderRadius: 14, alignItems: 'center', width: '100%', shadowColor: "#000", shadowOpacity: 0.1, elevation: 4 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' }
});