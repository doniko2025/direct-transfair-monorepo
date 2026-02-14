//apps/direct-transfair-mobile/app/(tabs)/admin/index.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../../providers/AuthProvider";
import SuperAdminDashboard from "../../../components/dashboards/SuperAdminDashboard";

export default function AdminTabScreen() {
  const { user } = useAuth();

  if (!user || user.role !== "SUPER_ADMIN") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Accès réservé</Text>
        <Text style={styles.sub}>Vous devez être SUPER_ADMIN.</Text>
      </View>
    );
  }

  return <SuperAdminDashboard />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 16, fontWeight: "700" },
  sub: { marginTop: 6, fontSize: 13, color: "#64748B", textAlign: "center" },
});
