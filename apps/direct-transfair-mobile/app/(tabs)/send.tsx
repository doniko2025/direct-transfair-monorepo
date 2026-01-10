//apps/direct-transfair-mobile/app/(tabs)/send.tsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api"; 
import { useAuth } from "../../providers/AuthProvider"; 
import { colors } from "../../theme/colors"; 
import type { Beneficiary, ExchangeRate } from "../../services/types";

const getCurrencyForCountry = (countryName: string) => {
    const normalized = countryName?.toLowerCase() || "";
    if (normalized.includes("guinée") || normalized.includes("guinee")) {
        return { code: "GNF", flag: "🇬🇳", name: "Franc Guinéen" };
    }
    if (normalized.includes("maroc")) {
        return { code: "MAD", flag: "🇲🇦", name: "Dirham" };
    }
    return { code: "XOF", flag: "🇸🇳", name: "Franc CFA" };
};

export default function SendMoneyScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [allRates, setAllRates] = useState<ExchangeRate[]>([]);
  
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
  
  const [targetCurrency, setTargetCurrency] = useState("XOF");
  const [targetFlag, setTargetFlag] = useState("🇸🇳");
  const [rate, setRate] = useState<number>(655.95); 

  const [amount, setAmount] = useState("0"); 
  const [sending, setSending] = useState(false);

  // ✅ NOUVEAU : État pour masquer/afficher le solde
  const [showBalance, setShowBalance] = useState(true);

  useFocusEffect(
    useCallback(() => {
        const init = async () => {
            try {
                if (refreshUser) await refreshUser();
                const rates = await api.getExchangeRates();
                setAllRates(rates);

                const hasGNF = rates.find(r => r.pair === 'EUR_GNF');
                if (!hasGNF) {
                    rates.push({ pair: 'EUR_GNF', rate: 9250.00 }); 
                    rates.push({ pair: 'EUR_MAD', rate: 10.80 });   
                }

                const list = await api.getBeneficiaries();
                setBeneficiaries(list);
                
                if (list.length > 0 && !selectedBeneficiaryId) {
                    setSelectedBeneficiaryId(list[0].id);
                } else if (list.length > 0 && selectedBeneficiaryId) {
                    updateCurrencyContext(selectedBeneficiaryId, list, rates);
                }
            } catch (e) {
                console.log("Erreur chargement données", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [])
  );

  useEffect(() => {
    if (selectedBeneficiaryId && beneficiaries.length > 0) {
        updateCurrencyContext(selectedBeneficiaryId, beneficiaries, allRates);
    }
  }, [selectedBeneficiaryId, beneficiaries, allRates]);

  const updateCurrencyContext = (benId: string, benList: Beneficiary[], ratesList: ExchangeRate[]) => {
      const beneficiary = benList.find(b => b.id === benId);
      if (!beneficiary) return;

      const currencyInfo = getCurrencyForCountry(beneficiary.country);
      setTargetCurrency(currencyInfo.code);
      setTargetFlag(currencyInfo.flag);

      const pairKey = `EUR_${currencyInfo.code}`; 
      const foundRate = ratesList.find(r => r.pair === pairKey);

      if (foundRate) {
          setRate(foundRate.rate);
      } else {
          setRate(currencyInfo.code === 'XOF' ? 655.95 : 1);
      }
  };

  const sendAmount = parseFloat(amount) || 0;
  const receiveAmount = (sendAmount * rate).toFixed(0);
  const fees = (sendAmount * 0.015).toFixed(2);
  const totalPayRaw = sendAmount + parseFloat(fees);
  const totalPay = totalPayRaw.toFixed(2);

  const currentBalance = user?.balance ? Number(user.balance) : 0;
  const isInsufficientFunds = totalPayRaw > currentBalance;
  
  const handleAction = async () => {
    if (isInsufficientFunds) {
        router.push("/topup");
        return;
    }

    if (!selectedBeneficiaryId) {
        Alert.alert("Bénéficiaire manquant", "Veuillez sélectionner un bénéficiaire.");
        return;
    }
    if (sendAmount <= 0) {
        Alert.alert("Montant invalide", "Veuillez entrer un montant supérieur à 0.");
        return;
    }

    try {
        setSending(true);
        await api.createTransaction({
            amount: sendAmount,
            currency: 'EUR', 
            beneficiaryId: selectedBeneficiaryId,
            payoutMethod: 'MOBILE_MONEY' 
        });
        
        Alert.alert("Succès", `Transfert de ${sendAmount}€ initié vers ${targetCurrency} !`, [
            { text: "OK", onPress: () => router.push("/(tabs)/transactions") }
        ]);
        
    } catch (e: any) {
        console.error(e);
        const msg = e.response?.data?.message || "Échec de la transaction.";
        Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
        setSending(false);
    }
  };

  const isButtonDisabled = (!selectedBeneficiaryId && !isInsufficientFunds) || sending;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Envoyer de l'argent</Text>
            <View style={{width: 24}} /> 
        </View>
        
        {/* ✅ SOLDE MASQUABLE */}
        <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.balanceValue}>
                    {showBalance ? `${currentBalance.toFixed(2)} EUR` : "•••••• EUR"}
                </Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={{marginLeft: 10}}>
                    <Ionicons 
                        name={showBalance ? "eye" : "eye-off"} 
                        size={22} 
                        color="rgba(255,255,255,0.7)" 
                    />
                </TouchableOpacity>
            </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        <Text style={styles.sectionLabel}>POUR QUI ?</Text>
        {beneficiaries.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beneficiaryList}>
                {beneficiaries.map(b => (
                    <TouchableOpacity 
                        key={b.id} 
                        style={[styles.beneficiaryCard, selectedBeneficiaryId === b.id && styles.beneficiarySelected]}
                        onPress={() => setSelectedBeneficiaryId(b.id)}
                    >
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{b.fullName.charAt(0)}</Text>
                        </View>
                        <Text style={styles.beneficiaryName} numberOfLines={1}>{b.fullName}</Text>
                        {selectedBeneficiaryId === b.id && (
                            <View style={styles.checkBadge}>
                                <Ionicons name="checkmark" size={12} color="#FFF" />
                            </View>
                        )}
                        <Text style={{position:'absolute', bottom: 5, right: 5, fontSize:10}}>
                             {getCurrencyForCountry(b.country).flag}
                        </Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addBeneficiaryCard} onPress={() => router.push("/(tabs)/beneficiaries/create")}>
                    <Ionicons name="add" size={24} color={colors.primary} />
                    <Text style={styles.addText}>Nouveau</Text>
                </TouchableOpacity>
            </ScrollView>
        ) : (
            <TouchableOpacity style={styles.emptyBeneficiary} onPress={() => router.push("/(tabs)/beneficiaries/create")}>
                <Text style={{color:'#666'}}>Aucun bénéficiaire. </Text>
                <Text style={{color:colors.primary, fontWeight:'bold'}}>En créer un ?</Text>
            </TouchableOpacity>
        )}

        <View style={styles.rateCard}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <Ionicons name="trending-up" size={20} color="#3B82F6" />
                <Text style={styles.rateLabel}> Taux actuel</Text>
            </View>
            <Text style={styles.rateValue}>1 EUR = {rate} {targetCurrency}</Text>
        </View>

        <Text style={styles.sectionLabel}>COMBIEN ?</Text>
        <View style={styles.inputGroup}>
            <View style={styles.inputContainer}>
                <TextInput 
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                />
                <Text style={styles.currencyText}>EUR 🇪🇺</Text>
            </View>
        </View>

        <View style={styles.inputGroup}>
            <View style={[styles.inputContainer, {backgroundColor: '#F9FAFB'}]}>
                <TextInput 
                    style={[styles.input, {color: '#1F2937'}]}
                    value={receiveAmount}
                    editable={false} 
                />
                <Text style={styles.currencyText}>{targetCurrency} {targetFlag}</Text>
            </View>
        </View>

        <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Frais d'envoi</Text>
                <Text style={styles.summaryValue}>{fees} EUR</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
                <Text style={[styles.totalValue, isInsufficientFunds && {color: colors.danger}]}>
                    {totalPay} EUR
                </Text>
            </View>
            
            {isInsufficientFunds && (
                 <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>Solde insuffisant (Manque {(totalPayRaw - currentBalance).toFixed(2)}€)</Text>
                 </View>
            )}
        </View>

        <Pressable 
            style={({pressed}) => [
                styles.submitBtn, 
                isInsufficientFunds && { backgroundColor: '#F59E0B' }, 
                isButtonDisabled && styles.btnDisabled,
                pressed && {opacity: 0.9}
            ]} 
            onPress={handleAction}
            disabled={isButtonDisabled} 
        >
            {sending ? (
                <ActivityIndicator color="#FFF" />
            ) : (
                <>
                    <Text style={styles.submitText}>
                        {isInsufficientFunds ? "RECHARGER MON COMPTE" : "CONFIRMER L'ENVOI"}
                    </Text>
                    <Ionicons 
                        name={isInsufficientFunds ? "card" : "arrow-forward"} 
                        size={20} color="#FFF" style={{marginLeft: 10}} 
                    />
                </>
            )}
        </Pressable>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  
  header: { backgroundColor: colors.primary, paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 5, cursor: 'pointer' } as any,
  
  balanceContainer: { alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800' },

  content: { padding: 20, paddingBottom: 120 },
  
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, marginTop:10 },

  beneficiaryList: { flexDirection: 'row', marginBottom: 20 },
  beneficiaryCard: { width: 80, alignItems: 'center', marginRight: 15, padding: 10, backgroundColor:'#FFF', borderRadius:12, borderWidth:2, borderColor:'transparent', cursor: 'pointer' } as any,
  beneficiarySelected: { borderColor: colors.primary, backgroundColor:'#FFF7ED' },
  avatar: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { color: '#0369A1', fontWeight: 'bold', fontSize: 18 },
  beneficiaryName: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign:'center' },
  checkBadge: { position:'absolute', top:-5, right:-5, backgroundColor:colors.primary, borderRadius:10, width:20, height:20, justifyContent:'center', alignItems:'center' },
  
  addBeneficiaryCard: { width: 80, height: 95, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, borderStyle:'dashed', cursor: 'pointer' } as any,
  addText: { fontSize: 12, color: '#64748B', marginTop: 4 },
  emptyBeneficiary: { padding: 20, backgroundColor:'#FFF', borderRadius:12, alignItems:'center', marginBottom:20, cursor: 'pointer' } as any,

  rateCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E0F2FE', padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  rateLabel: { color: '#0369A1', fontWeight: '600' },
  rateValue: { color: '#0369A1', fontWeight: '700' },

  inputGroup: { marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 15, height: 60 },
  input: { flex: 1, fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  currencyText: { fontWeight: '700', color: '#64748B', fontSize: 16 },

  summaryCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginTop: 10, marginBottom: 25 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: '#64748B' },
  summaryValue: { color: '#1E293B', fontWeight: '600' },
  totalLabel: { color: '#1E293B', fontWeight: '800', fontSize: 16 },
  totalValue: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  
  errorContainer: { flexDirection: 'row', alignItems:'center', marginTop: 10, padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
  errorText: { color: colors.danger, fontSize: 12, marginLeft: 6, fontWeight: '600' },

  submitBtn: { backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 14, shadowColor: colors.primary, shadowOpacity: 0.3, elevation: 4, cursor: 'pointer' } as any,
  btnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, cursor: 'not-allowed' } as any,
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});