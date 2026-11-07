// apps/direct-transfair-mobile/app/merchant/index.tsx
// =========================================================
// ENTRÉE « ESPACE MARCHAND » v2.0 — Lot 12
// L'accueil du marchand est désormais l'onglet « Accueil » (solde, Encaisser, Retirer). Cette route (liens de
// notification, anciens raccourcis) y renvoie le marchand ; un client qui n'est pas marchand voit l'invitation à
// activer son espace.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, ErrorView, NavBar, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import { Rise } from "../../components/merchant/merchantUi";

export default function MerchantEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const { C } = useUI();
  const { data: me, status, error, reload } = useLoader(() => api.getMerchantMe());

  const isMerchant = user?.accountType === "MERCHANT" || !!me?.isMerchant;
  useEffect(() => {
    if (isMerchant) router.replace("/(tabs)/home" as any);
  }, [isMerchant, router]);

  if (isMerchant || status === "loading") {
    return <Screen header={<NavBar onBack={() => router.back()} title="Espace marchand" />}><SkeletonRows rows={3} /></Screen>;
  }
  if (status === "error" || !me) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title="Espace marchand" />}>
        <ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen header={<NavBar onBack={() => router.back()} title="Espace marchand" />}>
      <Rise>
        <Card pad={24} style={{ alignItems: "center", gap: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="storefront-outline" size={34} color={C.ink} />
          </View>
          <UText v="title" align="center">Encaissez vos clients</UText>
          <UText v="body" tone="muted" align="center">
            {me.canActivate
              ? "Activez votre espace marchand en une minute : QR code, paiement par téléphone, solde et retraits vers votre Orange Money."
              : "Les comptes marchands ne sont pas disponibles pour le moment."}
          </UText>
          {me.canActivate && <Button label="Devenir marchand" onPress={() => router.push("/merchant/activate" as any)} style={{ marginTop: 10 }} />}
        </Card>
      </Rise>
    </Screen>
  );
}
