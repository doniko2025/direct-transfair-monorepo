// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// ✅ v14.1 : enveloppe animée des demandes d'argent reçues (RequestEnvelope) juste sous la barre du haut.
// ACCUEIL CLIENT v14.0 — design « E » : carte de solde à la couleur de marque + carte « Envoyer de l'argent » qui la chevauche
// ✅ v14.0 : polices réduites (voir HomeParts v2.0), prénom qui rétrécit au lieu d'être coupé, bascule client/marchand plus espacée sous la barre du haut,
//    carte d'envoi (montant → « Ils reçoivent » au taux du jour → Continuer vers l'écran d'envoi, montant pré-rempli), raccourcis ronds
//    Recharger · Demander · Parrainer · Factures (GrowthCards v2.0), activité récente compacte. LOGIQUE CONSERVÉE : refreshUser +
//    getTransactions bornés (useLoader), solde disponible = solde − réservé, comptes séparés, KYC, factures ouvertes par la société.
// (v13.1) ACCUEIL CLIENT — Lot 12 : « le plus simple possible »
// ✅ v13.1 : COMPTES SÉPARÉS — « Activité récente » ne liste que les opérations du compte client (space=client) ; bascule
//    « Compte client | Compte marchand » affichée sous la barre du haut quand la personne a aussi un compte marchand.
// Fond blanc pur. Salutation + scan QR + notifications, solde en grand avec le drapeau de la devise et
// « Masquer / Afficher le solde », deux boutons seulement (Envoyer de l'argent / Recharger) et les deux dernières
// opérations. Le calculateur « couloir », les raccourcis (taux, QR…) et le bouton flottant ont quitté l'accueil :
// taux, QR personnel, bénéficiaires et paiement par QR sont dans « Profil ».
// Logique conservée : refreshUser + getTransactions bornés (useLoader), solde disponible = solde − réservé.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useState } from "react";
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
import { EmptyView, ErrorView, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, TxRow } from "../ui";
import { useT } from "../../providers/I18nProvider";
import GrowthCards from "../home/GrowthCards"; // lot 16 — raccourcis ronds (v2.0)
import ExpressSendCard from "../home/ExpressSendCard"; // design E
import RequestEnvelope from "../home/RequestEnvelope"; // enveloppe animée : demande d'argent reçue
import RepeatSendChip from "../home/RepeatSendChip"; // lot 19 — « Renvoyer » le dernier envoi en un geste
import { userCurrency } from "../../utils/currency";



export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const t = useT();
  const { status: kyc } = useKycStatus();
  const [hidden, toggleHidden] = useBalanceHidden();
  // Lot 14 : « Payer mes factures » n'apparaît que si la société l'a ouvert (et si le serveur est à jour).
  const [billsOpen, setBillsOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    api.getBillOptions().then((o) => { if (alive) setBillsOpen(!!o.enabled); }).catch(() => { if (alive) setBillsOpen(false); });
    return () => { alive = false; };
  }, []);

  const currency: string = userCurrency(user);
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

      {/* Bascule plus bas sous le prénom (22 px) : elle ne colle plus à la salutation. */}
      <SpaceSwitch style={{ marginTop: 22 }} />

      {/* Quelqu'un vous a demandé de l'argent : l'enveloppe s'ouvre dès l'arrivée sur l'accueil (rien si aucune demande). */}
      <RequestEnvelope />

      <BalanceBlock
        label={t("home.balance")}
        amount={available}
        currency={currency}
        countryName={(user as any)?.country}
        hidden={hidden}
        onToggle={toggleHidden}
        overlap
      />

      {/* La carte d'envoi chevauche le bas de la carte de solde. */}
      <ExpressSendCard currency={currency} countryName={(user as any)?.country} style={{ marginTop: -30, marginHorizontal: 10 }} />

      <GrowthCards billsOpen={billsOpen} onTopup={() => router.push("/(tabs)/recharge")} />

      <RepeatSendChip />

      {kyc && !kyc.verified ? (
        <Notice
          tone={kyc.status === "PENDING" ? "info" : "warn"}
          style={{ marginTop: 18 }}
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

      <SectionHeader compact title={t("home.recent")} action={recent.length ? t("home.seeAll") : undefined} onAction={() => router.push("/(tabs)/transactions")} />
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
          <TxRow compact key={tx.id ?? i} tx={tx} userId={user?.id} last={i === recent.length - 1} onPress={() => router.push(`/operation/${tx.id}` as any)} />
        ))
      )}
    </Screen>
  );
}
