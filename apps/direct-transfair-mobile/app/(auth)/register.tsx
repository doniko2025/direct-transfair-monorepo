// apps/direct-transfair-mobile/app/(auth)/register.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

import { countriesList, CountryData } from "../../data/countries";
import { citiesByCountry } from "../../data/cities";
import { api } from "../../services/api";

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();

  // --- ÉTATS ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [residenceCountry, setResidenceCountry] = useState<CountryData | null>(
    null,
  );
  const [residenceCity, setResidenceCity] = useState("");

  const [nationality, setNationality] = useState<CountryData | null>(null);
  const [birthCountry, setBirthCountry] = useState<CountryData | null>(null);
  const [birthCity, setBirthCity] = useState("");

  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [modalType, setModalType] = useState<string | null>(null);

  useEffect(() => {
    setResidenceCity("");
  }, [residenceCountry]);

  useEffect(() => {
    setBirthCity("");
  }, [birthCountry]);

  // Helper pour les alertes Web
  const showWebAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const tenant = api.getTenant();
  const tenantLabel =
    tenant && tenant !== "DONIKO" ? tenant : "Plateforme globale";

  // --- SOUMISSION ---
  const onSubmit = async () => {
    if (!firstName || !lastName || !email || !password) {
      showWebAlert("Champs requis", "Remplissez les champs obligatoires.");
      return;
    }

    let formattedBirthDate: string | undefined = undefined;
    if (birthDay && birthMonth && birthYear) {
      formattedBirthDate = `${birthYear}-${birthMonth.padStart(
        2,
        "0",
      )}-${birthDay.padStart(2, "0")}T00:00:00.000Z`;
    }

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      phone: phone
        ? `+${residenceCountry?.dialCode || ""}${phone}`
        : undefined,
      country: residenceCountry?.name,
      city: residenceCity,
      nationality: nationality?.name,
      birthCountry: birthCountry?.name,
      birthCity: birthCity,
      birthDate: formattedBirthDate,
      birthPlace: birthCity + (birthCountry ? ", " + birthCountry.name : ""),
    };

    try {
      // ✅ IMPORTANT : on NE demande plus le code société à l'utilisateur.
      // Le tenant est envoyé automatiquement par AuthProvider (tenantCode = tenant actif).
      await register(payload);
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Erreur inconnue.";
      showWebAlert("Echec", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  // --- RENDU ---
  const renderItem = ({ item }: { item: any }) => {
    if (typeof item === "string") {
      return (
        <TouchableOpacity
          style={styles.modalItem}
          onPress={() => {
            if (modalType === "RESIDENCE_CITY") setResidenceCity(item);
            if (modalType === "BIRTH_CITY") setBirthCity(item);
            setModalType(null);
          }}
        >
          <Text style={styles.modalText}>{item}</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={styles.modalItem}
        onPress={() => {
          if (modalType === "RESIDENCE_COUNTRY") setResidenceCountry(item);
          if (modalType === "NATIONALITY") setNationality(item);
          if (modalType === "BIRTH_COUNTRY") setBirthCountry(item);
          setModalType(null);
        }}
      >
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={styles.modalText}>{item.name}</Text>
        <Text style={styles.code}>+{item.dialCode}</Text>
      </TouchableOpacity>
    );
  };

  const getModalData = () => {
    if (
      modalType === "RESIDENCE_COUNTRY" ||
      modalType === "NATIONALITY" ||
      modalType === "BIRTH_COUNTRY"
    ) {
      return countriesList;
    }
    if (modalType === "RESIDENCE_CITY") {
      return residenceCountry
        ? citiesByCountry[residenceCountry.name] || []
        : [];
    }
    if (modalType === "BIRTH_CITY") {
      return birthCountry ? citiesByCountry[birthCountry.name] || [] : [];
    }
    return [];
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.headerTitle}>Créer un compte</Text>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>Société</Text>
          <View style={styles.tenantPill}>
            <Text style={styles.tenantText}>{tenantLabel}</Text>
          </View>
          <Text style={styles.hint}>
            Détectée automatiquement via votre lien société.
          </Text>
        </View>

        <Text style={styles.groupTitle}>IDENTIFIANTS</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Prénom *"
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Nom *"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Email *"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe *"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.groupTitle}>RÉSIDENCE & CONTACT</Text>

        <TouchableOpacity
          style={styles.selectInput}
          onPress={() => setModalType("RESIDENCE_COUNTRY")}
        >
          {residenceCountry ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>
                {residenceCountry.flag}
              </Text>
              <Text style={styles.inputText}>{residenceCountry.name}</Text>
            </View>
          ) : (
            <Text style={styles.placeholder}>Pays de résidence</Text>
          )}
          <Ionicons name="chevron-down" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.selectInput}
          onPress={() => {
            if (!residenceCountry)
              showWebAlert("Info", "Sélectionnez d'abord un pays.");
            else setModalType("RESIDENCE_CITY");
          }}
        >
          <Text style={residenceCity ? styles.inputText : styles.placeholder}>
            {residenceCity || "Ville de résidence"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#999" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={styles.phoneCodeBox}>
            <Text style={{ fontWeight: "bold" }}>
              {residenceCountry ? `+${residenceCountry.dialCode}` : "+ ??"}
            </Text>
          </View>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Numéro téléphone"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <Text style={styles.groupTitle}>ÉTAT CIVIL (KYC)</Text>

        <TouchableOpacity
          style={styles.selectInput}
          onPress={() => setModalType("NATIONALITY")}
        >
          <Text style={styles.labelSmall}>Nationalité</Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <Text style={nationality ? styles.inputText : styles.placeholder}>
              {nationality?.name || "Sélectionner"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#999" />
          </View>
        </TouchableOpacity>

        <Text style={[styles.labelSmall, { marginTop: 10, marginBottom: 4 }]}>
          Date de Naissance
        </Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 5 }]}
            placeholder="JJ"
            keyboardType="numeric"
            maxLength={2}
            value={birthDay}
            onChangeText={setBirthDay}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 5 }]}
            placeholder="MM"
            keyboardType="numeric"
            maxLength={2}
            value={birthMonth}
            onChangeText={setBirthMonth}
          />
          <TextInput
            style={[styles.input, { flex: 1.5 }]}
            placeholder="AAAA"
            keyboardType="numeric"
            maxLength={4}
            value={birthYear}
            onChangeText={setBirthYear}
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.selectInput, { flex: 1, marginRight: 8 }]}
            onPress={() => setModalType("BIRTH_COUNTRY")}
          >
            <Text style={styles.labelSmall}>Pays Naissance</Text>
            <Text
              style={[
                birthCountry ? styles.inputText : styles.placeholder,
                { marginTop: 4 },
              ]}
              numberOfLines={1}
            >
              {birthCountry?.name || "Choisir"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.selectInput, { flex: 1 }]}
            onPress={() => {
              if (!birthCountry) showWebAlert("Info", "Pays de naissance requis.");
              else setModalType("BIRTH_CITY");
            }}
          >
            <Text style={styles.labelSmall}>Ville Naissance</Text>
            <Text
              style={[
                birthCity ? styles.inputText : styles.placeholder,
                { marginTop: 4 },
              ]}
              numberOfLines={1}
            >
              {birthCity || "Choisir"}
            </Text>
          </TouchableOpacity>
        </View>

        <Pressable style={styles.button} onPress={onSubmit} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>CRÉER MON COMPTE</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={{ color: "#666" }}>Déjà inscrit ? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Se connecter</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      <Modal visible={!!modalType} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Faites votre choix</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList<any>
              data={getModalData()}
              keyExtractor={(item: any, i) => (item.code || item) + i}
              renderItem={renderItem}
              ListEmptyComponent={
                <Text style={{ padding: 20, textAlign: "center", color: "#888" }}>
                  Aucune donnée pour ce choix.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F8FAFC", paddingBottom: 50 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.primary,
    marginBottom: 20,
    textAlign: "center",
  },

  sectionBox: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  tenantPill: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tenantText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  hint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
    fontStyle: "italic",
  },

  groupTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    marginTop: 10,
    marginBottom: 8,
    letterSpacing: 1,
  },
  row: { flexDirection: "row", marginBottom: 12 },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: "#333",
    marginBottom: 12,
  },
  selectInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inputText: { fontSize: 15, color: "#333" },
  placeholder: { fontSize: 15, color: "#94A3B8" },
  labelSmall: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  phoneCodeBox: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    width: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  link: { color: colors.primary, fontWeight: "800" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "70%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
  },
  flag: { fontSize: 24, marginRight: 15 },
  modalText: { fontSize: 16, color: "#333", flex: 1 },
  code: { color: "#94A3B8", fontWeight: "600" },
});
