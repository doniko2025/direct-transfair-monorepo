// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// CLIENT DASHBOARD v11.0 — Direct Transf'air
// ✅ v11.0 : 🔥 REFONTE TOTALE en thème clair (maquette « Flash Transfert / Accueil »). Fond crème, salutation
//    + cloche, carte de solde blanche qui se fond vers la couleur d'accent de la société, actions rondes
//    (Envoyer en noir), envoi rapide, bilan du mois en gros chiffres, activité récente en lignes à filets.
//    Tout vient du design system components/ui (aucune couleur ni nom de société codé en dur).
//    Logique INCHANGÉE : refreshUser + getTransactions({limit:30}) + getExchangeRates en chargement borné
//    (useLoader, 20 s), solde disponible / réservé, stats du mois, contacts récents, navigation.
// ✅ v10.0 : refonte « wallet » (en-tête de marque) et chargements bornés (fin des spinners infinis).
// ✅ v9.x : historique des refontes précédentes (hero sombre, carte solde, actions rapides, correctifs
//    d'encoche Android, bandeau de taux) — remplacé par la v11.0.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { useLoader } from "../wallet/useLoader";
import { formatMoney, toNum } from "../wallet/walletTheme";
import {
  Avatar, BalanceCard, Card, EmptyView, ErrorView, IconButton, Screen, SectionHeader, SkeletonRows, SlowNote, TxRow, UText, useUI,
} from "../ui";

// ─── Helpers métier — logique inchangée ───────────────────
function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate), now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

type DashData = { txs: any[]; eurXofRate: number | null };

