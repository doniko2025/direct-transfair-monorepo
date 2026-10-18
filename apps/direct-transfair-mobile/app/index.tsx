// apps/direct-transfair-mobile/app/index.tsx
// =========================================================
// SPLASH / LANDING v5.0 — Direct Transf'air (white-label)
// ✅ v5.0 : REFONTE TOTALE en thème clair (inspirée de « Taptap Send ») : fond crème, grande carte d'accueil
//    qui se fond vers la couleur d'accent de la société (logo du tenant), slogan et nom de la société venant
//    de la configuration du tenant (plus de texte « Direct Transf'air » ni de promesses « Sans frais /
//    Instantané » écrites en dur), boutons « Se connecter » (pilule d'accent) et « Devenir client »
//    (contour noir), liens légaux cliquables. Navigation INCHANGÉE (replace /(auth)/login et /(auth)/register,
//    push vers terms et privacy-policy).
// ✅ v4.1 : liens « Conditions générales » et « Politique de confidentialité » cliquables.
// ✅ v4.0 : splash animé (logo, texte, boutons).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useRef, useEffect } from "react";
import { View, Text, Image, Animated, Platform, StatusBar, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUI, SYSTEM_FONT } from "../components/ui/theme";
import { Button } from "../components/ui/Primitives";
import { useTenant } from "../providers/TenantProvider";

export default function Index() {
  const router = useRouter();
  const { C, R, S } = useUI();
  const { branding } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const top = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 12) + 16;
  const bottom = Math.max(insets.bottom, 16) + 12;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View
        style={{
          flex: 1, width: "100%", maxWidth: isDesktop ? 480 : undefined, alignSelf: "center",
          paddingHorizontal: 22, paddingTop: top, paddingBottom: bottom, justifyContent: "space-between",
        }}
      >
        {/* ── Marque ── */}
        <Animated.View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: fadeAnim }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {branding.logoUrl
              ? <Image source={{ uri: branding.logoUrl }} style={{ width: "78%", height: "78%" }} resizeMode="contain" />
              : <Ionicons name="swap-horizontal" size={20} color={C.accentInk} />}
          </View>
          <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 17, fontWeight: "800", color: C.ink, letterSpacing: -0.3, flexShrink: 1 }} numberOfLines={1}>
            {branding.name}
          </Text>
        </Animated.View>

        {/* ── Carte d'accueil ── */}
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={[{ borderRadius: R.xl }, S.md]}>
            <LinearGradient
              colors={[C.surface, C.accentSoft, C.accent]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: R.xl, padding: 26, minHeight: 230, justifyContent: "space-between", borderWidth: 1, borderColor: C.line, overflow: "hidden" }}
            >
              <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", ...S.sm }}>
                {branding.logoUrl
                  ? <Image source={{ uri: branding.logoUrl }} style={{ width: "72%", height: "72%" }} resizeMode="contain" />
                  : <Ionicons name="swap-horizontal" size={40} color={C.ink} />}
              </View>
              <View style={{ marginTop: 28 }}>
                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -1, color: C.ink }}>
                  {branding.name}
                </Text>
                {!!branding.tagline && (
                  <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 16, lineHeight: 23, color: C.ink, opacity: 0.72, marginTop: 8 }}>
                    {branding.tagline}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View style={{ gap: 12, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Button label="Se connecter" iconRight="arrow-forward" onPress={() => router.replace("/(auth)/login")} />
          <Button label="Devenir client" kind="outline" onPress={() => router.replace("/(auth)/register")} />

          <Text style={{ textAlign: "center", fontFamily: SYSTEM_FONT, fontSize: 11.5, color: C.muted, lineHeight: 17, marginTop: 6 }}>
            En continuant, vous acceptez nos{" "}
            <Text style={{ color: C.ink, fontWeight: "700", textDecorationLine: "underline" }} onPress={() => router.push("/(auth)/terms")}>
              Conditions générales
            </Text>
            {" "}et notre{" "}
            <Text style={{ color: C.ink, fontWeight: "700", textDecorationLine: "underline" }} onPress={() => router.push("/(auth)/privacy-policy")}>
              Politique de confidentialité
            </Text>
            .
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
