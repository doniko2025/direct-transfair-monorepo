// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// ACCUEIL CLIENT v13.1 — Lot 12 : « le plus simple possible »
// ✅ v13.1 : COMPTES SÉPARÉS — « Activité récente » ne liste que les opérations du compte client (space=client) ; bascule
//    « Compte client | Compte marchand » affichée sous la barre du haut quand la personne a aussi un compte marchand.
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
import { filterBySpace } from "../../services/accountSpace";
import { useLoader } from "../wallet/useLoader";
import { toNum } from "../wallet/walletTheme";
import { useKycStatus } from "../../hooks/useKycStatus";
import { BalanceBlock, HomeTopBar, useBalanceHidden } from "../home/HomeParts";
import { SpaceSwitch } from "../home/SpaceSwitch";
import { Button, EmptyView, ErrorView, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, TxRow } from "../ui";
import { useT } from "../../providers/I18nProvider";

const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};


export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const t = useT();
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
    const [, rawTxs] = await Promise.allSettled([refreshUser(), api.getTransactions({ limit: 10, space: "client" })]);
    if (rawTxs.status === "rejected") throw rawTxs.reason;
    // Double sécurité : uniquement les opérations du compte client, même si le serveur renvoyait tout.
    const safe = filterBySpace(Array.isArray(rawTxs.value) ? rawTxs.value : [], "client", user?.id);
    return [...safe].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2);
  });
  const recent = data ?? [];

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <HomeTopBar
        greeting={new Date().getHours() < 5 || new Date().getHours() >= 18 ? t("home.evening") : t("home.hello")}
        name={user?.firstName ?? t("home.defaultName")}
        onScan={() => router.push("/pay/scan" as any)}
        onBell={() => router.push("/(tabs)/notifications")}
      />

      <SpaceSwitch style={{ marginTop: 4 }} />

      <BalanceBlock
        label={t("home.balance")}
        amount={available}
        currency={currency}
        countryName={(user as any)?.country}
        hidden={hidden}
        onToggle={toggleHidden}
      />

      <View style={{ gap: 12, marginTop: 60 }}>
        <Button label={t("home.send")} onPress={() => router.push("/(tabs)/send")} testID="home-send" />
        <Button label={t("home.topup")} kind="outline" onPress={() => router.push("/(tabs)/recharge")} testID="home-topup" />
      </View>

      {kyc && !kyc.verified ? (
        <Notice
          tone={kyc.status === "PENDING" ? "info" : "warn"}
          style={{ marginTop: 22 }}
          action={kyc.status === "PENDING" ? undefined : kyc.status === "PARTIAL" ? t("home.kycComplete") : t("home.kycVerify")}
          onAction={kyc.status === "PENDING" ? undefined : () => router.push("/(tabs)/profile/kyc" as any)}
        >
          {kyc.status === "PENDING"
            ? t("home.kycPending")
            : kyc.status === "PARTIAL"
              ? t("home.kycPartial")
              : t("home.kycNone")}
        </Notice>
      ) : null}

      <SectionHeader title={t("home.recent")} action={recent.length ? t("home.seeAll") : undefined} onAction={() => router.push("/(tabs)/transactions")} />
      {status === "loading" ? (
        <>
          <SkeletonRows rows={2} />
          <SlowNote visible={slow} />
        </>
      ) : status === "error" ? (
        <ErrorView compact title={error?.title ?? t("state.error")} message={error?.message ?? t("state.loadFailed")} onRetry={reload} />
      ) : recent.length === 0 ? (
        <EmptyView icon="receipt-outline" title={t("home.noTx")} message={t("home.noTxMsg")} />
      ) : (
        recent.map((tx, i) => (
          <TxRow key={tx.id ?? i} tx={tx} userId={user?.id} last={i === recent.length - 1} onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)} />
        ))
      )}
    </Screen>
  );
}
