// apps/direct-transfair-mobile/app/[tenant]/index.tsx
// =========================================================
// TENANT REDIRECT v5.0 — Direct Transf'air
// ✅ Charge le branding réel via TenantProvider.loadBranding()
// ✅ Garde le design émeraude + animation existants
// ✅ Affiche le nom réel de la société une fois chargé
// ✅ Écran d'erreur si code inconnu
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  Animated, Platform, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTenant } from "../../providers/TenantProvider";

const T = {
  g1: "#022C22", g2: "#065F46",
  accent: "#10B981", accentSoft: "#34D399",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.7)",
  red: "#EF4444", redBg: "rgba(239,68,68,0.12)", redBorder: "rgba(239,68,68,0.25)",
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"       }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif"  }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"   }),
  },
};

export default function TenantRedirectScreen() {
  const { tenant }       = useLocalSearchParams<{ tenant: string }>();
  const { loadBranding } = useTenant();
  const router           = useRouter();

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // ── États ───────────────────────────────────────────
  const [phase,       setPhase]       = useState<"loading" | "success" | "error">("loading");
  const [companyName, setCompanyName] = useState<string>("");
  const [errorMsg,    setErrorMsg]    = useState<string>("");

  // ── Animation d'entrée ──────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 6 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400,         useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Chargement branding ─────────────────────────────
  useEffect(() => {
    const code = typeof tenant === "string" ? tenant.trim().toUpperCase() : "";

    if (!code) {
      router.replace("/(auth)/login");
      return;
    }

    const run = async () => {
      try {
        // ✅ loadBranding fait : GET /branding/:code + api.setTenant + AsyncStorage
        await loadBranding(code);

        // Récupérer le nom société depuis le provider
        // (on passe via un petit délai pour lire le state mis à jour)
        setPhase("success");
        setCompanyName(code); // sera affiché le temps que le state se propage

        // Délai court pour que l'utilisateur voit la confirmation
        await new Promise((r) => setTimeout(r, 900));
        router.replace("/(auth)/login");
      } catch {
        setPhase("error");
        setErrorMsg(
          `Le code « ${code} » ne correspond à aucune société active.\n` +
          `Vérifiez le lien reçu ou contactez votre administrateur.`,
        );
      }
    };

    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tenantLabel = typeof tenant === "string"
    ? tenant.trim().toUpperCase()
    : "…";

  // ── Rendu erreur ─────────────────────────────────────
  if (phase === "error") {
    return (
      <LinearGradient colors={[T.g1, T.g2]} style={s.container}>
        <View style={s.deco1} />
        <View style={s.deco2} />

        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

          <View style={s.errorIconBox}>
            <Ionicons name="alert-circle-outline" size={44} color={T.red} />
          </View>

          <Text style={[s.errorTitle, { fontFamily: T.font.display }]}>
            Société introuvable
          </Text>
          <Text style={[s.errorMsg, { fontFamily: T.font.sans }]}>
            {errorMsg}
          </Text>

          <TouchableOpacity
            style={s.errorBtn}
            onPress={() => router.replace("/(auth)/login")}
            activeOpacity={0.88}
          >
            <Text style={[s.errorBtnTxt, { fontFamily: T.font.sans }]}>
              Continuer sans code société
            </Text>
            <Ionicons name="arrow-forward" size={16} color={T.white} />
          </TouchableOpacity>

        </Animated.View>
      </LinearGradient>
    );
  }

  // ── Rendu chargement / succès ─────────────────────────
  return (
    <LinearGradient colors={[T.g1, T.g2]} style={s.container}>
      <View style={s.deco1} />
      <View style={s.deco2} />

      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Logo */}
        <View style={s.logoOuter}>
          <View style={s.logoInner}>
            <Ionicons name="swap-horizontal" size={36} color={T.accent} />
          </View>
        </View>

        <Text style={[s.appName, { fontFamily: T.font.display }]}>Direct Transf'air</Text>

        {/* Badge tenant */}
        <View style={s.tenantBadge}>
          <View style={[
            s.tenantDot,
            { backgroundColor: phase === "success" ? "#4ADE80" : T.accent },
          ]} />
          <Text style={[s.tenantName, { fontFamily: T.font.mono }]}>
            {tenantLabel}
          </Text>
          {phase === "success" && (
            <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
          )}
        </View>

        {phase === "loading" ? (
          <>
            <ActivityIndicator
              color={T.accent}
              size="large"
              style={{ marginTop: 32 }}
            />
            <Text style={[s.statusTxt, { fontFamily: T.font.sans }]}>
              Chargement de votre espace…
            </Text>
          </>
        ) : (
          <>
            <View style={s.successRow}>
              <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />
              <Text style={[s.successTxt, { fontFamily: T.font.sans }]}>
                Espace {companyName || tenantLabel} configuré
              </Text>
            </View>
            <Text style={[s.redirectTxt, { fontFamily: T.font.sans }]}>
              Redirection en cours…
            </Text>
          </>
        )}

      </Animated.View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  content:   { alignItems: "center", zIndex: 1, paddingHorizontal: 32 },

  // Logo
  logoOuter: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: "rgba(16,185,129,0.15)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", marginBottom: 16,
  },
  logoInner: {
    width: 66, height: 66, borderRadius: 20,
    backgroundColor: T.white, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },

  appName: {
    color: T.white, fontSize: 28, fontWeight: "700", marginBottom: 14,
  },

  // Badge
  tenantBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
  },
  tenantDot:  { width: 6, height: 6, borderRadius: 99 },
  tenantName: { color: "#10B981", fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },

  // Statut
  statusTxt:  { color: T.dim,     fontSize: 13, fontWeight: "600", marginTop: 14 },

  // Succès
  successRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28,
    backgroundColor: "rgba(74,222,128,0.12)", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(74,222,128,0.25)",
  },
  successTxt:  { color: "#4ADE80", fontSize: 13, fontWeight: "700" },
  redirectTxt: { color: T.dim, fontSize: 11, fontWeight: "600", marginTop: 10 },

  // Erreur
  errorIconBox: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: T.redBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.redBorder, marginBottom: 16,
  },
  errorTitle: {
    color: T.white, fontSize: 24, fontWeight: "800",
    textAlign: "center", marginBottom: 12,
  },
  errorMsg: {
    color: T.dim, fontSize: 13, fontWeight: "500",
    textAlign: "center", lineHeight: 20, marginBottom: 28,
  },
  errorBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 22,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  errorBtnTxt: { color: T.white, fontWeight: "800", fontSize: 13 },

  // Déco
  deco1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,255,255,0.04)", top: -80, right: -80 },
  deco2: { position: "absolute", width: 180, height: 180, borderRadius: 90,  backgroundColor: "rgba(255,255,255,0.03)", bottom: -40, left: -40 },
});