// apps/direct-transfair-mobile/app/(tabs)/admin/clients/edit.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";

type Params = { id?: string | string[] };

function getParamId(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export default function EditClientScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();

  const idStr = getParamId(params.id);
  const clientId = idStr ? Number(idStr) : NaN;

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // --- États du formulaire ---
  const [name, setName] = useState("");
  const [activitySector, setActivitySector] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contractType, setContractType] = useState<"RENTAL" | "PURCHASE">("RENTAL");

  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [ownerBirthPlace, setOwnerBirthPlace] = useState("");
  const [ownerCountry, setOwnerCountry] = useState("");

  const [ownerAddress, setOwnerAddress] = useState("");

  // Récupération des données existantes
  useEffect(() => {
    if (!Number.isFinite(clientId)) {
      Alert.alert("Erreur", "ID de la société invalide.");
      router.back();
      return;
    }

    const loadData = async () => {
      try {
        const data = await api.getClient(clientId);
        
        setName(data.name || "");
        setActivitySector(data.activitySector || "");
        setContactEmail(data.contactEmail || data.email || "");
        setContactPhone(data.contactPhone || data.phone || "");
        setContractType((data.subscriptionType as any) === "PURCHASE" ? "PURCHASE" : "RENTAL");
        
        setOwnerFirstName(data.ownerFirstName || "");
        setOwnerLastName(data.ownerLastName || "");
        setOwnerBirthDate(data.ownerBirthDate || "");
        setOwnerBirthPlace(data.ownerBirthPlace || "");
        setOwnerCountry(data.ownerCountry || "");
        
        setOwnerAddress(data.ownerAddress || "");
      } catch (e) {
        Alert.alert("Erreur", "Impossible de charger les données de la société.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [clientId, router]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      return Alert.alert("Erreur", "Le nom de la société est obligatoire.");
    }

    setUpdating(true);
    try {
      const payload = {
        name: name.trim(),
        activitySector: activitySector.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        subscriptionType: contractType,
        ownerFirstName: ownerFirstName.trim() || undefined,
        ownerLastName: ownerLastName.trim() || undefined,
        ownerBirthDate: ownerBirthDate.trim() || undefined,
        ownerBirthPlace: ownerBirthPlace.trim() || undefined,
        ownerCountry: ownerCountry.trim() || undefined,
        ownerAddress: ownerAddress.trim() || undefined,
      };

      // Si l'API updateClient n'est pas typée, on fait confiance au backend pour traiter les champs
      await api.updateClient(clientId, payload);
      
      if (Platform.OS === "web") {
        alert("Société mise à jour avec succès !");
      } else {
        Alert.alert("Succès", "Société mise à jour avec succès !");
      }
      
      router.back(); // Retourne sur les détails, qui se rafraîchiront automatiquement (grâce au useFocusEffect)
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Échec de la mise à jour.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : JSON.stringify(msg));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier la société</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* SECTION SOCIÉTÉ */}
          <View style={styles.formCard}>
            <Text style={styles.blockTitle}>Société</Text>
            
            <Text style={styles.label}>Nom de l’entreprise *</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} editable={!updating} />

            <Text style={styles.label}>Secteur d'activité</Text>
            <TextInput value={activitySector} onChangeText={setActivitySector} style={styles.input} editable={!updating} />

            <Text style={styles.label}>Email de contact</Text>
            <TextInput value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} editable={!updating} />

            <Text style={styles.label}>Téléphone de contact</Text>
            <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" style={styles.input} editable={!updating} />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Contrat</Text>
                <Text style={styles.helperText}>{contractType === "RENTAL" ? "Location" : "Achat"}</Text>
              </View>
              <Switch 
                value={contractType === "PURCHASE"} 
                onValueChange={(v) => setContractType(v ? "PURCHASE" : "RENTAL")} 
                trackColor={{ false: "#CBD5E1", true: colors.primary }} 
                thumbColor="#FFFFFF" 
                disabled={updating} 
              />
            </View>
          </View>

          {/* SECTION GÉRANT */}
          <View style={styles.formCard}>
            <Text style={styles.blockTitle}>Informations Gérant</Text>
            
            <View style={styles.grid2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput value={ownerFirstName} onChangeText={setOwnerFirstName} style={styles.input} editable={!updating} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nom</Text>
                <TextInput value={ownerLastName} onChangeText={setOwnerLastName} style={styles.input} editable={!updating} />
              </View>
            </View>

            <View style={styles.grid2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Date naissance</Text>
                <TextInput value={ownerBirthDate} onChangeText={setOwnerBirthDate} placeholder="JJ/MM/AAAA" style={styles.input} editable={!updating} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Lieu naissance</Text>
                <TextInput value={ownerBirthPlace} onChangeText={setOwnerBirthPlace} style={styles.input} editable={!updating} />
              </View>
            </View>

            <Text style={styles.label}>Nationalité / Pays</Text>
            <TextInput value={ownerCountry} onChangeText={setOwnerCountry} style={styles.input} editable={!updating} />
          </View>

          {/* SECTION ADRESSE */}
          <View style={styles.formCard}>
            <Text style={styles.blockTitle}>Adresse Complète</Text>
            <Text style={styles.label}>N°, Rue, Code Postal, Ville, Pays</Text>
            <TextInput 
              value={ownerAddress} 
              onChangeText={setOwnerAddress} 
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} 
              multiline 
              editable={!updating} 
            />
          </View>

          {/* ACTIONS */}
          <TouchableOpacity style={[styles.primaryBtn, updating && { opacity: 0.8 }]} onPress={handleUpdate} disabled={updating}>
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>ENREGISTRER LES MODIFICATIONS</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#FFFFFF", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerIcon: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },

  content: { padding: 18 },

  formCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  blockTitle: { fontSize: 13, fontWeight: "900", color: "#0F172A", letterSpacing: 0.7, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "900", color: "#64748B", letterSpacing: 0.7, marginBottom: 8, marginTop: 12, textTransform: "uppercase" },
  helperText: { fontSize: 13, color: "#0F172A", fontWeight: "700", marginTop: 2 },
  
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A", fontWeight: "700" },
  
  grid2: { flexDirection: "row", gap: 10 },
  switchRow: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  
  primaryBtn: { marginTop: 10, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1.1 },
});