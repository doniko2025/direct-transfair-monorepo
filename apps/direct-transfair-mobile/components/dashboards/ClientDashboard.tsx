// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// ACCUEIL CLIENT v13.0 — Lot 12 : « le plus simple possible »
// Fond blanc pur. Salutation + scan QR + notifications, solde en grand avec le drapeau de la devise et
// « Masquer / Afficher le solde », deux boutons seulement (Envoyer de l'argent / Recharger) et les deux dernières
// opérations. Le calculateur « couloir », les raccourcis (taux, QR…) et le bouton flottant ont quitté l'accueil :
// taux, QR personnel, bénéficiaires et paiement par QR sont dans « Profil ».
// Logique conservée : refreshUser + getTransactions bornés (useLoader), solde disponible = solde − réservé.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { useLoader } from "../wallet/useLoader";
import { toNum } from "../wallet/walletTheme";
import { useKycStatus } from "../../hooks/useKycStatus";
import { BalanceBlock, HomeTopBar, useBalanceHidden } from "../home/HomeParts";
import { Button, EmptyView, ErrorView, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, TxRow } from "../ui";

const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir," : "Bonjour,";
}

export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { status: kyc } = useKycStatus();
  const [hidden, toggleHidden] = useBalanceHidden();

  const rawCountry = ((user as any)?.country ?? "").trim().toUpperCase().substring(0, 2);
  const currency: string = (user as any)?.primaryCurrency || COUNTRY_CURRENCY[rawCountry] || "XOF";
  const wallets = (user as any)?.wallets ?? [];
  const mainWallet = wallets.find((w: any) => w.currency === currency) ?? wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reserved = toNum(mainWallet?.reservedBalance ?? 0);
  const available = balance - reserved;

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<any[]>(async () => {
    const [, rawTxs] = await Promise.allSettled([refreshUser(), api.getTransactions({ limit: 10 })]);
    if (rawTxs.status === "rejected") throw rawTxs.reason;
    const safe = Array.isArray(rawTxs.value) ? rawTxs.value : [];
    return [...safe].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2);
  });
  const recent = data ?? [];

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <HomeTopBar
        greeting={greeting()}
        name={user?.firstName ?? "Client"}
        onScan={() => router.push("/pay/scan" as any)}
        onBell={() => router.push("/(tabs)/notifications")}
      />

      <BalanceBlock
        label="Solde disponible"
        amount={available}
        currency={currency}
        countryName={(user as any)?.country}
        hidden={hidden}
        onToggle={toggleHidden}
      />

      <View style={{ gap: 12, marginTop: 40 }}>
        <Button label="Envoyer de l'argent" onPress={() => router.push("/(tabs)/send")} testID="home-send" />
        <Button label="Recharger" kind="outline" onPress={() => router.push("/(tabs)/recharge")} testID="home-topup" />
      </View>

      {kyc && !kyc.verified ? (
        <Notice
          tone={kyc.status === "PENDING" ? "info" : "warn"}
          style={{ marginTop: 22 }}
          action={kyc.status === "PENDING" ? undefined : "Vérifier mon identité"}
          onAction={kyc.status === "PENDING" ? undefined : () => router.push("/(tabs)/profile/kyc" as any)}
        >
          {kyc.status === "PENDING"
            ? "Votre pièce d'identité est en cours de vérification."
            : "Vérifiez votre identité pour envoyer de l'argent."}
        </Notice>
      ) : null}

      <SectionHeader title="Activité récente" action={recent.length ? "Voir tout" : undefined} onAction={() => router.push("/(tabs)/transactions")} />
      {status === "loading" ? (
        <>
          <SkeletonRows rows={2} />
          <SlowNote visible={slow} />
        </>
      ) : status === "error" ? (
        <ErrorView compact title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} />
      ) : recent.length === 0 ? (
        <EmptyView icon="receipt-outline" title="Aucune opération" message="Vos envois et réceptions apparaîtront ici." />
      ) : (
        recent.map((tx, i) => (
          <TxRow key={tx.id ?? i} tx={tx} userId={user?.id} last={i === recent.length - 1} onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)} />
        ))
      )}
    </Screen>
  );
}
