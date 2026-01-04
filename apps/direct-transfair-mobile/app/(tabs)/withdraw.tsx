// apps/direct-transfair-mobile/app/(tabs)/withdraw.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";

import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";
import DTTextInput from "../../components/DTTextInput";
import DTButton from "../../components/DTButton";
import type { Beneficiary } from "../../services/types";

export default function WithdrawScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState<string | undefined>();
  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState("XOF");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // ✅ CORRECTION : Route explicite pour éviter les erreurs
      router.replace("/(auth)/login");
      return;
    }
    void load();
  }, [isAuthenticated]);

  const load = async () => {
    try {
      const list = await api.getBeneficiaries();

      // 🔒 NORMALISATION ABSOLUE
      const safeList: Beneficiary[] = Array.isArray(list) ? list : [];

      setBeneficiaries(safeList);

      if (safeList.length > 0) {
        setBeneficiaryId(safeList[0].id);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger les bénéficiaires.");
    }
  };

  const submit = async () => {
    if (!beneficiaryId) {
      Alert.alert("Info", "Choisis un bénéficiaire.");
      return;
    }

    const value = Number(amount.replace(",", "."));
    if (isNaN(value) || value <= 0) {
      Alert.alert("Erreur", "Montant invalide.");
      return;
    }

    try {
      setLoading(true);

      await api.createTransaction({
        amount: value,
        currency,
        beneficiaryId,
        payoutMethod: "CASH_PICKUP",
      });

      Alert.alert(
        "Succès",
        "Demande de retrait cash créée avec succès."
      );
      
      // ✅ CORRECTION : Redirection explicite vers l'onglet transactions
      router.push("/(tabs)/transactions");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de créer le retrait.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Retrait cash</Text>

      <Text style={styles.label}>Bénéficiaire</Text>

      {beneficiaries.length === 0 ? (
        <Text style={styles.info}>
          Aucun bénéficiaire disponible.
        </Text>
      ) : (
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={beneficiaryId}
            onValueChange={(v) => setBeneficiaryId(String(v))}
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
      )}

      <DTTextInput
        label="Montant"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <DTTextInput
        label="Devise"
        value={currency}
        onChangeText={setCurrency}
      />

      <DTButton
        label={loading ? "Création…" : "Créer le retrait"}
        onPress={submit}
        disabled={loading || beneficiaries.length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 40,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  info: {
    fontSize: 13,
    color: colors.muted,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
});