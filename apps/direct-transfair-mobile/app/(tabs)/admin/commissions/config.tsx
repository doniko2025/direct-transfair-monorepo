//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView,
  ScrollView, ActivityIndicator, Platform, StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#1E3A8A", // Bleu Nuit pour Admin Société
  light: "#EFF6FF",
  surface: "#FFFFFF",
  bg: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444"
};

// ─── SCÉNARIOS (RÈGLES MÉTIER) ───
const SCENARIOS = [
  { id: "SUB_SUB", label: "Filiale -> Filiale", source: "SUBSIDIARY", dest: "SUBSIDIARY" },
  { id: "SUB_PART", label: "Filiale -> Partenaire", source: "SUBSIDIARY", dest: "PARTNER" },
  { id: "PART_SUB", label: "Partenaire -> Filiale", source: "PARTNER", dest: "SUBSIDIARY" },
  { id: "PART_PART", label: "Partenaire -> Partenaire", source: "PARTNER", dest: "PARTNER" },
  { id: "WALL_SUB", label: "Wallet (Client) -> Filiale", source: "WALLET", dest: "SUBSIDIARY" },
  { id: "WALL_PART", label: "Wallet (Client) -> Partenaire", source: "WALLET", dest: "PARTNER" },
];

type Scenario = (typeof SCENARIOS)[number];

