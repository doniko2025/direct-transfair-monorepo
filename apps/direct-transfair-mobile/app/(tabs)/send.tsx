// apps/direct-transfair-mobile/app/(tabs)/send.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect, useRouter } from "expo-router";

import { api } from "../../services/api";
import type { Beneficiary } from "../../services/types";
import { colors } from "../../theme/colors";
import { showAlert } from "../../utils/alert";
// ✅ Import de notre utilitaire de devise
import { getCurrencyForCountry } from "../../utils/currency";

export default function SendMoneyScreen() {
  const router = useRouter();
  
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  
  const [sending, setSending] = useState(false);

  // --- CALCULS AUTOMATIQUES ---
  const numericAmount = parseFloat(amount.replace(",", ".")) || 0;
  // 1.5% de frais
  const fees = numericAmount * 0.015; 
  const totalToPay = numericAmount + fees;

  // Charger la liste
  useFocusEffect(
    useCallback(() => {
      loadBeneficiaries();
    }, [])
  );

  const loadBeneficiaries = async () => {
    try {
      const list = await api.getBeneficiaries();
      setBeneficiaries(list);

      // Sélectionner le premier par défaut
      if (list.length > 0 && !selectedBeneficiaryId) {
        setSelectedBeneficiaryId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ EFFET : Quand on change de bénéficiaire, on met à jour la devise
  useEffect(() => {
    if (selectedBeneficiaryId && beneficiaries.length > 0) {
        const selected = beneficiaries.find(b => b.id === selectedBeneficiaryId);
        if (selected && selected.country) {
            const autoCurrency = getCurrencyForCountry(selected.country);
            setCurrency(autoCurrency);
        }
    }
  }, [selectedBeneficiaryId, beneficiaries]);

  const handleSend = async () => {
    if (!selectedBeneficiaryId) {
      showAlert("Attention", "Veuillez sélectionner un bénéficiaire.");
      return;
    }
    
    if (numericAmount <= 0) {
      showAlert("Erreur", "Le montant doit être supérieur à 0.");
      return;
    }

    try {
      setSending(true);
      
      // On envoie le montant "principal". 
      // Le backend peut recalculer les frais pour confirmation, 
      // mais ici on affiche ce que l'utilisateur va payer.
      await api.createTransaction({
        beneficiaryId: selectedBeneficiaryId,
        amount: numericAmount,
        currency: currency,
        payoutMethod: "CASH_PICKUP",
      });

      setAmount(""); 
      showAlert("Succès", `Transaction de ${numericAmount} ${currency} (+ ${fees.toFixed(2)} frais) envoyée !`, () => {
        router.push("/(tabs)/transactions");
      });

    } catch (e) {
      console.error(e);
      showAlert("Echec", "Impossible de créer la transaction.");
    } finally {
      setSending(false);
    }
  };

  const goToAddBeneficiary = () => {
    router.push("/(tabs)/beneficiaries/create");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (beneficiaries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Aucun bénéficiaire</Text>
        <Text style={styles.emptyText}>Ajoutez un bénéficiaire pour commencer.</Text>
        <TouchableOpacity style={styles.btnAdd} onPress={goToAddBeneficiary}>
            <Text style={styles.btnAddText}>Ajouter un bénéficiaire</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.headerTitle}>Envoyer de l'argent</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Bénéficiaire</Text>
        <View style={styles.pickerContainer}>
            <Picker
                selectedValue={selectedBeneficiaryId}
                onValueChange={(itemValue) => setSelectedBeneficiaryId(itemValue)}
                style={styles.picker}
            >
                {beneficiaries.map((b) => (
                    <Picker.Item key={b.id} label={`${b.fullName} (${b.country})`} value={b.id} />
                ))}
            </Picker>
        </View>
        <TouchableOpacity onPress={goToAddBeneficiary}>
            <Text style={styles.linkText}>+ Ajouter un nouveau bénéficiaire</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 20 }]}>Montant à envoyer</Text>
        <View style={styles.amountRow}>
            <TextInput
                style={styles.inputAmount}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
            />
            {/* Affichage fixe de la devise détectée */}
            <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>{currency}</Text>
            </View>
        </View>

        {/* ✅ INFO FRAIS CALCULÉS */}
        <View style={styles.infoBox}>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Montant envoyé :</Text>
                <Text style={styles.infoValue}>{numericAmount.toFixed(2)} {currency}</Text>
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Frais (1.5%) :</Text>
                <Text style={styles.infoValue}>+ {fees.toFixed(2)} {currency}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
                <Text style={styles.totalLabel}>TOTAL À PAYER :</Text>
                <Text style={styles.totalValue}>{totalToPay.toFixed(2)} {currency}</Text>
            </View>
        </View>

        <TouchableOpacity 
            style={[styles.sendButton, sending && styles.disabledButton]} 
            onPress={handleSend}
            disabled={sending}
        >
            {sending ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={styles.sendButtonText}>Confirmer l'envoi</Text>
            )}
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 10 },
  emptyText: { textAlign: "center", color: colors.muted, marginBottom: 20 },
  btnAdd: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  btnAddText: { color: "#fff", fontWeight: "bold" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.primary, marginBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8, textTransform: "uppercase" },
  pickerContainer: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 8, backgroundColor: "#fafafa" },
  picker: { height: 50, width: "100%" },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 14, marginBottom: 10 },
  amountRow: { flexDirection: "row", alignItems: "center" },
  inputAmount: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderTopLeftRadius: 8, borderBottomLeftRadius: 8, padding: 12, fontSize: 18, backgroundColor: "#fff", height: 50 },
  currencyBadge: { backgroundColor: "#eee", paddingHorizontal: 16, height: 50, justifyContent: "center", borderTopRightRadius: 8, borderBottomRightRadius: 8, borderWidth: 1, borderLeftWidth: 0, borderColor: "#ddd" },
  currencyText: { fontWeight: "bold", color: "#555" },
  
  // Styles pour la boite de calcul
  infoBox: { backgroundColor: "#f0f9ff", padding: 15, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: "#bae6fd" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  infoLabel: { color: "#0369a1", fontSize: 14 },
  infoValue: { color: "#0369a1", fontWeight: "600", fontSize: 14 },
  divider: { height: 1, backgroundColor: "#bae6fd", marginVertical: 8 },
  totalLabel: { color: "#0c4a6e", fontWeight: "800", fontSize: 16 },
  totalValue: { color: "#0c4a6e", fontWeight: "800", fontSize: 18 },

  sendButton: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 10, alignItems: "center", marginTop: 24 },
  disabledButton: { opacity: 0.7 },
  sendButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});