// apps/direct-transfair-mobile/app/+not-found.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// 404 NOT FOUND v2.0 — Direct Transf'air (white-label)
// ✅ v2.0 : REFONTE en thème clair (design system components/ui) ; le badge affiche le nom de la société du
//    tenant (branding.name) au lieu de « Direct Transf'air » écrit en dur. Navigation inchangée :
//    « Retour à l'accueil » → /(tabs)/home, « Page précédente » → router.back().
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../components/ui/Icon';
import { Button, Pill, Screen, UText, useUI } from "../components/ui";
import { useTenant } from "../providers/TenantProvider";

export default function NotFoundScreen() {
  const router = useRouter();
  const { C } = useUI();
  const { branding } = useTenant();

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: "center", alignItems: "center", gap: 10 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        <Ionicons name="map-outline" size={42} color={C.ink} />
      </View>
      <UText v="overline" tone="muted">Erreur 404</UText>
      <UText v="title" align="center">Page introuvable</UText>
      <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>
        La page que vous cherchez n'existe pas ou a été déplacée.
      </UText>

      <View style={{ alignSelf: "stretch", gap: 12, marginTop: 24 }}>
        <Button label="Retour à l'accueil" icon="home-outline" onPress={() => router.replace("/(tabs)/home")} />
        <Button label="Page précédente" icon="arrow-back-outline" kind="outline" onPress={() => router.back()} />
      </View>

      <Pill label={branding.name} tone="neutral" icon="swap-horizontal-outline" style={{ marginTop: 22, alignSelf: "center" }} />
    </Screen>
  );
}
