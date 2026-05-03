// apps/direct-transfair-mobile/app/[tenant]/index.tsx
// apps/direct-transfair-mobile/app/[tenant]/index.tsx
// =========================================================
// TENANT REDIRECT v4.0 — Direct Transf'air
// Design: Émeraude Profond avec animation logo
// ✅ Configure le tenant puis redirige vers login
// =========================================================

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const T = {
  g1: "#022C22", g2: "#065F46",
  accent: "#10B981", accentSoft: "#34D399",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.7)",
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

export default function TenantRedirectScreen() {
  const { tenant } = useLocalSearchParams();
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 6 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const configureTenant = async () => {
      if (tenant && typeof tenant === "string") {
        const code = tenant.toUpperCase();
        console.log(`🏢 Tenant configuré : ${code}`);
        await AsyncStorage.setItem("PREFERRED_TENANT", code);
        api.setTenant(code);
        // Délai pour que l'utilisateur voit l'écran de transition
        await new Promise((r) => setTimeout(r, 1000));
        router.replace("/(auth)/login");
      } else {
        router.replace("/(auth)/login");
      }
    };
    void configureTenant();
  }, [tenant, router]);

  const tenantName = typeof tenant === "string" ? tenant.toUpperCase() : "…";

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={s.container}>
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Logo */}
        <View style={s.logoOuter}>
          <View style={s.logoInner}>
            <Ionicons name="swap-horizontal" size={36} color={T.accent} />
          </View>
        </View>

        <Text style={[s.appName, { fontFamily: T.font.display }]}>Direct Transf'air</Text>

        {/* Tenant badge */}
        <View style={s.tenantBadge}>
          <View style={s.tenantDot} />
          <Text style={[s.tenantName, { fontFamily: T.font.mono }]}>{tenantName}</Text>
        </View>

        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 32 }} />

        <Text style={[s.statusTxt, { fontFamily: T.font.sans }]}>
          Connexion à l'espace {tenantName}…
        </Text>
      </Animated.View>

      {/* Déco */}
      <View style={s.deco1} />
      <View style={s.deco2} />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", zIndex: 1 },

  logoOuter: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: "rgba(16,185,129,0.15)", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", marginBottom: 16,
  },
  logoInner: {
    width: 66, height: 66, borderRadius: 20,
    backgroundColor: T.white, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  appName: { color: T.white, fontSize: 28, fontWeight: "700", marginBottom: 14 },

  tenantBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
  },
  tenantDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#10B981" },
  tenantName: { color: "#10B981", fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },

  statusTxt: { color: T.dim, fontSize: 13, fontWeight: "600", marginTop: 14 },

  deco1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,255,255,0.04)", top: -80, right: -80 },
  deco2: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.03)", bottom: -40, left: -40 },
});