// ─── Écran ────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { C } = useUI();
  const [hidden, setHidden] = useState(false);

  const firstName = user?.firstName ?? "Client";
  const fullName  = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  // ── Données wallet (identiques à la v9.x) ──
  const rawCountry      = ((user as any)?.country ?? "").trim().toUpperCase().substring(0, 2);
  const primaryCurrency = (user as any)?.primaryCurrency || COUNTRY_CURRENCY[rawCountry] || "XOF";
  const wallets         = (user as any)?.wallets ?? [];
  const mainWallet      = wallets.find((w: any) => w.currency === primaryCurrency)
    ?? wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance          = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reservedBalance  = toNum(mainWallet?.reservedBalance ?? 0);
  const availableBalance = balance - reservedBalance;

  // ── Chargement borné : transactions + taux (le solde vient de refreshUser) ──
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<DashData>(async () => {
    const [, rawTxs, rates] = await Promise.allSettled([
      refreshUser(),
      api.getTransactions({ limit: 30 }),
      api.getExchangeRates(),
    ]);
    if (rawTxs.status === "rejected") throw rawTxs.reason;
    const safe = Array.isArray(rawTxs.value) ? rawTxs.value : [];
    const txs = [...safe]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    let eurXofRate: number | null = null;
    if (rates.status === "fulfilled" && Array.isArray(rates.value)) {
      const pair = rates.value.find((r: any) => r.pair === "EUR/XOF" || r.pair === "EUR_XOF");
      if (pair?.rate) eurXofRate = Number(pair.rate);
    }
    return { txs, eurXofRate };
  });

  const txs = data?.txs ?? [];
  const eurXofRate = data?.eurXofRate ?? null;

  // ── Stats mensuelles (logique inchangée) ──
  const monthTxs  = txs.filter((t) => isThisMonth(t.createdAt));
  const monthSent = monthTxs
    .filter((t) => t.senderId === user?.id && t.status === "PAID")
    .reduce((acc, t) => acc + toNum(t.amount), 0);
  const monthRecv = monthTxs
    .filter((t) => (t.recipientId === user?.id || (t.senderId !== user?.id && !t.beneficiaryId)) && t.status === "PAID")
    .reduce((acc, t) => {
      const hasConv = t.targetCurrency && t.targetCurrency !== t.currency && toNum(t.receivedAmount) > 0;
      return acc + (hasConv ? toNum(t.receivedAmount) : toNum(t.amount));
    }, 0);

  // ── Contacts récents (logique inchangée) ──
  const recentContacts = (() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; phone?: string; beneficiaryId?: string }> = [];
    for (const tx of txs) {
      if (tx.senderId !== user?.id) continue;
      const name  = tx.beneficiary?.fullName ?? tx.recipient?.firstName;
      const phone = tx.beneficiary?.phone ?? tx.recipient?.phone;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name, phone, beneficiaryId: tx.beneficiaryId });
      if (result.length >= 6) break;
    }
    return result;
  })();

  const recentTxs = txs.slice(0, 5);
  const rateLabel = eurXofRate != null ? `1 EUR = ${formatMoney(eurXofRate, "XOF")} XOF` : null;

  const actions: { icon: string; label: string; route: string; dark?: boolean }[] = [
    { icon: "paper-plane", label: "Envoyer", route: "/(tabs)/send", dark: true },
    { icon: "add", label: "Recharger", route: "/(tabs)/recharge" },
    { icon: "swap-horizontal", label: "Taux", route: "/(tabs)/rates" },
    { icon: "qr-code-outline", label: "QR Code", route: "/(tabs)/qr" },
  ];

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      {/* ── Salutation + notifications ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 18 }}>
        <Pressable onPress={() => router.push("/(tabs)/profile")} accessibilityLabel="Mon compte">
          <Avatar name={fullName || firstName} size={46} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="caption" tone="muted">{greeting()}</UText>
          <UText v="heading" numberOfLines={1}>{firstName}</UText>
        </View>
        <IconButton icon="notifications-outline" label="Notifications" onPress={() => router.push("/(tabs)/notifications")} />
      </View>

      <SlowNote visible={slow} />

      <BalanceCard
        currency={primaryCurrency}
        available={availableBalance}
        reserved={reservedBalance}
        hidden={hidden}
        onToggleHidden={() => setHidden((h) => !h)}
        rateLabel={rateLabel}
        onPressRate={() => router.push("/(tabs)/rates")}
      />

      {/* ── Actions rondes ── */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingHorizontal: 4 }}>
        {actions.map((a) => (
          <View key={a.label} style={{ alignItems: "center", gap: 8, flex: 1 }}>
            <IconButton icon={a.icon} size={60} kind={a.dark ? "dark" : "soft"} label={a.label} onPress={() => router.push(a.route as any)} />
            <UText v="label">{a.label}</UText>
          </View>
        ))}
      </View>

      {/* ── Envoi rapide ── */}
      {recentContacts.length > 0 && (
        <View>
          <SectionHeader title="Envoi rapide" action="Tous" onAction={() => router.push("/(tabs)/beneficiaries")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 8 }}>
            {recentContacts.map((c, i) => (
              <Pressable
                key={`${c.name}-${i}`}
                style={{ alignItems: "center", gap: 8, width: 66 }}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/send",
                    params: c.beneficiaryId ? { beneficiaryId: c.beneficiaryId } : { phone: c.phone, name: c.name },
                  })
                }
              >
                <Avatar name={c.name} size={58} />
                <UText v="label" numberOfLines={1}>{c.name.split(" ")[0]}</UText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Ce mois-ci ── */}
      <SectionHeader title="Ce mois-ci" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Card style={{ flex: 1 }} pad={16}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="arrow-up" size={14} color={C.muted} />
            <UText v="label" tone="muted">Envoyé</UText>
          </View>
          <UText v="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 6 }}>
            {hidden ? "••••" : formatMoney(monthSent, primaryCurrency)}
          </UText>
          <UText v="label" tone="muted">{primaryCurrency}</UText>
        </Card>
        <Card style={{ flex: 1 }} pad={16}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="arrow-down" size={14} color={C.pos} />
            <UText v="label" tone="muted">Reçu</UText>
          </View>
          <UText v="title" tone="pos" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 6 }}>
            {hidden ? "••••" : formatMoney(monthRecv, primaryCurrency)}
          </UText>
          <UText v="label" tone="muted">{primaryCurrency}</UText>
        </Card>
      </View>

      {/* ── Activité récente ── */}
      <SectionHeader title="Activité récente" action="Voir tout" onAction={() => router.push("/(tabs)/transactions")} />
      {status === "loading" ? (
        <SkeletonRows rows={3} />
      ) : status === "error" ? (
        <ErrorView compact title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
      ) : recentTxs.length === 0 ? (
        <EmptyView
          icon="receipt-outline"
          title="Aucune transaction"
          message="Tes envois et réceptions apparaîtront ici."
          actionLabel="Envoyer de l'argent"
          onAction={() => router.push("/(tabs)/send")}
        />
      ) : (
        recentTxs.map((tx, i) => (
          <TxRow key={tx.id ?? i} tx={tx} userId={user?.id} last={i === recentTxs.length - 1} onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)} />
        ))
      )}
    </Screen>
  );
}
