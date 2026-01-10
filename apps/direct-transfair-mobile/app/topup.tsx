//apps/direct-transfair-mobile/app/topup.tsx
import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

export default function TopUpScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'CARD' | 'OM'>('CARD');

  // --- États Formulaires ---
  const [cardHolder, setCardHolder] = useState(""); 
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  
  const [mobileNumber, setMobileNumber] = useState("");

  // --- Gestion Fermeture ---
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home");
    }
  };

  const handleTopUp = async () => {
    const val = parseFloat(amount);
    
    if (!val || val < 1) return Alert.alert("Erreur", "Montant invalide");

    if (method === 'CARD') {
        if (cardHolder.trim().length < 2 || cardNumber.length < 16 || cardExpiry.length < 4 || cardCvc.length < 3) {
            return Alert.alert("Données manquantes", "Veuillez remplir correctement toutes les informations de la carte.");
        }
    } else {
        if (mobileNumber.length < 9) {
            return Alert.alert("Données manquantes", "Veuillez entrer un numéro Orange Money valide.");
        }
    }

    setLoading(true);

    // Simulation Paiement
    setTimeout(async () => {
        try {
            const currentBalance = user?.balance ? Number(user.balance) : 0;
            const newBalance = currentBalance + val;

            await api.updateProfile({ balance: newBalance } as any);
            await refreshUser(); 

            Alert.alert(
                "Paiement Réussi", 
                `Votre compte a été crédité de ${val} EUR.`, 
                [{ text: "Super", onPress: handleClose }]
            );
        } catch (e) {
            console.error(e);
            Alert.alert("Erreur", "Le rechargement a échoué.");
        } finally {
            setLoading(false);
        }
    }, 2000); 
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* ✅ FIX: HitSlop agrandit la zone tactile sans agrandir l'icône */}
        <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={20}>
            <Ionicons name="close" size={28} color="#374151" />
        </Pressable>
        <Text style={styles.title}>Recharger mon compte</Text>
        <View style={{width: 28}} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
            
            {/* Montant */}
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

            {/* Méthode */}
            <Text style={styles.label}>Moyen de paiement</Text>
            <View style={styles.methods}>
                <Pressable 
                    style={[styles.methodCard, method === 'CARD' && styles.methodSelected]} 
                    onPress={() => setMethod('CARD')}
                >
                    <Ionicons name="card" size={28} color={method === 'CARD' ? colors.primary : '#9CA3AF'} />
                    <Text style={[styles.methodText, method === 'CARD' && styles.methodTextSelected]}>Carte Bancaire</Text>
                    {method === 'CARD' && <View style={styles.check}><Ionicons name="checkmark" size={12} color="#FFF"/></View>}
                </Pressable>
                
                <Pressable 
                    style={[styles.methodCard, method === 'OM' && styles.methodSelected]} 
                    onPress={() => setMethod('OM')}
                >
                    <MaterialCommunityIcons name="cellphone-nfc" size={28} color={method === 'OM' ? colors.primary : '#9CA3AF'} />
                    <Text style={[styles.methodText, method === 'OM' && styles.methodTextSelected]}>Orange Money</Text>
                    {method === 'OM' && <View style={styles.check}><Ionicons name="checkmark" size={12} color="#FFF"/></View>}
                </Pressable>
            </View>

            {/* Formulaires */}
            <View style={styles.formContainer}>
                {method === 'CARD' ? (
                    <View style={styles.cardForm}>
                        <Text style={styles.subLabel}>Détails de la carte</Text>
                        
                        <View style={styles.fieldRow}>
                            <Ionicons name="person-outline" size={20} color="#6B7280" style={styles.fieldIcon} />
                            <TextInput 
                                style={styles.fieldInput} 
                                placeholder="Nom du titulaire" 
                                value={cardHolder}
                                onChangeText={setCardHolder}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.fieldRow}>
                            <Ionicons name="card-outline" size={20} color="#6B7280" style={styles.fieldIcon} />
                            <TextInput 
                                style={styles.fieldInput} 
                                placeholder="Numéro de carte (16 chiffres)" 
                                keyboardType="numeric"
                                maxLength={16}
                                value={cardNumber}
                                onChangeText={setCardNumber}
                            />
                        </View>

                        {/* ✅ FIX: Layout amélioré pour éviter le dépassement */}
                        <View style={{flexDirection:'row', gap: 10}}> 
                            <View style={[styles.fieldRow, {flex: 1}]}>
                                <TextInput 
                                    style={[styles.fieldInput, {textAlign:'center'}]} 
                                    placeholder="MM/AA" 
                                    keyboardType="numeric"
                                    maxLength={5}
                                    value={cardExpiry}
                                    onChangeText={setCardExpiry}
                                />
                            </View>
                            <View style={[styles.fieldRow, {flex: 1, paddingRight: 5}]}>
                                <TextInput 
                                    style={[styles.fieldInput, {textAlign:'center'}]} 
                                    placeholder="CVV" 
                                    keyboardType="numeric"
                                    maxLength={3}
                                    secureTextEntry
                                    value={cardCvc}
                                    onChangeText={setCardCvc}
                                />
                                <Ionicons name="help-circle-outline" size={18} color="#9CA3AF" />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.omForm}>
                        <Text style={styles.subLabel}>Numéro à débiter</Text>
                        <View style={styles.fieldRow}>
                            <View style={styles.flagIcon}><Text>🇸🇳</Text></View>
                            <Text style={styles.prefix}>+221</Text>
                            <View style={styles.dividerVertical} />
                            <TextInput 
                                style={styles.fieldInput} 
                                placeholder="77 000 00 00" 
                                keyboardType="phone-pad"
                                value={mobileNumber}
                                onChangeText={setMobileNumber}
                            />
                        </View>
                        <Text style={styles.infoText}>
                            <Ionicons name="information-circle" size={14} /> Vous recevrez un SMS pour valider le paiement.
                        </Text>
                    </View>
                )}
            </View>

            <View style={{height: 30}} /> 

            {/* Bouton Payer */}
            <Pressable 
                style={({pressed}) => [styles.btn, pressed && {opacity: 0.9}]} 
                onPress={handleTopUp} 
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FFF"/>
                ) : (
                    <Text style={styles.btnText}>
                        Payer {amount} EUR {method === 'CARD' ? 'par Carte' : 'par OM'}
                    </Text>
                )}
            </Pressable>

        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { 
        padding: 15, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent:'space-between', 
        backgroundColor:'#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
    },
    closeBtn: { 
        padding: 5, 
        cursor: 'pointer' 
    } as any,
    title: { fontSize: 18, fontWeight: '700', color:'#111' },
    
    scrollContent: { flexGrow: 1, alignItems: 'center' },
    content: { width: '100%', maxWidth: 500, padding: 25 },
    
    label: { fontSize: 14, fontWeight: '600', marginBottom: 12, color: '#374151', marginTop: 10 },
    subLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#4B5563' },
    
    inputWrap: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, 
        paddingHorizontal: 20, paddingVertical: 15, marginBottom: 25, 
        borderWidth: 1, borderColor: '#E5E7EB', shadowColor:'#000', shadowOpacity:0.02, shadowRadius:5 
    },
    input: { flex: 1, fontSize: 28, fontWeight: '800', color: '#1F2937', minWidth: 0 }, 
    currency: { fontSize: 20, fontWeight: '700', color: '#9CA3AF', marginLeft: 10 },
    
    methods: { flexDirection: 'row', gap: 15, marginBottom: 25 },
    methodCard: { 
        flex: 1, padding: 20, backgroundColor: '#FFF', borderRadius: 16, alignItems: 'center', 
        borderWidth: 2, borderColor: 'transparent', position:'relative', 
        shadowColor:'#000', shadowOpacity:0.03, shadowRadius:5, cursor: 'pointer' 
    } as any,
    methodSelected: { borderColor: colors.primary, backgroundColor: '#FFF7ED' },
    methodText: { marginTop: 12, fontWeight: '600', fontSize: 13, color:'#6B7280', textAlign: 'center' },
    methodTextSelected: { color: colors.primary, fontWeight:'700' },
    check: { position:'absolute', top:10, right:10, backgroundColor:colors.primary, width:18, height:18, borderRadius:9, justifyContent:'center', alignItems:'center' },

    // Form Styles
    formContainer: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth:1, borderColor: '#E5E7EB' },
    cardForm: { gap: 15 },
    omForm: { gap: 15 },
    
    fieldRow: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', 
        borderRadius: 10, paddingHorizontal: 15, height: 50, 
        borderWidth: 1, borderColor: '#E5E7EB',
        justifyContent: 'space-between' // Important pour bien espacer input et icones
    },
    fieldIcon: { marginRight: 10 },
    fieldInput: { flex: 1, fontSize: 16, color: '#1F2937', height: '100%' }, // flex: 1 est vital pour éviter le dépassement
    
    flagIcon: { marginRight: 8 },
    prefix: { fontWeight: '700', color: '#374151' },
    dividerVertical: { width: 1, height: 20, backgroundColor: '#D1D5DB', marginHorizontal: 10 },
    
    infoText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

    btn: { 
        backgroundColor: "#F59E0B", padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20, 
        shadowColor: "#F59E0B", shadowOpacity: 0.3, shadowOffset:{width:0, height:4}, elevation: 5, cursor: 'pointer' 
    } as any,
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' }
});