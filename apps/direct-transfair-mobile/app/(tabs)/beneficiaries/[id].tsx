// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../../../services/api";
import type { Beneficiary, CreateBeneficiaryPayload } from "../../../services/types";
import { colors } from "../../../theme/colors";

function getIdParam(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.id;
  if (typeof raw === "string") {
    const v = raw.trim();
    if (v.length > 0 && v !== "undefined") return v;
    return null;
  }
  if (Array.isArray(raw)) {
    const v = (raw[0] ?? "").trim();
    if (v.length > 0 && v !== "undefined") return v;
    return null;
  }
  return null;
}

export default function BeneficiaireDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = useMemo(() => getIdParam(params as Record<string, string | string[] | undefined>), [params]);

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Beneficiary | null>(null);

  const [editing, setEditing] = useState(false);

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ✅ Évite de rester bloqué sur /beneficiaires/undefined au refresh web
  useEffect(() => {
    if (!id) {
      router.replace("/(tabs)/beneficiaires");
    }
  }, [id, router]);

  const hydrateForm = (b: Beneficiary) => {
    setFullName(b.fullName ?? "");
    setCountry(b.country ?? "");
    setCity(b.city ?? "");
    setPhone(b.phone ?? "");
  };

  const load = useCallback(async () => {
    if (!id) return;

    try {
      const b = await api.getBeneficiary(id);
      setItem(b);
      hydrateForm(b);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger le bénéficiaire.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setEditing(false);
      void load();
      return () => {};
    }, [load])
  );

  const canSave =
    fullName.trim().length >= 2 && country.trim().length >= 2 && city.trim().length >= 2;

  const onSave = async () => {
    if (!id || !item) return;

    if (!canSave) {
      Alert.alert("Validation", "Merci de remplir au minimum nom, pays, ville.");
      return;
    }

    const payload: Partial<CreateBeneficiaryPayload> = {
      fullName: fullName.trim(),
      country: country.trim(),
      city: city.trim(),
      phone: phone.trim().length > 0 ? phone.trim() : null,
    };

    try {
      setSaving(true);
      const updated = await api.updateBeneficiary(id, payload);
      setItem(updated);
      hydrateForm(updated);
      setEditing(false);
      Alert.alert("Succès", "Bénéficiaire mis à jour.");
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de mettre à jour le bénéficiaire.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id) return;

    Alert.alert("Confirmation", "Supprimer ce bénéficiaire ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await api.deleteBeneficiary(id);
            Alert.alert("Supprimé", "Bénéficiaire supprimé.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (e) {
            console.error(e);
            Alert.alert(
              "Erreur",
              "Impossible de supprimer le bénéficiaire. S'il est lié à des transactions, la suppression peut être bloquée."
            );
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const onCancelEdit = () => {
    if (item) hydrateForm(item);
    setEditing(false);
  };

  if (!id) {
    // pendant la redirection
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.centerText}>Chargement...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Bénéficiaire introuvable.</Text>
        <Pressable style={styles.btnOutline} onPress={() => router.replace("/(tabs)/beneficiaires")}>
          <Text style={styles.btnOutlineText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Bénéficiaire</Text>

      {!editing ? (
        <View style={styles.card}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={styles.line}>
            {item.city}, {item.country}
          </Text>
          {item.phone ? <Text style={styles.line}>Téléphone: {item.phone}</Text> : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

          <Text style={styles.label}>Pays</Text>
          <TextInput style={styles.input} value={country} onChangeText={setCountry} />

          <Text style={styles.label}>Ville</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} />

          <Text style={styles.label}>Téléphone (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btnOutline, saving || deleting ? styles.btnDisabled : null]}
          onPress={() => router.back()}
          disabled={saving || deleting}
        >
          <Text style={styles.btnOutlineText}>Retour</Text>
        </Pressable>

        {!editing ? (
          <Pressable
            style={[styles.btnPrimary, saving || deleting ? styles.btnDisabled : null]}
            onPress={() => setEditing(true)}
            disabled={saving || deleting}
          >
            <Text style={styles.btnPrimaryText}>Éditer</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.btnPrimary,
              !canSave || saving || deleting ? styles.btnDisabled : null,
            ]}
            onPress={onSave}
            disabled={!canSave || saving || deleting}
          >
            {saving ? <ActivityIndicator /> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
          </Pressable>
        )}

        <Pressable
          style={[styles.btnDanger, saving || deleting ? styles.btnDisabled : null]}
          onPress={onDelete}
          disabled={saving || deleting}
        >
          {deleting ? <ActivityIndicator /> : <Text style={styles.btnDangerText}>Supprimer</Text>}
        </Pressable>
      </View>

      {editing ? (
        <Pressable
          style={[styles.cancelEdit, saving || deleting ? styles.btnDisabled : null]}
          onPress={onCancelEdit}
          disabled={saving || deleting}
        >
          <Text style={styles.cancelEditText}>Annuler les modifications</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: colors.background },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  centerText: { marginTop: 8, color: colors.muted },
  error: { color: colors.danger, fontWeight: "700", marginBottom: 12 },

  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },

  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 6 },
  line: { color: colors.muted, marginTop: 2 },

  label: { marginTop: 10, marginBottom: 6, fontWeight: "700", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.white,
  },

  actions: { marginTop: 16, gap: 10 },

  btnOutline: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  btnOutlineText: { color: colors.text, fontWeight: "700" },

  btnPrimary: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  btnPrimaryText: { color: colors.white, fontWeight: "800" },

  btnDanger: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.danger,
  },
  btnDangerText: { color: colors.white, fontWeight: "800" },

  btnDisabled: { opacity: 0.6 },

  cancelEdit: { marginTop: 12, alignItems: "center" },
  cancelEditText: { color: colors.muted, fontWeight: "700" },
});
