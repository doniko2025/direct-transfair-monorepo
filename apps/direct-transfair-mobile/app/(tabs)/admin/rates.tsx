//apps/direct-transfair-mobile/app/(tabs)/admin/rates.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

export default function AdminRatesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Liste des paires supportées
  const PAIRS = ["EUR_XOF", "USD_XOF", "USD_EUR"];

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      const data = await api.getExchangeRates();
      const ratesMap: Record<string, string> = {};
      data.forEach((r) => {
        ratesMap[r.pair] = String(r.rate);
      });
      setRates(ratesMap);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger les taux");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (pair: string) => {
    const val = rates[pair];
    if (!val) return;

    try {
      setSaving(true);
      await api.updateExchangeRate(pair, parseFloat(val));
      Alert.alert("Succès", `Taux ${pair} mis à jour à ${val}`);
    } catch (e) {
      Alert.alert("Erreur", "Mise à jour échouée");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Gestion des Taux de Change</Text>
      <Text style={styles.subtitle}>Définissez la valeur de 1 unité de la devise de gauche.</Text>

      {PAIRS.map((pair) => {
        const [from, to] = pair.split("_");
        return (
          <View key={pair} style={styles.card}>
            <Text style={styles.pairTitle}>
              1 {from} = ? {to}
            </Text>
            
            <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={rates[pair] || ""}
                  placeholder="Ex: 655.95"
                  onChangeText={(text) => setRates({ ...rates, [pair]: text })}
                />
                <TouchableOpacity 
                    style={styles.btn} 
                    onPress={() => handleUpdate(pair)}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Mettre à jour</Text>}
                </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.background, flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: "bold", color: colors.text, marginBottom: 5 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  card: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pairTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 10, color: colors.text },
  row: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  btn: {
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
  },
  btnText: { color: "#fff", fontWeight: "bold" },
});