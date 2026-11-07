// apps/direct-transfair-mobile/components/dashboards/MerchantDashboard.tsx
// =========================================================
// ACCUEIL MARCHAND v1.0 — Lot 12
// Même mise en page que l'accueil client : fond blanc, solde marchand en grand avec le drapeau de la devise et
// « Masquer / Afficher le solde », une ligne « Aujourd'hui », deux boutons (Encaisser / Retirer mes gains) et les
// deux derniers paiements. Encaisser ouvre l'écran QR / téléphone Orange Money ; réglages et historique complet
// sont dans « Profil ».
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { useLoader } from "../wallet/useLoader";
import { toNum } from "../wallet/walletTheme";
import { Text } from "../ui/Text";
import { BalanceBlock, HomeTopBar, useBalanceHidden } from "../home/HomeParts";
import { Button, EmptyView, ErrorView, Notice, Screen, SectionHeader, SkeletonRows, UText, initials, useUI } from "../ui";
import { PAYMENT_STATUS_LABEL, money, shortDateTime } from "../merchant/merchantUi";

function PaymentLine({ p, last, onPress }: { p: PaymentRequestView; last: boolean; onPress: () => void }) {
  const { C } = useUI();
  const name = p.payer?.name ?? (p.method === "QR" ? "Paiement par QR" : p.payerPhone ?? "Client");
  const when = shortDateTime(p.paidAt ?? p.createdAt);
  const sub = p.status === "PAID" ? `${when} · ${p.method === "QR" ? "QR code" : "Orange"}` : `${PAYMENT_STATUS_LABEL[p.status]} · ${when}`;
  const paid = p.status === "PAID";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#444444" }}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <UText v="bodyStrong" numberOfLines={1}>{name}</UText>
        <UText v="caption" tone="muted" numberOfLines={1}>{sub}</UText>
      </View>
      <UText v="bodyStrong" color={paid ? C.pos : C.muted} numberOfLines={1}>
        {paid ? "+" : ""}{money(p.netAmount ?? p.amount, p.currency)}
      </UText>
    </Pressable>
  );
}

export default function MerchantDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [hidden, toggleHidden] = useBalanceHidden();

  const { data, status, error, refreshing, reload, refresh } = useLoader(async () => {
    const [me, summary, wallets, payments] = await Promise.all([
      api.getMerchantMe(),
      api.getMerchantSummary().catch(() => null),
      api.getMyWallets().catch(() => []),
      api.listMerchantPayments({ page: 1 }).catch(() => null),
    ]);
    refreshUser().catch(() => { /* sans incidence */ });
    return { me, summary, wallets, payments: (payments?.data ?? []).filter((p) => p.isMine === "PAYEE").slice(0, 2) };
  });

  const currency = user?.primaryCurrency ?? data?.summary?.total[0]?.currency ?? data?.wallets[0]?.currency ?? "XOF";
  const wallet = data?.wallets.find((w) => w.currency === currency) ?? data?.wallets[0];
  const balance = toNum(wallet?.balance ?? 0) - toNum(wallet?.reservedBalance ?? 0);
  const today = data?.summary?.today.find((t) => t.currency === currency) ?? data?.summary?.today[0];
  const profile = data?.me.profile ?? null;
  const suspended = profile?.status === "SUSPENDED";
  const { C } = useUI();

  if (status === "error" && !data) {
    return (
      <Screen tabSpace>
        <ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <HomeTopBar
        name={profile?.businessName ?? user?.firstName ?? "Mon commerce"}
        onScan={() => router.push("/pay/scan" as any)}
        onBell={() => router.push("/(tabs)/notifications")}
      />

      <BalanceBlock
        label="Solde marchand"
        amount={balance}
        currency={currency}
        countryName={(user as any)?.country}
        hidden={hidden}
        onToggle={toggleHidden}
        loading={status === "loading"}
      >
        {status !== "loading" && (
          <UText v="body" tone="muted" style={{ marginTop: 18 }}>
            Aujourd'hui : <Text style={{ color: C.ink, fontWeight: "700" }}>{hidden ? "••••" : money(today?.net ?? 0, today?.currency ?? currency)}</Text>
            {` · ${today?.count ?? 0} paiement${(today?.count ?? 0) > 1 ? "s" : ""}`}
          </UText>
        )}
      </BalanceBlock>

      {suspended ? (
        <Notice tone="danger" title="Encaissements suspendus" style={{ marginTop: 22 }}>
          {profile?.suspendedReason ?? "Votre espace marchand est suspendu. Contactez l'assistance."}
        </Notice>
      ) : null}

      <View style={{ gap: 12, marginTop: 30 }}>
        <Button label="Encaisser" disabled={suspended} onPress={() => router.push("/merchant/collect" as any)} testID="home-collect" />
        <Button label="Retirer mes gains" kind="outline" onPress={() => router.push("/merchant/payouts" as any)} testID="home-payout" />
      </View>

      <SectionHeader title="Derniers paiements" action={data?.payments.length ? "Voir tout" : undefined} onAction={() => router.push("/merchant/payments" as any)} />
      {status === "loading" ? (
        <SkeletonRows rows={2} />
      ) : data && data.payments.length === 0 ? (
        <EmptyView icon="receipt-outline" title="Aucun paiement" message="Vos encaissements apparaîtront ici." />
      ) : (
        data?.payments.map((p, i, all) => (
          <PaymentLine key={p.id} p={p} last={i === all.length - 1} onPress={() => router.push({ pathname: "/merchant/payment", params: { id: p.id } } as any)} />
        ))
      )}
    </Screen>
  );
}
