//apps/direct-transfair-mobile/app/agent/send-cash.tsx
import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TextInput, Pressable, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList, TouchableOpacity 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider"; 
import { colors } from "../../theme/colors";
import { countriesList, CountryData } from "../../data/countries"; 

export default function AgentSendCashScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // --- ÉTATS ---
  const [senderFirstName, setSenderFirstName] = useState("");
  const [senderLastName, setSenderLastName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderPhoneCode, setSenderPhoneCode] = useState(countriesList[0]);

  const [receiverFirstName, setReceiverFirstName] = useState("");
  const [receiverLastName, setReceiverLastName] = useState("");
  const [receiverCountry, setReceiverCountry] = useState<CountryData>(countriesList[0]);
  const [receiverPhone, setReceiverPhone] = useState("");
  
  const [amount, setAmount] = useState("");
  const [fees, setFees] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  
  const [showSenderCodeModal, setShowSenderCodeModal] = useState(false);
  const [showReceiverCountryModal, setShowReceiverCountryModal] = useState(false);

  // --- LOGIQUE ---
  useEffect(() => {
    const val = parseFloat(amount) || 0;
    let calculatedFees = 0;

    if (val > 0) {
        if (val <= 5000) calculatedFees = 200;
        else if (val <= 10000) calculatedFees = 500;
        else if (val <= 50000) calculatedFees = 1000;
        else calculatedFees = val * 0.02; 
    }

    setFees(Math.ceil(calculatedFees));
    setTotal(val + Math.ceil(calculatedFees));
  }, [amount]);

  const handleSend = () => {
    if (!senderFirstName || !senderLastName || !senderPhone || !receiverFirstName || !receiverLastName || !receiverPhone || parseFloat(amount) <= 0) {
        return Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires.");
    }

    setLoading(true);

    const transactionData = {
        amount: parseFloat(amount),
        currency: 'FCFA',
        fees: fees,
        total: total,
        sender: {
            firstName: senderFirstName,
            lastName: senderLastName,
            phone: `${senderPhoneCode.dialCode}${senderPhone}`,
        },
        receiver: {
            firstName: receiverFirstName,
            lastName: receiverLastName,
            country: receiverCountry.name, 
            countryCode: receiverCountry.code,
            phone: `${receiverCountry.dialCode}${receiverPhone}`,
        },
        agency: {
            code: (user as any)?.client?.code || "AGC-DEFAULT",
            name: (user as any)?.client?.name || "Agence Principale",
            city: (user as any)?.client?.city || "Ville Inconnue",
            country: (user as any)?.client?.country || "Pays Inconnu",
            agentId: user?.id
        }
    };

    setTimeout(() => {
        setLoading(false);
        Alert.alert(
            "Envoi Réussi ✅",
            `Agence : ${transactionData.agency.name}\n` +
            `Code de retrait : DT-${Math.floor(100000 + Math.random() * 900000)}\n\n` +
            `Montant envoyé : ${amount} FCFA vers ${receiverCountry.name}.\n` +
            `Le bénéficiaire ${receiverFirstName} ${receiverLastName} peut retirer immédiatement.`,
            [{ text: "Imprimer Reçu", onPress: () => router.back() }]
        );
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Envoi Espèces (Guichet)</Text>
        <View style={{width: 24}} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* 1. EXPÉDITEUR */}
        <Text style={styles.sectionTitle}>1. EXPÉDITEUR (Sur place)</Text>
        <View style={styles.card}>
            {/* Prénom / Nom - Avec plus d'espace */}
            <View style={styles.rowInputs}>
                <View style={{flex:1, marginRight:12}}>
                    <Text style={styles.label}>Prénom</Text>
                    <TextInput style={styles.input} placeholder="Ex: Moussa" value={senderFirstName} onChangeText={setSenderFirstName} />
                </View>
                <View style={{flex:1}}>
                    <Text style={styles.label}>Nom</Text>
                    <TextInput style={styles.input} placeholder="Ex: Diop" value={senderLastName} onChangeText={setSenderLastName} />
                </View>
            </View>
            
            <View style={styles.spacer} />
            
            <Text style={styles.label}>Téléphone Mobile</Text>
            <View style={styles.inputRow}>
                <TouchableOpacity style={styles.dialBtn} onPress={() => setShowSenderCodeModal(true)}>
                    <Text style={{fontWeight:'bold'}}>{senderPhoneCode.dialCode}</Text>
                    <Ionicons name="chevron-down" size={12} color="#666" style={{marginLeft:4}} />
                </TouchableOpacity>
                <TextInput 
                    style={styles.inputNoBorder} 
                    placeholder="77 000 00 00" 
                    keyboardType="phone-pad" 
                    value={senderPhone} 
                    onChangeText={setSenderPhone} 
                />
            </View>
        </View>

        {/* 2. BÉNÉFICIAIRE */}
        <Text style={styles.sectionTitle}>2. BÉNÉFICIAIRE</Text>
        <View style={styles.card}>
            <TouchableOpacity style={styles.countrySelect} onPress={() => setShowReceiverCountryModal(true)}>
                <Text style={styles.label}>Pays de destination</Text>
                <View style={{flexDirection:'row', alignItems:'center', marginTop:8, backgroundColor:'#F3F4F6', padding:10, borderRadius:8}}>
                    <Text style={{fontSize:24, marginRight:10}}>{receiverCountry.flag}</Text>
                    <Text style={{fontSize:16, fontWeight:'700', flex:1, color:'#374151'}}>{receiverCountry.name}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
            </TouchableOpacity>

            <View style={styles.spacer} />

            <View style={styles.rowInputs}>
                <View style={{flex:1, marginRight:12}}>
                    <Text style={styles.label}>Prénom</Text>
                    <TextInput style={styles.input} placeholder="Ex: Fatou" value={receiverFirstName} onChangeText={setReceiverFirstName} />
                </View>
                <View style={{flex:1}}>
                    <Text style={styles.label}>Nom</Text>
                    <TextInput style={styles.input} placeholder="Ex: Ndiaye" value={receiverLastName} onChangeText={setReceiverLastName} />
                </View>
            </View>

            <View style={styles.spacer} />

            <Text style={styles.label}>Téléphone du bénéficiaire</Text>
            <View style={styles.inputRow}>
                <View style={[styles.dialBtn, {backgroundColor:'#EEE'}]}>
                    <Text style={{color:'#555', fontWeight:'bold'}}>{receiverCountry.dialCode}</Text>
                </View>
                <TextInput 
                    style={styles.inputNoBorder} 
                    placeholder="Numéro sans indicatif" 
                    keyboardType="phone-pad" 
                    value={receiverPhone} 
                    onChangeText={setReceiverPhone} 
                />
            </View>
        </View>

        {/* 3. MONTANT & FRAIS - Layout vertical corrigé */}
        <Text style={styles.sectionTitle}>3. TRANSACTION</Text>
        <View style={styles.card}>
            <View style={{paddingVertical: 5}}>
                <Text style={styles.labelBig}>Montant à envoyer</Text>
                <View style={{flexDirection:'row', alignItems:'center', marginTop: 5}}>
                    <TextInput 
                        style={styles.amountInput} 
                        placeholder="0" 
                        keyboardType="numeric" 
                        value={amount} 
                        onChangeText={setAmount} 
                    />
                    <Text style={styles.currency}>FCFA</Text>
                </View>
            </View>
        </View>

        {/* --- RÉSUMÉ --- */}
        <View style={styles.summary}>
            <View style={styles.summaryRow}>
                <Text style={styles.sumLabel}>Montant envoyé</Text>
                <Text style={styles.sumValue}>{parseFloat(amount) || 0} FCFA</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.sumLabel}>Frais d'envoi</Text>
                <Text style={styles.sumValue}>{fees} FCFA</Text>
            </View>
            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL À ENCAISSER</Text>
                <Text style={styles.totalValue}>{total} FCFA</Text>
            </View>
        </View>

        <Pressable 
            style={({pressed}) => [styles.btn, pressed && {opacity:0.9}]} 
            onPress={handleSend} 
            disabled={loading}
        >
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Valider l'envoi</Text>}
        </Pressable>

      </ScrollView>
      </KeyboardAvoidingView>

      {/* --- MODALE PAYS CENTRÉE --- */}
      <SelectionModal 
        visible={showReceiverCountryModal}
        onClose={() => setShowReceiverCountryModal(false)}
        title="Pays du bénéficiaire"
        data={countriesList}
        onSelect={(item: CountryData) => {
            setReceiverCountry(item);
            setShowReceiverCountryModal(false);
        }}
      />

      <SelectionModal 
        visible={showSenderCodeModal}
        onClose={() => setShowSenderCodeModal(false)}
        title="Indicatif téléphone"
        data={countriesList}
        onSelect={(item: CountryData) => {
            setSenderPhoneCode(item);
            setShowSenderCodeModal(false);
        }}
      />

    </SafeAreaView>
  );
}

