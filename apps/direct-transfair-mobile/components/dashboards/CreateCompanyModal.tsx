// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, Switch, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import {
  normalizeUpperAlnum, isEmailLike, onlyDigits,
  generateTenantCode7, generateTempPassword6
} from "./SuperAdmin.utils";

interface CreateCompanyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin: boolean;
}

export default function CreateCompanyModal({ visible, onClose, onSuccess, isSuperAdmin }: CreateCompanyModalProps) {
  const [creating, setCreating] = useState(false);
  
  // Champs société
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [activitySector, setActivitySector] = useState(""); // <-- NOUVEAU CHAMP
  const [contractType, setContractType] = useState<"RENTAL" | "PURCHASE">("RENTAL");

  // Champs gérant
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("M");
  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [birthCountry, setBirthCountry] = useState("");

  // Champs adresse
  const [addrNumber, setAddrNumber] = useState("");
  const [addrLabel, setAddrLabel] = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrCountry, setAddrCountry] = useState("");

  const resetForm = useCallback(() => {
    setCompanyName(""); setAdminEmail(""); setContractType("RENTAL");
    setActivitySector(""); // <-- RESET DU NOUVEAU CHAMP
    setManagerFirstName(""); setManagerLastName(""); setManagerPhone("");
    setGender("M"); setNationality(""); setBirthDate(""); setBirthCity(""); setBirthCountry("");
    setAddrNumber(""); setAddrLabel(""); setAddrPostalCode(""); setAddrCity(""); setAddrCountry("");
    setCompanyCode(generateTenantCode7());
    setAdminPassword(generateTempPassword6());
  }, []);

  // Reset form when opened
  useEffect(() => {
    if (visible) resetForm();
  }, [visible, resetForm]);

  const handleCreateCompany = async () => {
    if (!isSuperAdmin) {
      Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
      return;
    }
    if (creating) return;

    const name = companyName.trim();
    const code = normalizeUpperAlnum(companyCode).slice(0, 7);
    const email = adminEmail.trim().toLowerCase();
    
    if (!name || !email) return Alert.alert("Erreur", "Nom de l’entreprise et email administrateur obligatoires.");
    if (!isEmailLike(email)) return Alert.alert("Erreur", "Email administrateur invalide.");
    if (!managerFirstName.trim() || !managerLastName.trim()) return Alert.alert("Erreur", "Le prénom et le nom du gérant sont obligatoires.");
    if (!addrPostalCode.trim()) return Alert.alert("Erreur", "Adresse : code postal obligatoire.");

    setCreating(true);

    try {
      // Formatage de l'adresse en une seule chaîne de caractères
      const fullAddress = `${addrNumber.trim()} ${addrLabel.trim()}, ${addrPostalCode.trim()} ${addrCity.trim()}, ${addrCountry.trim()}`.trim();

      // Le Payload qui "matche" EXACTEMENT ton CreateClientDto
      const payload = {
        name,
        code,
        adminEmail: email,
        adminPassword,
        subscriptionType: contractType,
        activitySector: activitySector.trim() || undefined, // <-- AJOUT DANS LE PAYLOAD

        // Infos Admin (User)
        adminFirstName: managerFirstName.trim(),
        adminLastName: managerLastName.trim(),

        // Infos Contact Société
        contactEmail: email,
        contactPhone: managerPhone.trim() || undefined,

        // Infos Gérant / Owner
        ownerFirstName: managerFirstName.trim(),
        ownerLastName: managerLastName.trim(),
        ownerBirthDate: birthDate.trim() || undefined,
        ownerBirthPlace: birthCity.trim() || undefined,
        ownerCountry: nationality.trim() || undefined,

        // Adresse
        ownerAddress: fullAddress || undefined,
      };

      await api.createClient(payload);
      
      Alert.alert(
        "Société créée", 
        `✅ Société: ${name}\nCode: ${code}\nAdmin: ${email}\nMot de passe provisoire: ${adminPassword}`
      );
      
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Création impossible.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : JSON.stringify(msg));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%", height: "92%" }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Nouvelle société</Text>
                <Text style={styles.modalSubtitle}>Code 7 caractères (A-Z, 0-9) • MDP provisoire</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} disabled={creating}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 10, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
              {/* --- Section Société --- */}
              <View style={styles.formCard}>
                <Text style={styles.blockTitle}>Société</Text>
                
                <Text style={styles.label}>Nom de l’entreprise</Text>
                <TextInput value={companyName} onChangeText={setCompanyName} placeholder="Ex: Flash Transfert" style={styles.input} editable={!creating} />
                
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Code société</Text>
                    <View style={styles.readonlyWrap}><Text style={styles.readonlyText}>{companyCode}</Text></View>
                  </View>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => !creating && setCompanyCode(generateTenantCode7())}>
                    <Ionicons name="refresh-outline" size={18} color="#FFFFFF" /><Text style={styles.smallBtnText}>Regén.</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Email administrateur</Text>
                <TextInput value={adminEmail} onChangeText={setAdminEmail} placeholder="admin@societe.com" keyboardType="email-address" autoCapitalize="none" style={styles.input} editable={!creating} />

                {/* NOUVEAU CHAMP : Secteur d'activité */}
                <Text style={styles.label}>Secteur d'activité</Text>
                <TextInput value={activitySector} onChangeText={setActivitySector} placeholder="Ex: Transfert d'argent, Commerce..." style={styles.input} editable={!creating} />

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Mot de passe provisoire</Text>
                    <View style={styles.readonlyWrap}><Text style={styles.readonlyText}>{adminPassword}</Text></View>
                  </View>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => !creating && setAdminPassword(generateTempPassword6())}>
                    <Ionicons name="key-outline" size={18} color="#FFFFFF" /><Text style={styles.smallBtnText}>Nouv.</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Contrat</Text>
                    <Text style={styles.helperText}>{contractType === "RENTAL" ? "Location" : "Achat"}</Text>
                  </View>
                  <Switch value={contractType === "PURCHASE"} onValueChange={(v) => setContractType(v ? "PURCHASE" : "RENTAL")} trackColor={{ false: "#CBD5E1", true: colors.primary }} thumbColor="#FFFFFF" disabled={creating} />
                </View>
              </View>

              {/* --- Section Gérant --- */}
              <View style={styles.formCard}>
                <Text style={styles.blockTitle}>Gérant</Text>
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Prénom</Text><TextInput value={managerFirstName} onChangeText={setManagerFirstName} style={styles.input} editable={!creating} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Nom</Text><TextInput value={managerLastName} onChangeText={setManagerLastName} style={styles.input} editable={!creating} /></View>
                </View>
                <Text style={styles.label}>Téléphone</Text>
                <TextInput value={managerPhone} onChangeText={(v) => setManagerPhone(onlyDigits(v))} keyboardType="phone-pad" style={styles.input} editable={!creating} />
                
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Genre</Text>
                    <View style={styles.pillsRow}>
                      {[ { k: "M" as const, label: "H" }, { k: "F" as const, label: "F" } ].map((p) => (
                        <TouchableOpacity key={p.k} style={[styles.pill, gender === p.k && styles.pillActive]} onPress={() => setGender(p.k)} disabled={creating}>
                          <Text style={[styles.pillText, gender === p.k && styles.pillTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Nationalité</Text><TextInput value={nationality} onChangeText={setNationality} style={styles.input} editable={!creating} /></View>
                </View>

                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Date de naissance</Text><TextInput value={birthDate} onChangeText={setBirthDate} placeholder="JJ/MM/AAAA" style={styles.input} editable={!creating} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Lieu de naissance</Text><TextInput value={birthCity} onChangeText={setBirthCity} style={styles.input} editable={!creating} /></View>
                </View>
                <Text style={styles.label}>Pays de naissance</Text>
                <TextInput value={birthCountry} onChangeText={setBirthCountry} style={styles.input} editable={!creating} />
              </View>

              {/* --- Section Adresse --- */}
              <View style={styles.formCard}>
                <Text style={styles.blockTitle}>Adresse Société</Text>
                <View style={styles.grid2}>
                  <View style={{ flex: 0.42 }}><Text style={styles.label}>N°</Text><TextInput value={addrNumber} onChangeText={setAddrNumber} style={styles.input} editable={!creating} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Libellé</Text><TextInput value={addrLabel} onChangeText={setAddrLabel} style={styles.input} editable={!creating} /></View>
                </View>
                <View style={styles.grid2}>
                  <View style={{ flex: 0.55 }}><Text style={styles.label}>Code postal</Text><TextInput value={addrPostalCode} onChangeText={(v) => setAddrPostalCode(v.trim())} style={styles.input} editable={!creating} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Ville</Text><TextInput value={addrCity} onChangeText={setAddrCity} style={styles.input} editable={!creating} /></View>
                </View>
                <Text style={styles.label}>Pays</Text>
                <TextInput value={addrCountry} onChangeText={setAddrCountry} style={styles.input} editable={!creating} />
              </View>

              {/* --- Boutons d'action --- */}
              <TouchableOpacity style={[styles.primaryBtn, creating && { opacity: 0.8 }]} onPress={handleCreateCompany} disabled={creating}>
                {creating ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" /><Text style={styles.primaryBtnText}>CRÉER LA SOCIÉTÉ</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={creating}>
                <Text style={styles.secondaryBtnText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,23,0.55)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, maxHeight: "92%" },
  modalHandle: { alignSelf: "center", width: 56, height: 5, borderRadius: 999, backgroundColor: "#E2E8F0", marginBottom: 10 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  modalSubtitle: { marginTop: 2, fontSize: 12, color: "#64748B", fontWeight: "700" },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(148,163,184,0.15)" },
  formCard: { backgroundColor: "#F8FAFC", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", marginTop: 10 },
  blockTitle: { fontSize: 13, fontWeight: "900", color: "#0F172A", letterSpacing: 0.7, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "900", color: "#334155", letterSpacing: 0.7, marginBottom: 8, marginTop: 10, textTransform: "uppercase" },
  helperText: { fontSize: 13, color: "#64748B", fontWeight: "700", marginTop: 2 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A", fontWeight: "700" },
  readonlyWrap: { backgroundColor: "rgba(148,163,184,0.18)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.25)" },
  readonlyText: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  row2: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  grid2: { flexDirection: "row", gap: 10 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0F172A", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  smallBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12, letterSpacing: 0.4 },
  switchRow: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pillsRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  pill: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", borderRadius: 999, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  pillActive: { borderColor: colors.primary, backgroundColor: "rgba(245,158,11,0.12)" },
  pillText: { color: "#0F172A", fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },
  pillTextActive: { color: "#92400E" },
  primaryBtn: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1.1 },
  secondaryBtn: { marginTop: 10, backgroundColor: "rgba(148,163,184,0.18)", borderRadius: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#334155", fontWeight: "900", fontSize: 13 },
});