// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, Switch, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import {
  normalizeUpperAlnum, isEmailLike, onlyDigits,
  generateTenantCode7, generateTempPassword6
} from "./SuperAdmin.utils";

// ─── THÈMES & TYPOGRAPHIES ──────────────────────────────────────────────
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2", text: "#450A0A" },
};

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

interface CreateCompanyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin: boolean;
}

export default function CreateCompanyModal({ visible, onClose, onSuccess, isSuperAdmin }: CreateCompanyModalProps) {
  const theme = THEMES.SUPER_ADMIN;
  const [creating, setCreating] = useState(false);
  
  // Champs société
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [activitySector, setActivitySector] = useState("");
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
    setActivitySector(""); 
    setManagerFirstName(""); setManagerLastName(""); setManagerPhone("");
    setGender("M"); setNationality(""); setBirthDate(""); setBirthCity(""); setBirthCountry("");
    setAddrNumber(""); setAddrLabel(""); setAddrPostalCode(""); setAddrCity(""); setAddrCountry("");
    setCompanyCode(generateTenantCode7());
    setAdminPassword(generateTempPassword6());
  }, []);

  useEffect(() => {
    if (visible) resetForm();
  }, [visible, resetForm]);

  // ✅ Utilitaire d'Alerte universelle (Web + Mobile)
  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      setTimeout(() => {
        window.alert(`${title}\n\n${message}`);
        if (onOk) onOk();
      }, 100);
    } else {
      Alert.alert(title, message, [{ text: "OK", onPress: onOk }]);
    }
  };

  const handleCreateCompany = async () => {
    if (!isSuperAdmin) {
      showAlert("Accès refusé", "Seul le Super Admin peut créer une société.");
      return;
    }
    if (creating) return;

    const name = companyName.trim();
    const code = normalizeUpperAlnum(companyCode).slice(0, 7);
    const email = adminEmail.trim().toLowerCase();
    
    if (!name || !email) return showAlert("Erreur", "Nom de l’entreprise et email administrateur obligatoires.");
    if (!isEmailLike(email)) return showAlert("Erreur", "Email administrateur invalide.");
    if (!managerFirstName.trim() || !managerLastName.trim()) return showAlert("Erreur", "Le prénom et le nom du gérant sont obligatoires.");
    if (!addrPostalCode.trim()) return showAlert("Erreur", "Adresse : code postal obligatoire.");

    setCreating(true);

    try {
      const fullAddress = `${addrNumber.trim()} ${addrLabel.trim()}, ${addrPostalCode.trim()} ${addrCity.trim()}, ${addrCountry.trim()}`.trim();

      const payload = {
        name,
        code,
        adminEmail: email,
        adminPassword,
        subscriptionType: contractType,
        activitySector: activitySector.trim() || undefined,

        adminFirstName: managerFirstName.trim(),
        adminLastName: managerLastName.trim(),

        contactEmail: email,
        contactPhone: managerPhone.trim() || undefined,

        ownerFirstName: managerFirstName.trim(),
        ownerLastName: managerLastName.trim(),
        ownerBirthDate: birthDate.trim() || undefined,
        ownerBirthPlace: birthCity.trim() || undefined,
        ownerCountry: nationality.trim() || undefined,

        ownerAddress: fullAddress || undefined,
      };

      await api.createClient(payload);
      
      showAlert(
        "Société créée 🎉", 
        `Société: ${name}\nCode: ${code}\nAdmin: ${email}\nMot de passe provisoire: ${adminPassword}`,
        () => {
          onSuccess();
          onClose();
        }
      );
      
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Création impossible.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : JSON.stringify(msg));
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
                <Text style={styles.blockTitle}>SOCIÉTÉ</Text>
                
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
                  <Switch value={contractType === "PURCHASE"} onValueChange={(v) => setContractType(v ? "PURCHASE" : "RENTAL")} trackColor={{ false: "#CBD5E1", true: theme.primary }} thumbColor="#FFFFFF" disabled={creating} />
                </View>
              </View>

              {/* --- Section Gérant --- */}
              <View style={styles.formCard}>
                <Text style={styles.blockTitle}>GÉRANT</Text>
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
                        <TouchableOpacity key={p.k} style={[styles.pill, gender === p.k && { borderColor: theme.primary, backgroundColor: theme.light }]} onPress={() => setGender(p.k)} disabled={creating}>
                          <Text style={[styles.pillText, gender === p.k && { color: theme.primary }]}>{p.label}</Text>
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
                <Text style={styles.blockTitle}>ADRESSE SOCIÉTÉ</Text>
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
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }, creating && { opacity: 0.8 }]} onPress={handleCreateCompany} disabled={creating}>
                {creating ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle" size={22} color="#FFFFFF" /><Text style={styles.primaryBtnText}>CRÉER LA SOCIÉTÉ</Text></>}
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%", shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalHandle: { alignSelf: "center", width: 50, height: 6, borderRadius: 3, backgroundColor: "#E2E8F0", marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 16 },
  modalTitle: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: "700", color: "#0F172A" },
  modalSubtitle: { marginTop: 4, fontSize: 13, fontFamily: FONTS.body, color: "#64748B", fontWeight: "600" },
  modalCloseBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "#F1F5F9" },
  
  formCard: { backgroundColor: "#F8FAFC", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
  blockTitle: { fontSize: 13, fontFamily: FONTS.body, fontWeight: "900", color: "#0F172A", letterSpacing: 1, marginBottom: 8 },
  label: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 8, marginTop: 12, textTransform: "uppercase" },
  helperText: { fontSize: 14, fontFamily: FONTS.body, color: "#0F172A", fontWeight: "700", marginTop: 4 },
  
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.body, color: "#0F172A", fontWeight: "600" },
  readonlyWrap: { backgroundColor: "#F1F5F9", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  readonlyText: { fontSize: 15, fontFamily: FONTS.body, fontWeight: "800", color: "#0F172A", letterSpacing: 1 },
  
  row2: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  grid2: { flexDirection: "row", gap: 12 },
  
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0F172A", paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14 },
  smallBtnText: { color: "#FFFFFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  
  switchRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pillsRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  pill: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  pillText: { color: "#64748B", fontFamily: FONTS.body, fontWeight: "800", fontSize: 13 },
  
  primaryBtn: { marginTop: 20, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  
  secondaryBtn: { marginTop: 12, backgroundColor: "#F1F5F9", borderRadius: 18, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: "#64748B", fontFamily: FONTS.body, fontWeight: "800", fontSize: 14 },
});