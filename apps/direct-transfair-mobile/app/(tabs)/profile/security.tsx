//apps/direct-transfair-mobile/app/(tabs)/profile/security.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function SecurityScreen() {
  const router = useRouter();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const handleSave = () => {
    if (!oldPass || !newPass) return Alert.alert("Erreur", "Veuillez remplir tous les champs.");
    Alert.alert("Succès", "Votre code secret a été mis à jour.");
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Code Secret</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={40} color="#3B82F6" />
        </View>
        <Text style={styles.instruction}>Renforcez la sécurité de votre compte en modifiant régulièrement votre code secret.</Text>

        <Text style={styles.label}>Ancien code secret</Text>
        <TextInput 
          style={styles.input} secureTextEntry 
          value={oldPass} onChangeText={setOldPass} placeholder="••••••" 
        />

        <Text style={styles.label}>Nouveau code secret</Text>
        <TextInput 
          style={styles.input} secureTextEntry 
          value={newPass} onChangeText={setNewPass} placeholder="••••••" 
        />

        <TouchableOpacity style={styles.btn} onPress={handleSave}>
          <Text style={styles.btnText}>Mettre à jour le code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 60 },
  title: { fontSize: 18, fontWeight: "700", color: "#111" },
  content: { padding: 24 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 20 },
  instruction: { textAlign: "center", color: "#6B7280", lineHeight: 22, marginBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, fontSize: 18, marginBottom: 24, letterSpacing: 4 },
  btn: { backgroundColor: "#111827", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});