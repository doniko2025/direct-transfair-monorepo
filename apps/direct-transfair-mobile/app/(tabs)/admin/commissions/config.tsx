//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, SafeAreaView, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

const SCENARIOS = [
    { label: "Filiale -> Filiale", source: "SUBSIDIARY", dest: "SUBSIDIARY" },
    { label: "Filiale -> Partenaire", source: "SUBSIDIARY", dest: "PARTNER" },
    { label: "Partenaire -> Filiale", source: "PARTNER", dest: "SUBSIDIARY" },
    { label: "Partenaire -> Partenaire", source: "PARTNER", dest: "PARTNER" },
    { label: "Wallet (Client) -> Filiale", source: "WALLET", dest: "SUBSIDIARY" },
    { label: "Wallet (Client) -> Partenaire", source: "WALLET", dest: "PARTNER" },
];

export default function CommissionConfigScreen() {
  const router = useRouter();
  
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [senderPart, setSenderPart] = useState("0");
  const [payerPart, setPayerPart] = useState("0");
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
      try {
          const data = await api.getCommissionRules();
          setRules(data);
          updateInputs(data, selectedScenario);
      } catch (e) {
          console.error("Erreur chargement règles:", e);
      }
  };

  const updateInputs = (currentRules: any[], scenario: any) => {
      const rule = currentRules.find((r: any) => r.sourceType === scenario.source && r.destType === scenario.dest);
      if (rule) {
          setSenderPart(rule.senderShare.toString());
          setPayerPart(rule.payerShare.toString());
      } else {
          // Valeurs par défaut si aucune règle n'existe encore
          if (scenario.source === 'SUBSIDIARY' && scenario.dest === 'SUBSIDIARY') {
              setSenderPart("0"); // Par défaut tout à la société
              setPayerPart("0");
          } else {
              setSenderPart("0");
              setPayerPart("0");
          }
      }
  };

  const handleScenarioChange = (scenario: any) => {
      setSelectedScenario(scenario);
      updateInputs(rules, scenario);
  };

  const senderVal = parseFloat(senderPart) || 0;
  const payerVal = parseFloat(payerPart) || 0;
  const platformPart = 100 - senderVal - payerVal;

  const handleSave = async () => {
    console.log("Tentative de sauvegarde...", { senderVal, payerVal, platformPart });

    if (platformPart < 0) {
        if (Platform.OS === 'web') alert("Erreur: Le total dépasse 100%");
        else Alert.alert("Erreur", "Le total ne peut pas dépasser 100%");
        return;
    }
    
    if (selectedScenario.source === 'WALLET' && senderVal > 0) {
        const msg = "Le Client Wallet ne prend pas de commission.";
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert("Erreur", msg);
        return;
    }

    setLoading(true);
    try {
        await api.saveCommissionRule({
            sourceType: selectedScenario.source,
            destType: selectedScenario.dest,
            senderShare: senderVal,
            payerShare: payerVal
        });
        
        const msg = "Configuration sauvegardée !";
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert("Succès", msg);
        
        loadRules(); // Recharger pour être sûr
    } catch (e: any) {
        console.error("Erreur API:", e);
        const err = e.response?.data?.message || "Erreur technique";
        if (Platform.OS === 'web') alert(`Erreur: ${err}`);
        else Alert.alert("Erreur", err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Répartition des Commissions</Text>
        <View style={{width: 24}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* SÉLECTEUR DE SCÉNARIO */}
        <Text style={styles.label}>Choisir le Cas de Figure :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
            {SCENARIOS.map((sc, index) => (
                <Pressable 
                    key={index} 
                    style={[styles.chip, selectedScenario === sc && styles.chipActive]}
                    onPress={() => handleScenarioChange(sc)}
                >
                    <Text style={[styles.chipText, selectedScenario === sc && {color:'#FFF'}]}>{sc.label}</Text>
                </Pressable>
            ))}
        </ScrollView>

        <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#F59E0B" />
            <Text style={styles.infoText}>
                Configuration : <Text style={{fontWeight:'bold'}}>{selectedScenario.label}</Text>
            </Text>
        </View>

        {/* INPUTS */}
        {selectedScenario.source !== 'WALLET' && (
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>1. Agence Expéditrice (Envoi)</Text>
                <View style={styles.inputRow}>
                    <TextInput 
                        style={styles.input} 
                        value={senderPart} 
                        onChangeText={setSenderPart} 
                        keyboardType="numeric"
                        placeholder="0"
                    />
                    <Text style={styles.percent}>%</Text>
                </View>
                <Text style={styles.hint}>Part du partenaire qui envoie.</Text>
            </View>
        )}

        <View style={styles.card}>
            <Text style={styles.sectionTitle}>2. Agence Payeuse (Retrait)</Text>
            <View style={styles.inputRow}>
                <TextInput 
                    style={styles.input} 
                    value={payerPart} 
                    onChangeText={setPayerPart} 
                    keyboardType="numeric"
                    placeholder="0"
                />
                <Text style={styles.percent}>%</Text>
            </View>
            <Text style={styles.hint}>Part du partenaire qui paie.</Text>
        </View>

        {/* RÉSULTAT */}
        <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Reste pour la Société</Text>
            <Text style={[styles.resultValue, platformPart < 0 && {color: '#EF4444'}]}>
                {platformPart.toFixed(0)}%
            </Text>
            <Text style={styles.hintLight}>
                {selectedScenario.source === 'SUBSIDIARY' && selectedScenario.dest === 'SUBSIDIARY' 
                    ? "Pour Filiale -> Filiale, ce reste est purement comptable car tout revient à la société."
                    : "Marge technique incluse."}
            </Text>
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.saveText}>Enregistrer la configuration</Text>}
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { backgroundColor: '#1E293B', padding: 20, paddingTop: 40, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },
    content: { padding: 20 },

    label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
    chip: { backgroundColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontWeight: '600', color: '#374151' },

    infoBox: { flexDirection:'row', backgroundColor:'#FEF3C7', padding:15, borderRadius:12, marginBottom:20, alignItems:'center' },
    infoText: { marginLeft:10, color:'#92400E', flex:1, fontSize:13 },

    card: { backgroundColor:'#FFF', padding:20, borderRadius:16, marginBottom:15, shadowColor:"#000", shadowOpacity:0.05, elevation:1 },
    sectionTitle: { fontSize:16, fontWeight:'700', color:'#1F2937', marginBottom:10 },
    inputRow: { flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#E5E7EB', paddingBottom:5 },
    input: { flex:1, fontSize:24, fontWeight:'bold', color:'#3B82F6' },
    percent: { fontSize:24, fontWeight:'bold', color:'#9CA3AF' },
    hint: { fontSize:12, color:'#6B7280', marginTop:8 },

    resultCard: { backgroundColor:'#1E293B', padding:20, borderRadius:16, marginBottom:25, alignItems:'center' },
    resultTitle: { color:'#94A3B8', fontSize:14, fontWeight:'600' },
    resultValue: { color:'#10B981', fontSize:42, fontWeight:'900', marginVertical:5 },
    hintLight: { color:'#64748B', fontSize:12, textAlign: 'center', fontStyle: 'italic' },

    saveBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
    saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});