// apps/direct-transfair-mobile/app/(tabs)/send.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Button,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { api } from "../../services/api";
import type { Beneficiary } from "../../services/types";

export default function SendMoneyScreen() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await api.getBeneficiaries();
        setBeneficiaries(list);

        if (list.length > 0) {
          setSelectedBeneficiaryId(list[0].id);
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Erreur", "Impossible de charger les bénéficiaires.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSend = async () => {
    if (!selectedBeneficiaryId || !amount) {
      Alert.alert(
        "Validation",
        "Merci de choisir un bénéficiaire et un montant."
      );
      return;
    }

    const numericAmount = Number(amount.replace(",", "."));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Validation", "Montant invalide.");
      return;
    }

    try {
      setSending(true);
      await api.createTransaction({
        beneficiaryId: selectedBeneficiaryId,
        amount: numericAmount,
        currency,
        payoutMethod: "CASH_PICKUP",
      });
      setAmount("");
      Alert.alert("Succès", "Transaction créée.");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de créer la transaction.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Chargement des bénéficiaires...</Text>
      </View>
    );
  }

  if (beneficiaries.length === 0) {
    return (
      <View style={styles.center}>
        <Text>Aucun bénéficiaire. Ajoutez-en d'abord.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Envoyer de l'argent</Text>

      <Text style={styles.label}>Bénéficiaire</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selectedBeneficiaryId}
          onValueChange={(val) => setSelectedBeneficiaryId(val)}
        >
          {beneficiaries.map((b) => (
            <Picker.Item
              key={b.id}
              label={b.fullName}
              value={b.id}
            />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Montant</Text>
      <TextInput
        style={styles.input}
        placeholder="Montant"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>Devise</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={currency}
          onValueChange={(val) => setCurrency(val)}
        >
          <Picker.Item label="EUR" value="EUR" />
          <Picker.Item label="XOF" value="XOF" />
        </Picker>
      </View>

      <Button
        title={sending ? "Envoi en cours..." : "Envoyer"}
        onPress={handleSend}
        disabled={sending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 12, marginBottom: 4 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
  },
});
