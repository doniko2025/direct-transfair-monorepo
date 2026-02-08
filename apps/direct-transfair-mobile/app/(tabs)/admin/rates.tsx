//apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, TextInput, ActivityIndicator, Alert, SafeAreaView 
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

// Liste des paires standard à surveiller
const STANDARD_PAIRS = [
    { pair: "EUR_XOF", label: "Euro -> CFA" },
    { pair: "USD_XOF", label: "Dollar -> CFA" },
    { pair: "XOF_GNF", label: "CFA -> Franc Guinéen" },
    { pair: "EUR_GNF", label: "Euro -> Franc Guinéen" },
    { pair: "USD_GNF", label: "Dollar -> Franc Guinéen" },
    { pair: "EUR_USD", label: "Euro -> Dollar" },
];

export default function AdminRatesScreen() {
  const router = useRouter();
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPair, setSelectedPair] = useState<any>(null);
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      // On récupère les taux en base
      const dbRates = await api.getExchangeRates();
      
      // On fusionne avec la liste standard pour afficher même ceux qui ne sont pas encore en base (valeur 0 ou N/A)
      const mergedList = STANDARD_PAIRS.map(std => {
          const found = dbRates.find((r: any) => r.pair === std.pair);
          return {
              ...std,
              rate: found ? found.rate : 0, // 0 signifie "Non configuré en base"
              // ✅ CORRECTION ICI : On utilise (found as any) pour accéder à updatedAt
              lastUpdate: found ? (found as any).updatedAt : null
          };
      });

      setRates(mergedList);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger les taux");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRates(); }, [loadRates]));

  const handleEdit = (item: any) => {
      setSelectedPair(item);
      setNewRate(item.rate ? String(item.rate) : "");
      setModalVisible(true);
  };

  const saveRate = async () => {
      if (!selectedPair || !newRate) return;
      const val = parseFloat(newRate);
      if (isNaN(val) || val <= 0) {
          Alert.alert("Erreur", "Veuillez entrer un taux valide");
          return;
      }

      setSaving(true);
      try {
          await api.updateExchangeRate(selectedPair.pair, val);
          setModalVisible(false);
          loadRates(); // Recharger la liste
      } catch (e) {
          Alert.alert("Erreur", "Echec de la mise à jour");
      } finally {
          setSaving(false);
      }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
        <View style={styles.info}>
            <Text style={styles.pairLabel}>{item.label}</Text>
            <Text style={styles.pairCode}>{item.pair}</Text>
        </View>
        
        <View style={styles.rateContainer}>
            <Text style={styles.rateValue}>
                {item.rate > 0 ? item.rate : "Par défaut"}
            </Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                <Ionicons name="pencil" size={18} color="#FFF" />
            </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuration des Taux</Text>
        <View style={{width: 24}} />
      </View>

      {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} />
      ) : (
          <FlatList
            data={rates}
            keyExtractor={(item) => item.pair}
            renderItem={renderItem}
            contentContainerStyle={{padding: 20}}
            ListHeaderComponent={
                <Text style={styles.notice}>
                    Définissez ici les taux de conversion pour les transferts automatiques. 
                    Si un taux est à 0, le système utilisera sa valeur par défaut.
                </Text>
            }
          />
      )}

      {/* MODAL EDIT */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Modifier le Taux</Text>
                  <Text style={styles.modalSubTitle}>{selectedPair?.label} ({selectedPair?.pair})</Text>
                  
                  <Text style={styles.inputLabel}>1 {selectedPair?.pair.split('_')[0]} vaut combien de {selectedPair?.pair.split('_')[1]} ?</Text>
                  <TextInput 
                      style={styles.input} 
                      value={newRate} 
                      onChangeText={setNewRate} 
                      keyboardType="numeric" 
                      placeholder="Ex: 655.957"
                      autoFocus
                  />

                  <TouchableOpacity style={styles.saveBtn} onPress={saveRate} disabled={saving}>
                      {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>ENREGISTRER</Text>}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                      <Text style={{color: '#666'}}>Annuler</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { backgroundColor: '#1E293B', padding: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  
  notice: { color: '#64748B', fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 },

  card: { backgroundColor: "#FFF", padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  info: { flex: 1 },
  pairLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  pairCode: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontWeight: 'bold' },
  
  rateContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateValue: { fontSize: 18, fontWeight: '800', color: '#059669' },
  editBtn: { backgroundColor: colors.primary, padding: 8, borderRadius: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 5 },
  modalSubTitle: { fontSize: 14, color: colors.primary, fontWeight: '600', marginBottom: 20 },
  inputLabel: { fontSize: 13, color: '#64748B', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: '#F3F4F6', width: '100%', padding: 15, borderRadius: 12, fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  saveBtn: { backgroundColor: colors.primary, width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  saveText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 10 }
});