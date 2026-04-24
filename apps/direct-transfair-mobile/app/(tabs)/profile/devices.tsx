//apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function DevicesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Appareils connectés</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.desc}>Gérez les appareils ayant accès à votre compte Direct Transf'air.</Text>
        
        {/* Appareil Actuel */}
        <Text style={styles.label}>APPAREIL ACTUEL</Text>
        <View style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: "#ECFDF5" }]}>
            <Ionicons name={Platform.OS === 'web' ? "desktop-outline" : "phone-portrait-outline"} size={24} color="#059669" />
          </View>
          <View style={styles.info}>
            <Text style={styles.deviceName}>{Platform.OS === 'web' ? "Navigateur Web (Chrome)" : "iPhone 14 Pro"}</Text>
            <Text style={styles.deviceDetail}>Paris, France • En ligne maintenant</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>ACTIF</Text></View>
        </View>

        {/* Autres appareils */}
        <Text style={styles.label}>AUTRES APPAREILS</Text>
        <View style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: "#F3F4F6" }]}>
            <Ionicons name="laptop-outline" size={24} color="#4B5563" />
          </View>
          <View style={styles.info}>
            <Text style={styles.deviceName}>MacBook Air</Text>
            <Text style={styles.deviceDetail}>Lyon, France • Hier à 14h30</Text>
          </View>
          <TouchableOpacity><Text style={styles.revoke}>Déconnecter</Text></TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  title: { fontSize: 18, fontWeight: "700", color: "#111" },
  content: { padding: 20 },
  desc: { fontSize: 14, color: "#6B7280", marginBottom: 30, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", marginBottom: 12, letterSpacing: 1 },
  card: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", marginBottom: 20 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  info: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 4 },
  deviceDetail: { fontSize: 12, color: "#6B7280" },
  badge: { backgroundColor: "#059669", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  revoke: { color: "#DC2626", fontSize: 13, fontWeight: "600" },
});