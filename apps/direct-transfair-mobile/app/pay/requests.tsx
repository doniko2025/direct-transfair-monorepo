// apps/direct-transfair-mobile/app/pay/requests.tsx
// =========================================================
// DEMANDES À PAYER v1.0 — Lot 11
// Demandes envoyées par des marchands au numéro du client, encore valables. Se met à jour toutes les 10 s.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, EmptyView, ErrorView, NavBar, Pill, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import { Rise, mmss, money, useCountdown } from "../../components/merchant/merchantUi";

function RequestCard({ p, onPress }: { p: PaymentRequestView; onPress: () => void }) {
  const { C } = useUI();
  const left = useCountdown(p.secondsLeft, p.id);
  return (
    <Card onPress={onPress} pad={16} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.warnBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="storefront-outline" size={21} color={C.warn} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <UText v="bodyStrong" numberOfLines={1}>{p.merchant.businessName}</UText>
          <UText v="caption" tone="muted" numberOfLines={1}>{p.note ?? p.merchant.category ?? "Demande de paiement"}</UText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <UText v="bodyStrong">{money(p.amount, p.currency)}</UText>
          <Pill label={left > 0 ? mmss(left) : "Expiré"} tone={left > 0 && left <= 60 ? "danger" : "warn"} />
        </View>
      </View>
    </Card>
  );
}

export default function PayRequestsScreen() {
  const router = useRouter();
  const { data, status, error, refreshing, reload, refresh } = useLoader(() => api.getIncomingPayments());
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { void refresh(); setTick((n) => n + 1); }, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const items = data ?? [];
  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title="Demandes à payer" />}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={<Button label="Payer avec QR code" icon="scan-outline" kind="outline" onPress={() => router.push("/pay/scan" as any)} />}
    >
      {status === "loading" ? <SkeletonRows rows={3} /> : status === "error" ? (
        <ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyView icon="notifications-outline" title="Aucune demande" message="Quand un marchand vous envoie une demande de paiement, elle apparaît ici et par notification." />
      ) : (
        <Rise>{items.map((p) => <RequestCard key={p.id} p={p} onPress={() => router.push({ pathname: "/pay/request", params: { id: p.id } } as any)} />)}</Rise>
      )}
    </Screen>
  );
}