// Composant Modale Centrée
const SelectionModal = ({ visible, onClose, title, data, onSelect }: any) => (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={20} color="#333" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={data}
                    keyExtractor={item => item.code}
                    renderItem={({item}) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => onSelect(item)}>
                            <Text style={{fontSize:24, marginRight:15}}>{item.flag}</Text>
                            <Text style={{fontSize:16, flex:1, color:'#333'}}>{item.name}</Text>
                            <Text style={{fontWeight:'bold', color:'#666'}}>{item.dialCode}</Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{paddingBottom: 20}}
                />
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { backgroundColor: '#064E3B', padding: 20, paddingTop: Platform.OS==='android'?40:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },
    content: { padding: 20, paddingBottom: 100 },
    
    sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6B7280', marginBottom: 10, marginTop: 20, letterSpacing: 0.5, textTransform:'uppercase' },
    
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E5E7EB', shadowColor:"#000", shadowOpacity:0.02, shadowRadius:5, elevation:1 },
    
    rowInputs: { flexDirection: 'row', alignItems: 'center' },
    spacer: { height: 15 },

    label: { fontSize: 12, fontWeight:'600', color:'#64748B', marginBottom:5 },
    labelBig: { fontSize: 14, fontWeight:'700', color:'#374151' },

    input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, color: '#1F2937', backgroundColor: '#F8FAFC' },
    
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal:10, backgroundColor: '#F8FAFC', height: 50 },
    inputNoBorder: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1F2937' },
    
    amountInput: { flex:1, fontSize: 32, fontWeight:'bold', color: colors.primary, paddingVertical: 5 },
    
    dialBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2E8F0', paddingVertical: 6, paddingHorizontal:10, borderRadius: 6 },
    
    countrySelect: { },
    
    currency: { fontSize: 20, fontWeight:'800', color:'#9CA3AF', marginLeft:10 },

    summary: { marginTop: 25, padding: 20, backgroundColor: '#ECFDF5', borderRadius: 16, borderWidth: 1, borderColor: '#10B981' },
    summaryRow: { flexDirection:'row', justifyContent:'space-between', marginBottom: 8 },
    sumLabel: { color: '#065F46', fontSize:14 },
    sumValue: { fontWeight:'600', color: '#065F46', fontSize:14 },
    
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#A7F3D0' },
    totalLabel: { fontWeight: '800', color: '#064E3B', fontSize: 16 },
    totalValue: { fontWeight: '900', color: '#064E3B', fontSize: 22 },

    btn: { backgroundColor: '#059669', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 30, shadowColor: "#059669", shadowOpacity: 0.3, elevation: 5 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

    // Modal Centrée
    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20 
    },
    modalContent: { 
        backgroundColor: '#FFF', 
        borderRadius: 20, 
        padding: 20, 
        width: '100%', 
        maxHeight: '60%', 
        maxWidth: 380,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
    closeBtn: { padding: 5, backgroundColor: '#F3F4F6', borderRadius: 20 },
    modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }
});