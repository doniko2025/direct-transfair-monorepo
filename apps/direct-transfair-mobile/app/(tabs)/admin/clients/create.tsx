// apps/direct-transfair-mobile/app/(tabs)/admin/clients/create.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { colors } from "../../../../theme/colors";

type ContractType = "RENTAL" | "PURCHASE";
type Gender = "MALE" | "FEMALE"; // "X" / "OTHER" retiré comme demandé

function isEmailValid(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function onlyAlphaNumUpper(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateAlphaNum(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function generateCompanyCode7(): string {
  return generateAlphaNum(7);
}

function generateTempPassword6(): string {
  return generateAlphaNum(6);
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function normalizeBirthDateFRToISO(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return "";
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export default function CreateClientScreen() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState(() => generateCompanyCode7());
  const [contractType, setContractType] = useState<ContractType>("RENTAL");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminTempPassword, setAdminTempPassword] = useState(() => generateTempPassword6());

  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerGender, setManagerGender] = useState<Gender>("MALE");
  const [managerNationality, setManagerNationality] = useState("");
  const [managerBirthDateFR, setManagerBirthDateFR] = useState("");
  const [managerBirthCity, setManagerBirthCity] = useState("");
  const [managerBirthCountry, setManagerBirthCountry] = useState("");

  const [addrNumber, setAddrNumber] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrCountry, setAddrCountry] = useState("");

  const [primaryColor, setPrimaryColor] = useState<string>(colors.primary ?? "#F59E0B");
  const [submitting, setSubmitting] = useState(false);

  const regenCode = () => setCompanyCode(generateCompanyCode7());
  const regenPassword = () => setAdminTempPassword(generateTempPassword6());

  const validate = (): { ok: true } | { ok: false; message: string } => {
    if (!companyName.trim()) return { ok: false, message: "Le nom de la société est obligatoire." };
    if (!adminEmail.trim() || !isEmailValid(adminEmail)) return { ok: false, message: "Email administrateur invalide." };
    if (!adminFirstName.trim() || !adminLastName.trim()) return { ok: false, message: "Prénom et nom de l’administrateur requis." };
    if (!managerFirstName.trim() || !managerLastName.trim()) return { ok: false, message: "Prénom et nom du gérant requis." };
    return { ok: true };
  };

  const handleCreate = async () => {
    if (submitting) return;

    const v = validate();
    if (!v.ok) {
      Alert.alert("Champs requis", v.message);
      return;
    }

    const cleanCode = onlyAlphaNumUpper(companyCode).slice(0, 7);
    const cleanPass = onlyAlphaNumUpper(adminTempPassword).slice(0, 6);
    const birthDateISO = normalizeBirthDateFRToISO(managerBirthDateFR);

    const payload = {
      name: companyName.trim(),
      code: cleanCode,
      subscriptionType: contractType,
      adminEmail: adminEmail.trim().toLowerCase(),
      adminPassword: cleanPass,
      adminFirstName: adminFirstName.trim(),
      adminLastName: adminLastName.trim(),
      primaryColor,

      manager: {
        firstName: managerFirstName.trim(),
        lastName: managerLastName.trim(),
        gender: managerGender,
        nationality: managerNationality.trim() || undefined,
        birthDate: birthDateISO || undefined,
        birthCity: managerBirthCity.trim() || undefined,
        birthCountry: managerBirthCountry.trim() || undefined,
      },

      // ✅ COMPAT: on envoie les 2 conventions (label/postalCode ET street/zip)
      companyAddress: {
        number: addrNumber.trim() || undefined,

        // ancienne convention
        street: addrStreet.trim() || undefined,
        zip: addrZip.trim() || undefined,

        // nouvelle convention (utilisée ailleurs chez toi)
        label: addrStreet.trim() || undefined,
        postalCode: addrZip.trim() || undefined,

        city: addrCity.trim() || undefined,
        country: addrCountry.trim() || undefined,
      },
    };

    try {
      setSubmitting(true);

      console.log("[CreateClient] payload =>", payload);

      await api.createClient(payload);

      Alert.alert(
        "Succès",
        `La société ${companyName} a été créée.\nCode: ${cleanCode}\nMot de passe: ${cleanPass}`,
        [{ text: "Continuer", onPress: () => router.back() }],
      );
    } catch (error: any) {
      console.error("[CreateClient] error =>", error);

      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Erreur de connexion au serveur.";

      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Nouvelle société</Text>
          <Text style={styles.headerSubtitle}>{contractType === "RENTAL" ? "Location" : "Achat"}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Société</Text>
            <Text style={styles.label}>Nom commercial</Text>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Ex: Flash Transfert" />

            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Code (7 caractères)</Text>
                <TextInput style={[styles.input, styles.readonly]} value={companyCode} editable={false} />
              </View>
              <TouchableOpacity style={styles.smallBtn} onPress={regenCode}>
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Type de contrat</Text>
              <Switch
                value={contractType === "PURCHASE"}
                onValueChange={(v) => setContractType(v ? "PURCHASE" : "RENTAL")}
                trackColor={{ false: "#CBD5E1", true: colors.primary }}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Administrateur</Text>
            <Text style={styles.label}>Email Admin</Text>
            <TextInput style={styles.input} value={adminEmail} onChangeText={setAdminEmail} keyboardType="email-address" autoCapitalize="none" />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput style={styles.input} value={adminFirstName} onChangeText={setAdminFirstName} />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nom</Text>
                <TextInput style={styles.input} value={adminLastName} onChangeText={setAdminLastName} />
              </View>
            </View>

            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Mot de passe provisoire</Text>
                <TextInput style={[styles.input, styles.readonly]} value={adminTempPassword} editable={false} />
              </View>
              <TouchableOpacity style={styles.smallBtnDark} onPress={regenPassword}>
                <Ionicons name="key" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gérant</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput style={styles.input} value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Prénom" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <TextInput style={styles.input} value={managerLastName} onChangeText={setManagerLastName} placeholder="Nom" />
              </View>
            </View>

            <Text style={styles.label}>Genre</Text>
            <View style={styles.segment}>
              {[
                { k: "MALE", label: "H" },
                { k: "FEMALE", label: "F" },
              ].map((g) => (
                <TouchableOpacity
                  key={g.k}
                  onPress={() => setManagerGender(g.k as Gender)}
                  style={[styles.segmentItem, managerGender === g.k && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, managerGender === g.k && styles.segmentTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Date de naissance</Text>
            <TextInput style={styles.input} value={managerBirthDateFR} onChangeText={setManagerBirthDateFR} placeholder="JJ/MM/AAAA" keyboardType="numeric" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adresse</Text>
            <TextInput style={styles.input} value={addrStreet} onChangeText={setAddrStreet} placeholder="Rue / Avenue" />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginTop: 10 }]} value={addrZip} onChangeText={setAddrZip} placeholder="Code Postal" />
              <View style={{ width: 10 }} />
              <TextInput style={[styles.input, { flex: 1, marginTop: 10 }]} value={addrCity} onChangeText={setAddrCity} placeholder="Ville" />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cta, submitting && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>CRÉER LA SOCIÉTÉ</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryText}>Annuler</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0F172A" },
  header: { padding: 18, flexDirection: "row", alignItems: "center", gap: 12 as any },
  headerBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  headerSubtitle: { color: "#94A3B8", fontSize: 12 },
  content: { padding: 16, backgroundColor: "#F8FAFC", borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: "100%" },
  card: { backgroundColor: "#FFF", borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: "#E2E8F0", elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A", marginBottom: 5 },
  label: { marginTop: 12, marginBottom: 6, fontSize: 11, fontWeight: "900", color: "#64748B", textTransform: "uppercase" },
  input: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E2E8F0", padding: 12, borderRadius: 12, fontSize: 15, fontWeight: "600" },
  readonly: { backgroundColor: "#F1F5F9", color: "#475569" },
  row: { flexDirection: "row", alignItems: "center" },
  rowTop: { flexDirection: "row", alignItems: "flex-end", gap: 10 as any },
  smallBtn: { height: 48, width: 48, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" },
  smallBtnDark: { height: 48, width: 48, borderRadius: 12, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15 },
  segment: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4, marginTop: 5 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  segmentItemActive: { backgroundColor: "#FFF", elevation: 2 },
  segmentText: { fontWeight: "800", color: "#64748B" },
  segmentTextActive: { color: "#0F172A" },
  footer: { marginTop: 10 },
  cta: { backgroundColor: colors.primary, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", elevation: 4 },
  ctaText: { color: "#FFF", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  secondaryBtn: { height: 50, alignItems: "center", justifyContent: "center", marginTop: 10 },
  secondaryText: { color: "#64748B", fontWeight: "700" },
});