export default function CommissionConfigScreen() {
  const router = useRouter();

  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [senderPart, setSenderPart] = useState("0");
  const [payerPart, setPayerPart] = useState("0");
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allRules, setAllRules] = useState<any[]>([]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const rules = await api.getCommissionRules();
      setAllRules(rules);
      applyRuleToForm(rules, selectedScenario);
    } catch (e) {
      console.log("Erreur chargement règles", e);
    } finally {
      setLoading(false);
    }
  };

  const applyRuleToForm = (rules: any[], scenario: Scenario) => {
    const existingRule = rules.find(r => r.sourceType === scenario.source && r.destinationType === scenario.dest);
    if (existingRule) {
      setSenderPart(existingRule.senderShare?.toString() || "0");
      setPayerPart(existingRule.payerShare?.toString() || "0");
    } else {
      setSenderPart("0");
      setPayerPart("0");
    }
  };

  useEffect(() => { loadRules(); }, []);

  const handleScenarioChange = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    applyRuleToForm(allRules, scenario);
  };

  const senderVal = parseFloat(senderPart) || 0;
  const payerVal = parseFloat(payerPart) || 0;
  const platformPart = 100 - senderVal - payerVal;

  const handleSave = async () => {
    if (platformPart < 0) {
      const msg = "Impossible de sauvegarder : le total des parts agences dépasse 100%.";
      return Platform.OS === "web" ? alert(msg) : Alert.alert("Erreur", msg);
    }

    if (selectedScenario.source === "WALLET" && senderVal > 0) {
      const msg = "Un client Wallet ne peut pas toucher de commission d'envoi. Mettez la part expéditeur à 0.";
      return Platform.OS === "web" ? alert(msg) : Alert.alert("Règle invalide", msg);
    }

    setSaving(true);
    try {
      const payload = {
        sourceType: selectedScenario.source,
        destinationType: selectedScenario.dest,
        senderShare: senderVal,
        payerShare: payerVal,
        platformShare: platformPart
      };

      await api.saveCommissionRule(payload);
      
      const msg = "Règle de commission sauvegardée avec succès.";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Succès", msg);
      
      await loadRules(); // Rafraîchir la liste complète
    } catch (e: any) {
      const err = e?.response?.data?.message || "Erreur technique lors de la sauvegarde.";
      Platform.OS === "web" ? alert(err) : Alert.alert("Erreur", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />
      
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Répartition des Commissions</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        
        {/* ─── SÉLECTION DU SCÉNARIO ─── */}
        <Text style={s.sectionLabel}>1. SÉLECTIONNEZ LE FLUX TRANSACTIONNEL</Text>
        <View style={s.scenarioContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {SCENARIOS.map((sc) => (
              <TouchableOpacity
                key={sc.id}
                style={[s.chip, selectedScenario.id === sc.id && s.chipActive]}
                onPress={() => handleScenarioChange(sc)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, selectedScenario.id === sc.id && s.chipTextActive]}>{sc.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={s.infoBox}>
          <Ionicons name="information-circle" size={24} color={THEME.primary} />
          <Text style={s.infoText}>
            Vous modifiez la règle de partage pour :{"\n"}
            <Text style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: "800", color: THEME.primary }}>{selectedScenario.label}</Text>
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={s.configWrapper}>
            
            {/* ─── PART EXPÉDITEUR ─── */}
            <View style={[s.card, selectedScenario.source === "WALLET" && { opacity: 0.5 }]}>
              <Text style={s.cardTitle}>Part Expéditeur (Envoi)</Text>
              <Text style={s.cardSub}>Commission reversée à l'agence initiatrice.</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={senderPart}
                  onChangeText={setSenderPart}
                  keyboardType="numeric"
                  editable={selectedScenario.source !== "WALLET"}
                  selectTextOnFocus
                />
                <Text style={s.percentLabel}>%</Text>
              </View>
              {selectedScenario.source === "WALLET" && (
                <Text style={s.warningText}>Un Wallet Client ne prend pas de commission.</Text>
              )}
            </View>

            {/* ─── PART PAYEUR ─── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Part Payeur (Retrait)</Text>
              <Text style={s.cardSub}>Commission reversée à l'agence qui remet les fonds.</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={payerPart}
                  onChangeText={setPayerPart}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <Text style={s.percentLabel}>%</Text>
              </View>
            </View>

            {/* ─── RÉSULTAT PLATEFORME ─── */}
            <View style={[s.resultCard, platformPart < 0 && s.resultCardError]}>
              <Text style={s.resultTitle}>Part de la Société (Plateforme)</Text>
              <Text style={[s.resultValue, platformPart < 0 && { color: THEME.danger }]}>
                {platformPart.toFixed(1)}%
              </Text>
              <Text style={s.resultSub}>Marge nette conservée par Direct Transf'air</Text>
            </View>

            <TouchableOpacity 
              style={[s.saveBtn, saving && { opacity: 0.8 }]} 
              onPress={handleSave} 
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Text style={s.saveText}>Sauvegarder la règle</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  header: { backgroundColor: THEME.primary, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, zIndex: 10 },
  headerTitle: { color: "#FFF", fontSize: 18, fontFamily: FONTS.heading, fontWeight: "800" },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  
  content: { padding: 20, paddingTop: 24, paddingBottom: 60 },
  
  sectionLabel: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  
  scenarioContainer: { marginBottom: 20 },
  chip: { backgroundColor: THEME.surface, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: THEME.border },
  chipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 5, elevation: 3 },
  chipText: { fontFamily: FONTS.body, fontWeight: "700", color: THEME.text, fontSize: 13 },
  chipTextActive: { color: "#FFF", fontWeight: "900" },
  
  infoBox: { flexDirection: "row", backgroundColor: THEME.light, padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: "#BFDBFE", alignItems: 'center' },
  infoText: { marginLeft: 12, fontFamily: FONTS.body, color: THEME.primary, fontSize: 13, lineHeight: 20, flex: 1 },
  
  configWrapper: { gap: 16 },
  
  card: { backgroundColor: THEME.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  cardTitle: { fontSize: 15, fontFamily: FONTS.body, fontWeight: "800", color: THEME.text },
  cardSub: { fontSize: 12, fontFamily: FONTS.body, color: THEME.muted, marginTop: 4, marginBottom: 16 },
  
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.bg, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.border },
  input: { flex: 1, fontSize: 28, fontFamily: FONTS.heading, fontWeight: "900", color: THEME.text, paddingVertical: 12 },
  percentLabel: { fontSize: 24, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted },
  warningText: { fontSize: 11, color: THEME.danger, marginTop: 8, fontStyle: 'italic' },
  
  resultCard: { backgroundColor: "#0F172A", padding: 24, borderRadius: 24, alignItems: "center", marginTop: 10, shadowColor: "#0F172A", shadowOpacity: 0.4, shadowRadius: 15, elevation: 5 },
  resultCardError: { backgroundColor: "#7F1D1D" },
  resultTitle: { color: "#94A3B8", fontSize: 13, fontFamily: FONTS.body, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  resultValue: { color: THEME.success, fontSize: 48, fontFamily: FONTS.heading, fontWeight: "900" },
  resultSub: { color: "#64748B", fontSize: 11, fontFamily: FONTS.body, marginTop: 8, fontStyle: "italic" },
  
  saveBtn: { backgroundColor: THEME.primary, flexDirection: 'row', paddingVertical: 18, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  saveText: { color: "#FFF", fontSize: 16, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 0.5 },
});