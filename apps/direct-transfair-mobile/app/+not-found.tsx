// apps/direct-transfair-mobile/app/+not-found.tsx
// =========================================================
// 404 NOT FOUND — Direct Transf'air
// Design: Thème clair · Ultra-moderne
// =========================================================

import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const C = {
  green:       "#059669",
  greenLight:  "#F0FDF4",
  greenBorder: "#A7F3D0",
  greenPale:   "#ECFDF5",
  pageBg:      "#F4F6FB",
  white:       "#FFFFFF",
  border:      "#E2E8F0",
  ink:         "#0F172A",
  inkSoft:     "#64748B",
  inkMuted:    "#94A3B8",
  r: { md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

export default function NotFoundScreen() {
  const router = useRouter();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 6 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.pageBg} />

      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Icône animée */}
        <Animated.View style={[s.iconOuter, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.iconMid}>
            <View style={s.iconInner}>
              <Ionicons name="map-outline" size={40} color={C.green} />
            </View>
          </View>
        </Animated.View>

        {/* Code 404 */}
        <Text style={[s.code, { fontFamily: C.font.mono }]}>404</Text>

        {/* Titre */}
        <Text style={[s.title, { fontFamily: C.font.serif }]}>Page introuvable</Text>

        {/* Description */}
        <Text style={[s.desc, { fontFamily: C.font.sans }]}>
          La page que vous cherchez n'existe pas ou a été déplacée.
        </Text>

        {/* URL */}
        <View style={s.urlBox}>
          <Ionicons name="link-outline" size={13} color={C.inkMuted} />
          <Text style={[s.urlTxt, { fontFamily: C.font.mono }]} numberOfLines={1}>
            Cette route n'est pas définie
          </Text>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.replace("/(tabs)/home")}
            activeOpacity={0.88}
          >
            <Ionicons name="home-outline" size={18} color={C.white} />
            <Text style={[s.primaryBtnTxt, { fontFamily: C.font.sans }]}>
              Retour à l'accueil
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.88}
          >
            <Ionicons name="arrow-back-outline" size={16} color={C.green} />
            <Text style={[s.secondaryBtnTxt, { fontFamily: C.font.sans }]}>
              Page précédente
            </Text>
          </TouchableOpacity>
        </View>

        {/* Badge Direct Transf'air */}
        <View style={s.badge}>
          <Ionicons name="swap-horizontal-outline" size={13} color={C.green} />
          <Text style={[s.badgeTxt, { fontFamily: C.font.sans }]}>
            Direct Transf'air
          </Text>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.pageBg },
  content: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, paddingBottom: 40,
  },

  iconOuter: {
    width: 120, height: 120, borderRadius: 36,
    backgroundColor: C.greenLight,
    justifyContent: "center", alignItems: "center",
    marginBottom: 28,
    borderWidth: 1, borderColor: C.greenBorder,
  },
  iconMid: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: C.greenPale,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: C.greenBorder,
  },
  iconInner: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: C.white,
    justifyContent: "center", alignItems: "center",
    shadowColor: C.green, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: C.greenBorder,
  },

  code:  { fontSize: 72, fontWeight: "900", color: C.green, letterSpacing: -3, lineHeight: 80, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: C.ink, textAlign: "center", marginBottom: 12 },
  desc:  { fontSize: 14, color: C.inkSoft, textAlign: "center", lineHeight: 22, fontWeight: "500", marginBottom: 20, paddingHorizontal: 10 },

  urlBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.white, borderRadius: C.r.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 32, maxWidth: "100%",
  },
  urlTxt: { fontSize: 11, color: C.inkMuted, flex: 1 },

  actions: { width: "100%", gap: 12, marginBottom: 28 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: C.green,
    borderRadius: C.r.lg, paddingVertical: 16,
    shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  primaryBtnTxt: { color: C.white, fontSize: 15, fontWeight: "700" },

  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: C.white,
    borderRadius: C.r.lg, paddingVertical: 14,
    borderWidth: 1, borderColor: C.greenBorder,
  },
  secondaryBtnTxt: { color: C.green, fontSize: 14, fontWeight: "600" },

  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.greenPale, borderRadius: C.r.pill,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: C.greenBorder,
  },
  badgeTxt: { color: C.green, fontSize: 12, fontWeight: "600" },
});