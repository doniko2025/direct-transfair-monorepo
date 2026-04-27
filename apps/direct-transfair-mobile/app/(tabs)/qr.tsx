//apps/direct-transfair-mobile/app/(tabs)/qr.tsx
import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#059669",
  light: "#ECFDF5",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

export default function QRCodeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
      
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={s.title}>Mon QR Code</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.content}>
        <Text style={s.subtitle}>Présentez ce code pour recevoir de l'argent instantanément.</Text>

        <View style={s.qrCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.firstName?.charAt(0) || "C"}</Text>
          </View>
          <Text style={s.userName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={s.userPhone}>{user?.phone || "Client Direct Transf'air"}</Text>

          {/* Espace pour le vrai QR Code plus tard (ex: react-native-qrcode-svg) */}
          <View style={s.qrPlaceholder}>
            <Ionicons name="qr-code" size={150} color={THEME.primary} />
          </View>
        </View>

        <TouchableOpacity style={s.scanBtn}>
          <Ionicons name="scan" size={20} color="#FFF" />
          <Text style={s.scanBtnText}>Scanner un code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.surface, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  title: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: "800", color: THEME.text },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  subtitle: { fontSize: 14, fontFamily: FONTS.body, color: THEME.muted, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  qrCard: { backgroundColor: THEME.surface, borderRadius: 30, padding: 30, alignItems: 'center', width: '100%', maxWidth: 350, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20, elevation: 5, borderWidth: 1, borderColor: THEME.border },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: THEME.light, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: '800', color: THEME.primary },
  userName: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: '800', color: THEME.text, marginBottom: 4 },
  userPhone: { fontSize: 14, fontFamily: FONTS.body, color: THEME.muted, fontWeight: '600', marginBottom: 30 },
  qrPlaceholder: { padding: 20, backgroundColor: THEME.bg, borderRadius: 24, borderWidth: 1, borderColor: THEME.border },
  scanBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.primary, paddingVertical: 18, paddingHorizontal: 30, borderRadius: 16, marginTop: 40, gap: 10, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  scanBtnText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: '800', fontSize: 16 },
});