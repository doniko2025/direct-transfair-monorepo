//apps/direct-transfair-mobile/app/index.tsx
// apps/direct-transfair-mobile/app/index.tsx
// =========================================================
// SPLASH / LANDING v4.0 — Direct Transf'air
// Design: Émeraude Profond premium avec animations
// ✅ Entrée animée, CTA Se connecter / Devenir client
// =========================================================

import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Platform, Animated, useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const T = {
  g1: "#022C22", g2: "#065F46", g3: "#059669",
  white: "#FFFFFF",
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Feature Pill ─────────────────────────────────────────
function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={fpS.pill}>
      <Ionicons name={icon as any} size={13} color="rgba(255,255,255,0.9)" />
      <Text style={[fpS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const fpS = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 99,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  label: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "700" },
});

export default function Index() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleLogoAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(scaleLogoAnim, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 8 }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={[T.g1, T.g2, T.g3]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* Déco cercles */}
        <View style={[s.deco1]} pointerEvents="none" />
        <View style={[s.deco2]} pointerEvents="none" />
        <View style={[s.deco3]} pointerEvents="none" />

        <View style={[s.container, isDesktop && s.containerDesktop]}>

          {/* ── Logo ── */}
          <Animated.View style={[s.logoSection, { transform: [{ scale: scaleLogoAnim }] }]}>
            <View style={s.logoOuter}>
              <LinearGradient colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]} style={s.logoGrad}>
                <View style={s.logoInner}>
                  <Ionicons name="swap-horizontal" size={38} color="#059669" />
                </View>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* ── Hero text ── */}
          <Animated.View
            style={[
              s.heroSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={[s.title, { fontFamily: T.font.display }]}>Direct Transf'air</Text>
            <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
              L'argent sans frontières.{"\n"}Transferts instantanés et sécurisés.
            </Text>

            {/* Feature pills */}
            <View style={s.pillsRow}>
              <FeaturePill icon="flash-outline" label="Instantané" />
              <FeaturePill icon="shield-checkmark-outline" label="Sécurisé" />
              <FeaturePill icon="cash-outline" label="Sans frais" />
            </View>
          </Animated.View>

          {/* ── CTAs ── */}
          <Animated.View
            style={[
              s.ctaSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              style={s.primaryBtn}
              activeOpacity={0.9}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={[s.primaryBtnTxt, { fontFamily: T.font.sans }]}>Se connecter</Text>
              <View style={s.primaryBtnArrow}>
                <Ionicons name="arrow-forward" size={18} color="#059669" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              activeOpacity={0.85}
              onPress={() => router.replace("/(auth)/register")}
            >
              <Text style={[s.secondaryBtnTxt, { fontFamily: T.font.sans }]}>Devenir client</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Footer ── */}
          <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
            <Text style={[s.footerTxt, { fontFamily: T.font.sans }]}>
              En continuant, vous acceptez nos{" "}
              <Text style={s.footerLink}>Conditions générales</Text>
              {" "}et notre{" "}
              <Text style={s.footerLink}>Politique de confidentialité</Text>.
            </Text>
          </Animated.View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  deco1: { position: "absolute", width: 400, height: 400, borderRadius: 200, backgroundColor: "rgba(255,255,255,0.05)", top: -100, right: -120 },
  deco2: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.04)", top: "35%", left: -80 },
  deco3: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.04)", bottom: -40, right: "22%" },

  container: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between", paddingVertical: Platform.OS === "android" ? 60 : 80 },
  containerDesktop: { maxWidth: 500, alignSelf: "center", width: "100%" },

  logoSection: { alignItems: "center" },
  logoOuter: { width: 96, height: 96, borderRadius: 28, overflow: "hidden" },
  logoGrad: { flex: 1, justifyContent: "center", alignItems: "center" },
  logoInner: { width: 74, height: 74, borderRadius: 22, backgroundColor: T.white, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },

  heroSection: { alignItems: "center", gap: 12 },
  title: { fontSize: 38, color: T.white, fontWeight: "900", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 24, fontWeight: "500" },
  pillsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },

  ctaSection: { gap: 14 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: T.white, borderRadius: 20, paddingVertical: 18,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 6, gap: 12,
  },
  primaryBtnTxt: { color: "#059669", fontSize: 18, fontWeight: "900", letterSpacing: 0.3 },
  primaryBtnArrow: { width: 30, height: 30, borderRadius: 99, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },

  secondaryBtn: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 20, paddingVertical: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
  },
  secondaryBtnTxt: { color: T.white, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  footer: { alignItems: "center", paddingHorizontal: 10 },
  footerTxt: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 17 },
  footerLink: { color: "rgba(255,255,255,0.85)", fontWeight: "700", textDecorationLine: "underline" },
});