//apps/direct-transfair-mobile/app/(tabs)/send.tsx
import React, { useState, useCallback, useEffect } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert 
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [allRates, setAllRates] = useState<ExchangeRate[]>([]);
  
  const userCurrency = (user as any)?.currency || 'XOF'; 
  const userFlag = userCurrency === 'XOF' ? '🇸🇳' : (userCurrency === 'EUR' ? '🇪🇺' : '🏳️');

  const [targetCurrency, setTargetCurrency] = useState("XOF");
  const [targetFlag, setTargetFlag] = useState("🇸🇳");
  const [rate, setRate] = useState<number>(1); 

  const [amount, setAmount] = useState("0"); 
  const [sending, setSending] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  
  const [mode, setMode] = useState<'WALLET' | 'CASH'>('WALLET');
  const [isModeLocked, setIsModeLocked] = useState(false);

  const [walletPhone, setWalletPhone] = useState("");
  const [detectedBeneficiary, setDetectedBeneficiary] = useState<Beneficiary | null>(null);
  const [selectedCashBeneficiaryId, setSelectedCashBeneficiaryId] = useState<string | null>(null);

  useEffect(() => {
      if (params.mode) {
          const newMode = params.mode as 'WALLET' | 'CASH';
          setMode(newMode);
          setIsModeLocked(true);

          if (newMode === 'WALLET' && params.phone) {
              setWalletPhone(params.phone as string);
          }
          if (newMode === 'CASH' && params.beneficiaryId) {
              setSelectedCashBeneficiaryId(params.beneficiaryId as string);
          }
      }
  }, [params]);

  useFocusEffect(
    useCallback(() => {
        const init = async () => {
            try {
                if (refreshUser) await refreshUser();
                const rates = await api.getExchangeRates();
                setAllRates(rates);
                const list = await api.getBeneficiaries();
                setBeneficiaries(list);
            } catch (e) {
                console.log("Erreur chargement", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [])
  );

  useEffect(() => {
      if (mode === 'WALLET' && walletPhone.length >= 4) {
          const found = beneficiaries.find(b => b.phone && b.phone.includes(walletPhone));
          if (found) {
              setDetectedBeneficiary(found);
              updateCurrencyContext(found);
          } else {
              setDetectedBeneficiary(null);
          }
      } else {
          setDetectedBeneficiary(null);
      }
  }, [walletPhone, beneficiaries, mode, allRates]);

  useEffect(() => {
      if (mode === 'CASH' && selectedCashBeneficiaryId) {
          const found = beneficiaries.find(b => b.id === selectedCashBeneficiaryId);
          if (found) {
              updateCurrencyContext(found);
          }
      }
  }, [selectedCashBeneficiaryId, mode, beneficiaries, allRates]);

  const updateCurrencyContext = (beneficiary: Beneficiary) => {
      const currencyInfo = getCurrencyForCountry(beneficiary.country);
      setTargetCurrency(currencyInfo.code);
      setTargetFlag(currencyInfo.flag);
      
      let userRateToEur = 1;
      if (userCurrency !== 'EUR') {
          const r = allRates.find(r => r.pair === `EUR_${userCurrency}`);
          userRateToEur = r ? r.rate : (userCurrency === 'XOF' ? 655.95 : 1);
      }

      let targetRateToEur = 1;
      if (currencyInfo.code !== 'EUR') {
          const r = allRates.find(r => r.pair === `EUR_${currencyInfo.code}`);
          targetRateToEur = r ? r.rate : (currencyInfo.code === 'XOF' ? 655.95 : 1);
      }

      const crossRate = targetRateToEur / userRateToEur;
      setRate(crossRate);
  };

  const sendAmount = parseFloat(amount) || 0;
  const feesRate = mode === 'WALLET' ? 0 : 0.015;
  const feesRaw = sendAmount * feesRate;
  
  // ✅ CORRECTION DU FORMATAGE : Même méthode que home.tsx (toLocaleString simple)
  // Cela garantit que 3714.9 s'affiche 3 714,9
  const formatMoney = (val: number) => val.toLocaleString('fr-FR');

  const totalPayRaw = sendAmount + feesRaw;
  const fees = formatMoney(feesRaw);
  const totalPay = formatMoney(totalPayRaw);

  const currentBalance = user?.balance ? Number(user.balance) : 0;
  const isInsufficientFunds = totalPayRaw > currentBalance;
  
  const handleAction = async () => {
    if (isInsufficientFunds) {
        router.push("/topup");
        return;
    }
    if (sendAmount <= 0) {
        const msg = "Veuillez entrer un montant supérieur à 0.";
        if (Platform.OS === 'web') alert(msg); else Alert.alert("Montant invalide", msg);
        return;
    }

    setSending(true);
    try {
        const payloadCommon = {
            amount: sendAmount,
            currency: userCurrency,
        };

        if (mode === 'WALLET') {
            if (!detectedBeneficiary) {
                // ✅ FIX WEB : Alert.alert ne marche pas sur le web, il faut alert()
                const msg = "Destinataire inconnu ou numéro non trouvé.";
                if (Platform.OS === 'web') alert(msg); 
                else Alert.alert("Erreur", msg);
                
                setSending(false);
                return;
            }
            await api.createTransaction({
                ...payloadCommon,
                beneficiaryId: detectedBeneficiary.id, 
                payoutMethod: 'MOBILE_MONEY' 
            });
            
            const msg = `Transfert instantané envoyé à ${detectedBeneficiary.fullName} !`;
            if (Platform.OS === 'web') { 
                alert(msg); 
                router.push("/(tabs)/transactions"); 
            } else { 
                Alert.alert("Succès", msg, [{ text: "OK", onPress: () => router.push("/(tabs)/transactions") }]); 
            }

        } else {
            if (!selectedCashBeneficiaryId) {
                // ✅ FIX WEB ICI AUSSI
                const msg = "Veuillez sélectionner un bénéficiaire.";
                if (Platform.OS === 'web') alert(msg); 
                else Alert.alert("Erreur", msg);
                
                setSending(false);
                return;
            }
            await api.createTransaction({
                ...payloadCommon,
                beneficiaryId: selectedCashBeneficiaryId,
                payoutMethod: 'CASH_PICKUP'
            });
            
            const msg = "Code de retrait généré avec succès !";
            if (Platform.OS === 'web') { 
                alert(msg); 
                router.push("/(tabs)/transactions"); 
            } else { 
                Alert.alert("Succès", msg, [{ text: "OK", onPress: () => router.push("/(tabs)/transactions") }]); 
            }
        }
    } catch (e: any) {
        console.error(e);
        const msg = e.response?.data?.message || "Erreur transaction.";
        if (Platform.OS === 'web') alert(msg); 
        else Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
        setSending(false);
    }
  };

  if (loading) return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
                {mode === 'WALLET' ? "Vers un Wallet" : "Envoi d'argent"}
            </Text>
            <View style={{width: 24}} /> 
        </View>
        <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.balanceValue}>
                    {/* ✅ AFFICHAGE HARMONISÉ */}
                    {showBalance ? `${formatMoney(currentBalance)} ${userCurrency}` : "••••••"}
                </Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={{marginLeft: 10}}>
                    <Ionicons name={showBalance ? "eye" : "eye-off"} size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
            </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {!isModeLocked && (
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, mode === 'WALLET' && styles.activeTab]} onPress={() => setMode('WALLET')}>
                    <Text style={[styles.tabText, mode === 'WALLET' && styles.activeTabText]}>Vers un Wallet</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, mode === 'CASH' && styles.activeTab]} onPress={() => setMode('CASH')}>
                    <Text style={[styles.tabText, mode === 'CASH' && styles.activeTabText]}>Envoi d'argent</Text>
                </TouchableOpacity>
            </View>
        )}

        {mode === 'WALLET' && (
            <View style={styles.card}>
                <Text style={styles.cardLabel}>NUMÉRO DU DESTINATAIRE</Text>
                <View style={styles.phoneInputContainer}>
                    <Ionicons name="call" size={20} color="#9CA3AF" style={{marginRight:10}} />
                    <TextInput 
                        style={styles.phoneInput}
                        value={walletPhone}
                        onChangeText={setWalletPhone}
                        keyboardType="phone-pad"
                        placeholder="Ex: 770000000"
                        placeholderTextColor="#CBD5E1"
                        editable={!isModeLocked}
                    />
                </View>
                {detectedBeneficiary ? (
                    <View style={styles.detectedUser}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        <Text style={styles.detectedText}>
                            Destinataire : <Text style={{fontWeight:'bold'}}>{detectedBeneficiary.fullName}</Text>
                        </Text>
                    </View>
                ) : (
                    walletPhone.length > 3 && (
                        <TouchableOpacity onPress={() => router.push("/(tabs)/beneficiaries/create")} style={{marginTop: 10}}>
                            <Text style={styles.helperLink}>Numéro inconnu ? <Text style={{fontWeight:'bold'}}>Ajouter ce bénéficiaire</Text></Text>
                        </TouchableOpacity>
                    )
                )}
            </View>
        )}

        {mode === 'CASH' && (
            <>
                {!isModeLocked ? (
                    <>
                        <Text style={styles.sectionLabel}>POUR QUI ?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beneficiaryList}>
                            {beneficiaries.map(b => (
                                <TouchableOpacity 
                                    key={b.id} 
                                    style={[styles.beneficiaryCard, selectedCashBeneficiaryId === b.id && styles.beneficiarySelected]}
                                    onPress={() => setSelectedCashBeneficiaryId(b.id)}
                                >
                                    <View style={styles.avatar}><Text style={styles.avatarText}>{b.fullName.charAt(0)}</Text></View>
                                    <Text style={styles.beneficiaryName} numberOfLines={1}>{b.fullName}</Text>
                                    {selectedCashBeneficiaryId === b.id && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="#FFF" /></View>}
                                    <Text style={{position:'absolute', bottom: 5, right: 5, fontSize:10}}>{getCurrencyForCountry(b.country).flag}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.addBeneficiaryCard} onPress={() => router.push("/(tabs)/beneficiaries/create")}>
                                <Ionicons name="add" size={24} color={colors.primary} />
                                <Text style={styles.addText}>Nouveau</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </>
                ) : (
                    <View style={styles.card}>
                         <Text style={styles.cardLabel}>DESTINATAIRE</Text>
                         <View style={styles.detectedUser}>
                            <Ionicons name="person" size={20} color={colors.primary} />
                            <Text style={[styles.detectedText, {color: colors.text}]}>
                                 {beneficiaries.find(b => b.id === selectedCashBeneficiaryId)?.fullName || "Inconnu"}
                            </Text>
                        </View>
                    </View>
                )}
            </>
        )}

        <Text style={styles.sectionLabel}>MONTANT ({feesRate === 0 ? "SANS FRAIS" : "AVEC FRAIS"})</Text>
        <View style={styles.inputGroup}>
            <View style={styles.inputContainer}>
                <TextInput 
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                />
                <Text style={styles.currencyText}>{userCurrency} {userFlag}</Text>
            </View>
        </View>

        {targetCurrency !== userCurrency && (
            <View style={styles.rateInfo}>
                <Text style={styles.rateText}>Destinataire reçoit : {formatMoney(sendAmount * rate)} {targetCurrency} {targetFlag}</Text>
                <Text style={{fontSize:10, color:'#999'}}>Taux: 1 {userCurrency} = {rate.toFixed(4)} {targetCurrency}</Text>
            </View>
        )}

        <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Frais d'envoi</Text>
                <Text style={styles.summaryValue}>{fees} {userCurrency}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
                <Text style={[styles.totalValue, isInsufficientFunds && {color: colors.danger}]}>
                    {totalPay} {userCurrency}
                </Text>
            </View>
            {isInsufficientFunds && (
                 <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>Solde insuffisant</Text>
                 </View>
            )}
        </View>

        <Pressable 
            style={({pressed}) => [styles.submitBtn, isInsufficientFunds && { backgroundColor: '#F59E0B' }, sending && styles.btnDisabled, pressed && {opacity: 0.9}]} 
            onPress={handleAction}
            disabled={sending} 
        >
            {sending ? <ActivityIndicator color="#FFF" /> : (
                <>
                    <Text style={styles.submitText}>{isInsufficientFunds ? "RECHARGER MON COMPTE" : "CONFIRMER L'ENVOI"}</Text>
                    <Ionicons name={isInsufficientFunds ? "card" : "arrow-forward"} size={20} color="#FFF" style={{marginLeft: 10}} />
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
  backBtn: { padding: 5 },
  balanceContainer: { alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 },
  balanceValue: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 120 },
  tabs: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#E5E7EB', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#FFF', shadowColor:'#000', shadowOpacity:0.1, elevation: 2 },
  tabText: { fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: colors.primary },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, marginTop:10 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor:'#000', shadowOpacity:0.05, elevation:2 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, textTransform: 'uppercase' },
  phoneInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 15, height: 55 },
  phoneInput: { flex: 1, fontSize: 18, color: '#1E293B', fontWeight: '600' },
  detectedUser: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#BBF7D0' },
  detectedText: { marginLeft: 10, color: '#15803D', fontSize: 16 },
  helperLink: { color: colors.primary, fontSize: 14, textDecorationLine: 'underline', textAlign: 'center', paddingVertical:5 },
  inputGroup: { marginBottom: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 20, height: 70 },
  input: { flex: 1, fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  currencyText: { fontWeight: '700', color: '#64748B', fontSize: 18 },
  rateInfo: { alignItems:'flex-end', marginBottom:20, marginRight:5 },
  rateText: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  beneficiaryList: { flexDirection: 'row', marginBottom: 20 },
  beneficiaryCard: { width: 85, alignItems: 'center', marginRight: 15, padding: 10, backgroundColor:'#FFF', borderRadius:12, borderWidth:2, borderColor:'transparent' } as any,
  beneficiarySelected: { borderColor: colors.primary, backgroundColor:'#FFF7ED' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { color: '#0369A1', fontWeight: 'bold', fontSize: 20 },
  beneficiaryName: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign:'center' },
  checkBadge: { position:'absolute', top:-5, right:-5, backgroundColor:colors.primary, borderRadius:10, width:20, height:20, justifyContent:'center', alignItems:'center' },
  addBeneficiaryCard: { width: 85, height: 100, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, borderStyle:'dashed' } as any,
  addText: { fontSize: 12, color: '#64748B', marginTop: 4 },
  summaryCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginTop: 10, marginBottom: 25 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { color: '#64748B', fontSize: 14 },
  summaryValue: { color: '#1E293B', fontWeight: '600', fontSize: 14 },
  totalLabel: { color: '#1E293B', fontWeight: '800', fontSize: 16 },
  totalValue: { color: colors.primary, fontWeight: '800', fontSize: 20 },
  errorContainer: { flexDirection: 'row', alignItems:'center', marginTop: 15, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10 },
  errorText: { color: colors.danger, fontSize: 13, marginLeft: 8, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 18, borderRadius: 16, shadowColor: colors.primary, shadowOpacity: 0.3, elevation: 4 },
  btnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  submitText: { color: "#FFF", fontSize: 18, fontWeight: "800" },
});