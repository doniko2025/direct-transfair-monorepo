//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";

// ===============================
// SCÉNARIOS
// ===============================
const SCENARIOS = [
  { label: "Filiale -> Filiale", source: "SUBSIDIARY", dest: "SUBSIDIARY" },
  { label: "Filiale -> Partenaire", source: "SUBSIDIARY", dest: "PARTNER" },
  { label: "Partenaire -> Filiale", source: "PARTNER", dest: "SUBSIDIARY" },
  { label: "Partenaire -> Partenaire", source: "PARTNER", dest: "PARTNER" },
  { label: "Wallet (Client) -> Filiale", source: "WALLET", dest: "SUBSIDIARY" },
  { label: "Wallet (Client) -> Partenaire", source: "WALLET", dest: "PARTNER" },
];

type Scenario = (typeof SCENARIOS)[number];

export default function CommissionConfigScreen() {
  const router = useRouter();

  const [selectedScenario, setSelectedScenario] = useState<Scenario>(
    SCENARIOS[0],
  );
  const [senderPart, setSenderPart] = useState("0");
  const [payerPart, setPayerPart] = useState("0");
  const [loading, setLoading] = useState(false);

  // ===============================
  // FAKE RULES (temporaire)
  // ===============================
  const loadRules = () => {
    // Placeholder tant que backend pas branché
    setSenderPart("0");
    setPayerPart("0");
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleScenarioChange = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    loadRules();
  };

  const senderVal = parseFloat(senderPart) || 0;
  const payerVal = parseFloat(payerPart) || 0;
  const platformPart = 100 - senderVal - payerVal;

  // ===============================
  // SAVE
  // ===============================
  const handleSave = async () => {
    if (platformPart < 0) {
      const msg = "Le total dépasse 100%";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Erreur", msg);
      return;
    }

    if (selectedScenario.source === "WALLET" && senderVal > 0) {
      const msg = "Le Client Wallet ne prend pas de commission.";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Erreur", msg);
      return;
    }

    setLoading(true);

    try {
      // Placeholder backend
      console.log("SAVE COMMISSION:", {
        scenario: selectedScenario,
        senderVal,
        payerVal,
        platformPart,
      });

      const msg = "Configuration sauvegardée ! (local)";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Succès", msg);
    } catch {
      const err = "Erreur technique";
      Platform.OS === "web" ? alert(err) : Alert.alert("Erreur", err);
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // UI
  // ===============================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Répartition des Commissions</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Choisir le Cas de Figure :</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SCENARIOS.map((sc, index) => (
            <Pressable
              key={index}
              style={[
                styles.chip,
                selectedScenario === sc && styles.chipActive,
              ]}
              onPress={() => handleScenarioChange(sc)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedScenario === sc && { color: "#FFF" },
                ]}
              >
                {sc.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#F59E0B" />
          <Text style={styles.infoText}>
            Configuration :{" "}
            <Text style={{ fontWeight: "bold" }}>
              {selectedScenario.label}
            </Text>
          </Text>
        </View>

        {selectedScenario.source !== "WALLET" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              1. Agence Expéditrice (Envoi)
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={senderPart}
                onChangeText={setSenderPart}
                keyboardType="numeric"
              />
              <Text style={styles.percent}>%</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            2. Agence Payeuse (Retrait)
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={payerPart}
              onChangeText={setPayerPart}
              keyboardType="numeric"
            />
            <Text style={styles.percent}>%</Text>
          </View>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Reste pour la Société</Text>
          <Text
            style={[
              styles.resultValue,
              platformPart < 0 && { color: "#EF4444" },
            ]}
          >
            {platformPart.toFixed(0)}%
          </Text>
        </View>

        <Pressable
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveText}>
              Enregistrer la configuration
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ===============================
// STYLES
// ===============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    backgroundColor: "#1E293B",
    padding: 20,
    paddingTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 5 },
  content: { padding: 20 },

  label: { fontSize: 14, fontWeight: "700", marginBottom: 10 },

  chip: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },

  chipActive: { backgroundColor: colors.primary },

  chipText: { fontWeight: "600" },

  infoBox: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    padding: 15,
    borderRadius: 12,
    marginVertical: 20,
  },

  infoText: { marginLeft: 10 },

  card: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
  },

  sectionTitle: { fontSize: 16, fontWeight: "700" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },

  input: { flex: 1, fontSize: 24, fontWeight: "bold" },

  percent: { fontSize: 24, fontWeight: "bold" },

  resultCard: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 16,
    marginBottom: 25,
    alignItems: "center",
  },

  resultTitle: { color: "#94A3B8" },

  resultValue: { color: "#10B981", fontSize: 42, fontWeight: "900" },

  saveBtn: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },

  saveText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
