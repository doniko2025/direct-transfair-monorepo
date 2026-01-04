//apps/direct-transfair-mobile/app/(tabs)/beneficiaries/create.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";
// ✅ Import de notre utilitaire universel
import { showAlert } from "../../../utils/alert";

export default function BeneficiaryCreateScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("France");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    fullName.trim().length >= 2 && country.trim().length >= 2 && city.trim().length >= 2;

  const handleCreate = async () => {
    if (!canSubmit) {
      showAlert("Validation", "Merci de remplir au minimum nom, pays, ville.");
      return;
    }

    try {
      setSubmitting(true);
      await api.createBeneficiary({
        fullName: fullName.trim(),
        country: country.trim(),
        city: city.trim(),
        phone: phone.trim().length > 0 ? phone.trim() : null,
      });

      // ✅ Feedback visuel qui marche sur le Web + Redirection après clic
      showAlert("Succès", "Bénéficiaire ajouté avec succès.", () => {
        router.back();
      });

    } catch (e) {
      console.error(e);
      showAlert("Erreur", "Impossible d'ajouter le bénéficiaire.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ajouter un bénéficiaire</Text>
      <Text style={styles.subtitle}>
        Renseignez les informations du bénéficiaire.
      </Text>

      <Text style={styles.label}>Nom complet</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Mamadou Diallo"
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={styles.label}>Pays</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Sénégal"
        value={country}
        onChangeText={setCountry}
      />

      <Text style={styles.label}>Ville</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Dakar"
        value={city}
        onChangeText={setCity}
      />

      <Text style={styles.label}>Téléphone (optionnel)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: +221 77 000 00 00"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()} disabled={submitting}>
          <Text style={styles.cancelText}>Annuler</Text>
        </Pressable>

        <Pressable
          style={[styles.submitBtn, !canSubmit || submitting ? styles.submitBtnDisabled : null]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>Créer</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 6 },
  subtitle: { color: colors.muted, marginBottom: 18 },

  label: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.white,
  },

  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  cancelText: { color: colors.text, fontWeight: "700" },

  submitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontWeight: "800" },
});