// apps/direct-transfair-mobile/app/[tenant]/index.tsx
// =========================================================
// TENANT REDIRECT v6.0 — Direct Transf'air (white-label)
// ✅ v6.0 : REFONTE en thème clair (design system components/ui) : badge du code société, spinner, message
//    de confirmation, écran d'erreur avec bouton. Le nom affiché est celui du tenant chargé (branding.name)
//    et non plus « Direct Transf'air » écrit en dur. Logique INCHANGÉE : loadBranding(code) (GET /branding/:code
//    + api.setTenant + stockage), redirection vers /(auth)/login après 0,9 s, erreur si code inconnu.
// ✅ v5.0 : charge le branding réel, écran d'erreur si code inconnu.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTenant } from "../../providers/TenantProvider";
import { Button, Pill, Screen, UText, useUI } from "../../components/ui";

export default function TenantRedirectScreen() {
  const { tenant }       = useLocalSearchParams<{ tenant: string }>();
  const { loadBranding, branding } = useTenant();
  const router           = useRouter();


  // ── États ───────────────────────────────────────────
  const [phase,       setPhase]       = useState<"loading" | "success" | "error">("loading");
  const [companyName, setCompanyName] = useState<string>("");
  const [errorMsg,    setErrorMsg]    = useState<string>("");

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
  const { C } = useUI();

  // ── Rendu erreur ─────────────────────────────────────
  if (phase === "error") {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: "center", alignItems: "center", gap: 10 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Ionicons name="alert-circle-outline" size={42} color={C.danger} />
        </View>
        <UText v="title" align="center">Société introuvable</UText>
        <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>{errorMsg}</UText>
        <View style={{ alignSelf: "stretch", marginTop: 22 }}>
          <Button label="Continuer sans code société" iconRight="arrow-forward" kind="dark" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </Screen>
    );
  }

  // ── Rendu chargement / succès ─────────────────────────
  return (
    <Screen scroll={false} contentStyle={{ justifyContent: "center", alignItems: "center", gap: 14 }}>
      <UText v="title" align="center">{phase === "success" ? branding.name : "Chargement…"}</UText>
      <Pill label={tenantLabel} tone={phase === "success" ? "pos" : "neutral"} icon={phase === "success" ? "checkmark-circle" : undefined} style={{ alignSelf: "center" }} />
      {phase === "loading" ? (
        <>
          <ActivityIndicator color={C.ink} size="large" style={{ marginTop: 18 }} />
          <UText v="caption" tone="muted">Chargement de votre espace…</UText>
        </>
      ) : (
        <>
          <UText v="bodyStrong" tone="pos">Espace {companyName || tenantLabel} configuré</UText>
          <UText v="caption" tone="muted">Redirection en cours…</UText>
        </>
      )}
    </Screen>
  );
}
