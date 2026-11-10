// apps/direct-transfair-mobile/components/dashboards/MerchantDashboard.tsx
// =========================================================
// ACCUEIL MARCHAND v2.0 — compte SÉPARÉ du compte client
// ✅ v2.0 : le solde affiché est celui du COMMERCE (portefeuille marchand propre, renvoyé par le résumé marchand) — plus jamais le solde du
//    compte client. Un commerce neuf affiche 0 et aucun paiement. Bascule « Compte client | Compte marchand » sous la barre du haut.
// (v1.0 — Lot 12)
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
import { SpaceSwitch } from "../home/SpaceSwitch";
import { Button, EmptyView, ErrorView, Notice, Screen, SectionHeader, SkeletonRows, UText, initials, useUI } from "../ui";
import { PAYMENT_STATUS_LABEL, money, shortDateTime } from "../merchant/merchantUi";
import { useT } from "../../providers/I18nProvider";

function PaymentLine({ p, last, onPress }: { p: PaymentRequestView; last: boolean; onPress: () => void }) {
  const { C } = useUI();
  const t = useT();
  const name = p.payer?.name ?? (p.method === "QR" ? t("mhome.qrPayment") : p.payerPhone ?? t("mhome.customer"));
  const when = shortDateTime(p.paidAt ?? p.createdAt);
  const sub = p.status === "PAID" ? `${when} · ${p.method === "QR" ? t("mhome.viaQr") : "Orange"}` : `${PAYMENT_STATUS_LABEL[p.status]} · ${when}`;
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
  const t = useT();
  const [hidden, toggleHidden] = useBalanceHidden();

  const { data, status, error, refreshing, reload, refresh } = useLoader(async () => {
    const [me, summary, payments] = await Promise.all([
      api.getMerchantMe(),
      api.getMerchantSummary().catch(() => null),
      api.listMerchantPayments({ page: 1 }).catch(() => null),
    ]);
    refreshUser().catch(() => { /* sans incidence */ });
    return { me, summary, payments: (payments?.data ?? []).filter((p) => p.isMine === "PAYEE").slice(0, 2) };
  });

  // Solde du COMMERCE uniquement (portefeuille marchand). Aucun portefeuille = rien encaissé = 0.
  const shopWallets = data?.summary?.wallets ?? [];
  const currency = user?.primaryCurrency ?? shopWallets[0]?.currency ?? data?.summary?.total[0]?.currency ?? "XOF";
  const wallet = shopWallets.find((w) => w.currency === currency) ?? shopWallets[0];
  const balance = toNum(wallet?.available ?? 0);
  const today = data?.summary?.today.find((x) => x.currency === currency) ?? data?.summary?.today[0];
  const profile = data?.me.profile ?? null;
  const suspended = profile?.status === "SUSPENDED";
  const { C } = useUI();

  if (status === "error" && !data) {
    return (
      <Screen tabSpace>
        <ErrorView title={error?.title ?? t("state.error")} message={error?.message ?? t("state.loadFailed")} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <HomeTopBar
        name={profile?.businessName ?? user?.firstName ?? t("mhome.myShop")}
        onScan={() => router.push("/merchant/collect" as any)}
        scanIcon="qr-code-outline"
        scanLabel={t("mhome.collect")}
        onBell={() => router.push("/(tabs)/notifications")}
      />

      <SpaceSwitch style={{ marginTop: 4 }} />

      <BalanceBlock
        label={t("mhome.balance")}
        amount={balance}
        currency={currency}
        countryName={(user as any)?.country}
        hidden={hidden}
        onToggle={toggleHidden}
        loading={status === "loading"}
      >
        {status !== "loading" && (
          <UText v="body" tone="muted" style={{ marginTop: 18 }}>
            {t("mhome.today")}<Text style={{ color: C.ink, fontWeight: "700" }}>{hidden ? "••••" : money(today?.net ?? 0, today?.currency ?? currency)}</Text>
            {` · ${t("mhome.payments", { count: today?.count ?? 0 })}`}
            {(today?.refundsCount ?? 0) > 0 ? ` · ${hidden ? "••" : t("mhome.refunded", { count: today?.refundsCount ?? 0 })}` : ""}
          </UText>
        )}
      </BalanceBlock>

      {suspended ? (
        <Notice tone="danger" title={t("mhome.suspendedTitle")} style={{ marginTop: 22 }}>
          {profile?.suspendedReason ?? t("mhome.suspendedMsg")}
        </Notice>
      ) : null}

      <View style={{ gap: 12, marginTop: 30 }}>
        <Button label={t("mhome.collect")} disabled={suspended} onPress={() => router.push("/merchant/collect" as any)} testID="home-collect" />
        <Button label={t("mhome.payout")} kind="outline" onPress={() => router.push("/merchant/payouts" as any)} testID="home-payout" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button label={t("mhome.staticQr")} icon="qr-code-outline" kind="soft" small disabled={suspended} onPress={() => router.push("/merchant/qr" as any)} testID="home-static-qr" /></View>
          <View style={{ flex: 1 }}><Button label={t("mhome.closing")} icon="lock-closed-outline" kind="soft" small onPress={() => router.push("/merchant/closing" as any)} testID="home-closing" /></View>
        </View>
      </View>

      <SectionHeader title={t("mhome.lastPayments")} action={data?.payments.length ? t("home.seeAll") : undefined} onAction={() => router.push("/merchant/payments" as any)} />
      {status === "loading" ? (
        <SkeletonRows rows={2} />
      ) : data && data.payments.length === 0 ? (
        <EmptyView icon="receipt-outline" title={t("mhome.noPayments")} message={t("mhome.noPaymentsMsg")} />
      ) : (
        data?.payments.map((p, i, all) => (
          <PaymentLine key={p.id} p={p} last={i === all.length - 1} onPress={() => router.push({ pathname: "/merchant/payment", params: { id: p.id } } as any)} />
        ))
      )}
    </Screen>
  );
}
