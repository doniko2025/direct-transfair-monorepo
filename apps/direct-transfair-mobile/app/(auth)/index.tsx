// apps/direct-transfair-mobile/app/(auth)/index.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function Dashboard() {
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Connecté :</Text>
        <Text style={styles.value}>{user?.email ?? "-"}</Text>
        <Text style={styles.small}>Tenant: DONIKO</Text>
      </View>

      {/* ✅ CORRECTION : (tabs) au lieu de (app) */}
      <Pressable style={styles.btn} onPress={() => router.push("/(tabs)/transactions")}>
        <Text style={styles.btnText}>Transactions</Text>
      </Pressable>

      {/* ✅ CORRECTION : (tabs) + beneficiaries (anglais) */}
      <Pressable style={styles.btn} onPress={() => router.push("/(tabs)/beneficiaries")}>
        <Text style={styles.btnText}>Bénéficiaires</Text>
      </Pressable>

      {/* ✅ CORRECTION : withdraw (nom du fichier) au lieu de withdrawals */}
      <Pressable style={styles.btn} onPress={() => router.push("/(tabs)/withdraw")}>
        <Text style={styles.btnText}>Retraits</Text>
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: "900", color: colors.primary, marginBottom: 14 },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#EEE", marginBottom: 14 },
  label: { fontWeight: "800", marginBottom: 4 },
  value: { fontSize: 16, fontWeight: "700" },
  small: { marginTop: 6, color: "#666" },
  btn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center", marginBottom: 10 },
  btnText: { color: "#FFF", fontWeight: "800" },
  logoutBtn: { marginTop: 16, alignItems: "center" },
  logoutText: { color: "#B00020", fontWeight: "900" },
});