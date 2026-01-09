//apps/direct-transfair-mobile/app/index.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../theme/colors";

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Direct Transfair</Text>
      <Text style={styles.subtitle}>Bienvenue</Text>

      <TouchableOpacity 
        style={styles.btn} 
        onPress={() => router.replace("/(auth)/login")}
      >
        <Text style={styles.btnText}>Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 32, fontWeight: "bold", color: colors.primary, marginBottom: 10 },
  subtitle: { fontSize: 18, color: colors.muted, marginBottom: 40 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 }
});