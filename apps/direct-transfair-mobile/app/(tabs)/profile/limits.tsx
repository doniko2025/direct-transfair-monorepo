//apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  SafeAreaView, StatusBar, Modal, TextInput, Alert, Platform 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";

export default function LimitsScreen() {
  const router = useRouter();

  // Données simulées (Plafonds actuels)
  const [dailyLimit, setDailyLimit] = useState({ used: 150, max: 2000 });
  const [monthlyLimit, setMonthlyLimit] = useState({ used: 450, max: 10000 });

  // État Modale
  const [showModal, setShowModal] = useState(false);
  const [requestType, setRequestType] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [requestedAmount, setRequestedAmount] = useState("");

  const handleSubmitRequest = () => {
    const val = parseInt(requestedAmount);
    if (!val || val <= (requestType === 'DAILY' ? dailyLimit.max : monthlyLimit.max)) {
        return Alert.alert("Erreur", "Le montant demandé doit être supérieur à votre plafond actuel.");
    }

    // Simulation d'envoi
    setShowModal(false);
    setRequestedAmount("");
    
    Alert.alert(
        "Demande envoyée", 
        "Votre demande d'augmentation de plafond a bien été reçue. Notre équipe va l'étudier sous 24h.",
        [{ text: "OK" }]
    );
  };

  // Calcul des pourcentages pour la barre de progression
  const getProgress = (used: number, max: number) => {
    const p = (used / max) * 100;
    return Math.min(p, 100) + '%';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes plafonds</Text>
        <View style={{width: 24}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Info Box */}
        <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#2563EB" style={{marginRight: 10}} />
            <Text style={styles.infoText}>
                Ces plafonds sont fixés pour votre sécurité et conformément à la réglementation.
            </Text>
        </View>

        {/* --- PLAFOND JOURNALIER --- */}
        <View style={styles.limitCard}>
            <View style={styles.limitHeader}>
                <Text style={styles.limitTitle}>Plafond journalier</Text>
                <View style={{flexDirection:'row', alignItems:'baseline'}}>
                    <Text style={styles.usedAmount}>{dailyLimit.used}€</Text>
                    <Text style={styles.maxAmount}> / {dailyLimit.max}€</Text>
                </View>
            </View>
            
            {/* Barre de progression */}
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: getProgress(dailyLimit.used, dailyLimit.max) as any }]} />
            </View>
            
            <Text style={styles.remainingText}>
                Reste {dailyLimit.max - dailyLimit.used}€ disponible
            </Text>
        </View>

        {/* --- PLAFOND MENSUEL --- */}
        <View style={styles.limitCard}>
            <View style={styles.limitHeader}>
                <Text style={styles.limitTitle}>Plafond mensuel</Text>
                <View style={{flexDirection:'row', alignItems:'baseline'}}>
                    <Text style={styles.usedAmount}>{monthlyLimit.used}€</Text>
                    <Text style={styles.maxAmount}> / {monthlyLimit.max}€</Text>
                </View>
            </View>
            
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: getProgress(monthlyLimit.used, monthlyLimit.max) as any, backgroundColor: '#3B82F6' }]} />
            </View>
            
            <Text style={styles.remainingText}>
                Reste {monthlyLimit.max - monthlyLimit.used}€ disponible
            </Text>
        </View>

        {/* Bouton Demande */}
        <TouchableOpacity style={styles.requestBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.requestBtnText}>Demander une augmentation de plafond</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* --- MODALE DEMANDE --- */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Augmenter mon plafond</Text>
                
                <Text style={styles.label}>Quel plafond voulez-vous augmenter ?</Text>
                <View style={styles.typeSelector}>
                    <TouchableOpacity 
                        style={[styles.typeOption, requestType === 'DAILY' && styles.typeSelected]}
                        onPress={() => setRequestType('DAILY')}
                    >
                        <Text style={[styles.typeText, requestType === 'DAILY' && styles.typeTextSelected]}>Journalier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.typeOption, requestType === 'MONTHLY' && styles.typeSelected]}
                        onPress={() => setRequestType('MONTHLY')}
                    >
                        <Text style={[styles.typeText, requestType === 'MONTHLY' && styles.typeTextSelected]}>Mensuel</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>Nouveau montant souhaité (EUR)</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="Ex: 5000" 
                    keyboardType="numeric"
                    value={requestedAmount}
                    onChangeText={setRequestedAmount}
                />

                <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitRequest}>
                    <Text style={styles.confirmText}>Envoyer la demande</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setShowModal(false)} style={{marginTop:15}}>
                    <Text style={{color:'#6B7280', textAlign:'center'}}>Annuler</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { backgroundColor: colors.primary, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 5 },

  container: { flexGrow: 1, backgroundColor: "#F9FAFB", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  
  infoBox: { flexDirection: 'row', backgroundColor: '#DBEAFE', padding: 15, borderRadius: 12, marginBottom: 25, alignItems:'center' },
  infoText: { flex: 1, color: '#1E40AF', fontSize: 13, lineHeight: 18 },

  limitCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 15, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  limitTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  usedAmount: { fontSize: 18, fontWeight: '800', color: '#111827' },
  maxAmount: { fontSize: 14, color: '#9CA3AF' },

  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, width: '100%', marginBottom: 8 },
  progressBarFill: { height: 8, backgroundColor: '#10B981', borderRadius: 4 }, // Vert par défaut
  
  remainingText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

  requestBtn: { marginTop: 20, padding: 15, alignItems: 'center' },
  requestBtnText: { color: "#F59E0B", fontWeight: '700', fontSize: 15 },

  // Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 20 },
  
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 10 },
  
  typeSelector: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 15 },
  typeOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  typeSelected: { backgroundColor: '#FFF', shadowColor: "#000", shadowOpacity: 0.05, elevation: 1 },
  typeText: { fontWeight: '600', color: '#6B7280' },
  typeTextSelected: { color: colors.primary },

  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  confirmBtn: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});