// apps/direct-transfair-mobile/app/(tabs)/profile.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";

import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function ProfileScreen() {
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // ✅ ROUTE AUTH RÉELLE
      router.replace("/(auth)/login");
    } catch {
      Alert.alert(
        "Erreur",
        "Impossible de se déconnecter pour le moment. Réessaie."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mon profil</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? "—"}</Text>

        <Text style={styles.label}>Rôle</Text>
        <Text style={styles.value}>{user?.role ?? "Utilisateur"}</Text>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={isLoading}
      >
        <Text style={styles.logoutText}>
          {isLoading ? "Déconnexion..." : "Se déconnecter"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    color: colors.text,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 30,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 8,
  },
  value: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  logoutButton: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
