//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";

export default function CommissionConfigScreen() {
  const router = useRouter();
  
  // Valeurs par défaut (ex: 25% envoi, 25% retrait, 50% plateforme)
  const [senderPart, setSenderPart] = useState("25");
  const [payerPart, setPayerPart] = useState("25");

  const platformPart = 100 - (parseFloat(senderPart) || 0) - (parseFloat(payerPart) || 0);

  const handleSave = () => {
    if (platformPart < 0) return Alert.alert("Erreur", "Le total ne peut pas dépasser 100%");
    
    // Ici appel API pour sauvegarder la config globale
    Alert.alert("Succès", "Configuration des commissions mise à jour !");
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
        
        <View style={styles.infoBox}>
            <Ionicons name="pie-chart" size={24} color="#F59E0B" />
            <Text style={styles.infoText}>
                Définissez ici la part qui revient aux agences partenaires. Les agences privées reversent automatiquement leur part à la société.
            </Text>
        </View>

        <View style={styles.card}>
            <Text style={styles.sectionTitle}>1. Agence Expéditrice (Envoi)</Text>
            <View style={styles.inputRow}>
                <TextInput 
                    style={styles.input} 
                    value={senderPart} 
                    onChangeText={setSenderPart} 
                    keyboardType="numeric"
                />
                <Text style={styles.percent}>%</Text>
            </View>
            <Text style={styles.hint}>Reçu par le partenaire qui effectue l'envoi.</Text>
        </View>

        <View style={styles.card}>
            <Text style={styles.sectionTitle}>2. Agence Payeuse (Retrait)</Text>
            <View style={styles.inputRow}>
                <TextInput 
                    style={styles.input} 
                    value={payerPart} 
                    onChangeText={setPayerPart} 
                    keyboardType="numeric"
                />
                <Text style={styles.percent}>%</Text>
            </View>
            <Text style={styles.hint}>Reçu par le partenaire qui effectue le paiement.</Text>
        </View>

        {/* Résumé Graphique */}
        <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Reste pour la Société (Direct Transf'air)</Text>
            <Text style={[styles.resultValue, platformPart < 0 && {color: 'red'}]}>
                {platformPart}%
            </Text>
            <Text style={styles.hintLight}>Ce montant inclut la marge technique.</Text>
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Enregistrer la configuration</Text>
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

    infoBox: { flexDirection:'row', backgroundColor:'#FEF3C7', padding:15, borderRadius:12, marginBottom:20, alignItems:'center' },
    infoText: { marginLeft:10, color:'#92400E', flex:1, fontSize:13, lineHeight:18 },

    card: { backgroundColor:'#FFF', padding:20, borderRadius:16, marginBottom:15, shadowColor:"#000", shadowOpacity:0.05, elevation:1 },
    sectionTitle: { fontSize:16, fontWeight:'700', color:'#1F2937', marginBottom:10 },
    inputRow: { flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#E5E7EB', paddingBottom:5 },
    input: { flex:1, fontSize:24, fontWeight:'bold', color:'#3B82F6' },
    percent: { fontSize:24, fontWeight:'bold', color:'#9CA3AF' },
    hint: { fontSize:12, color:'#6B7280', marginTop:8 },

    resultCard: { backgroundColor:'#1E293B', padding:20, borderRadius:16, marginBottom:25, alignItems:'center' },
    resultTitle: { color:'#94A3B8', fontSize:14, fontWeight:'600' },
    resultValue: { color:'#10B981', fontSize:42, fontWeight:'900', marginVertical:5 },
    hintLight: { color:'#64748B', fontSize:12 },

    saveBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
    saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});