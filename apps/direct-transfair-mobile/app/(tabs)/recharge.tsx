// apps/direct-transfair-mobile/app/(tabs)/recharge.tsx
// =========================================================
// ✅ phase 7 : URL Sendwave lue dans services/platformConfig.ts. Logique de recharge (y compris simulée) inchangée.
// RECHARGE WALLET v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE THÈME CLAIR — fond crème, grand montant, onglets de méthode
//    soulignés, champs arrondis et bouton pilule pleine largeur ; toutes les
//    couleurs viennent de la couleur de marque du tenant (components/ui/theme).
//    Typographie système (plus de Georgia/serif). LOGIQUE MÉTIER INCHANGÉE
//    (mêmes appels API, même polling Orange Money, même validation).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v1.2 : WHITE-LABEL — les couleurs vertes écrites en dur suivent la
//    couleur de marque du tenant. Aucune logique métier touchée.
// ✅ v1.1 :
//    - Orange Money : ajout d'un champ "Numéro Orange Money" (compte
//      débité), désormais obligatoire pour soumettre — voir
//      RechargeByMobileMoneyDto côté backend.
//    - Sendwave : ajout d'un bouton "Ouvrir Sendwave" (Linking) vers
//      https://www.sendwave.com, en attendant une vraie intégration
//      in-app (accords opérateur en cours).
// =========================================================
// - Carte : mock backend (succès immédiat).
// - Orange Money : auto-poll du statut (~20s) — le mock backend
//   simule un succès après ~2s (voir orange-money.service.ts).
// - Sendwave : pas de résolution automatique — bouton "Vérifier"
//   manuel, en attendant la confirmation admin (accords opérateur
//   en cours de négociation).
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { getSendwaveUrl } from "../../services/platformConfig";
import {
  AmountInput, Button, Card, Chip, Field, NavBar, Notice, Screen, Tabs, UText, useUI,
} from "../../components/ui";

const SENDWAVE_URL = getSendwaveUrl(); // ✅ phase 7 : modifiable (EXPO_PUBLIC_SENDWAVE_URL)

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return n.toFixed(d);
  }
}

const QUICK_AMOUNTS: Record<string, number[]> = {
  XOF: [5_000, 10_000, 25_000, 50_000, 100_000],
  GNF: [50_000, 100_000, 200_000, 500_000, 1_000_000],
  EUR: [10, 20, 50, 100, 200],
  USD: [10, 20, 50, 100, 200],
  GBP: [10, 20, 50, 100, 200],
};

function formatCardNumber(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

type Method = "CARD" | "ORANGE_MONEY" | "SENDWAVE";

const METHODS: Array<{ key: Method; label: string; icon: string }> = [
  { key: "CARD", label: "Carte", icon: "card-outline" },
  { key: "ORANGE_MONEY", label: "Orange Money", icon: "phone-portrait-outline" },
  { key: "SENDWAVE", label: "Sendwave", icon: "swap-horizontal-outline" },
];

export default function RechargeScreen() {
  const { C } = useUI();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const currency = ((user as any)?.primaryCurrency ?? "XOF") as string;
  const quickAmounts = QUICK_AMOUNTS[currency] ?? QUICK_AMOUNTS.XOF;

  const [balance, setBalance] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("CARD");
  const [amount, setAmount] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [momoPhone, setMomoPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ transactionId: string; method: Method } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef(0);

  useEffect(() => {
    api.getMyWallets()
      .then((wallets) => {
        const w = wallets.find((x) => x.currency === currency) ?? wallets[0];
        setBalance(w ? Number(w.balance) : 0);
      })
      .catch(() => setBalance(null));
  }, [currency]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const numAmount = parseFloat(amount) || 0;
  const canSubmit =
    numAmount > 0 &&
    (method !== "CARD" ||
      (cardName.trim().length > 0 &&
        cardNumber.replace(/\s/g, "").length >= 13 &&
        cardExpiry.length === 5 &&
        cardCvv.length >= 3)) &&
    (method !== "ORANGE_MONEY" || momoPhone.trim().length >= 8);

  const resetCardForm = () => {
    setCardName(""); setCardNumber(""); setCardExpiry(""); setCardCvv("");
  };

  const handleSuccess = useCallback(async (label: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPending(null);
    await refreshUser?.();
    api.getMyWallets().then((wallets) => {
      const w = wallets.find((x) => x.currency === currency);
      if (w) setBalance(Number(w.balance));
    }).catch(() => {});
    Alert.alert("✅ Recharge réussie", `${label} a bien été créditée sur votre wallet.`, [
      { text: "Retour au tableau de bord", onPress: () => router.back() },
    ]);
  }, [refreshUser, currency, router]);

  const pollOrangeMoney = useCallback((transactionId: string) => {
    pollAttempts.current = 0;
    pollRef.current = setInterval(async () => {
      pollAttempts.current += 1;
      try {
        const tx = await api.getRechargeStatus(transactionId);
        if (tx.status === "PAID") {
          void handleSuccess(`${fmt(numAmount, currency)} ${currency}`);
        } else if (pollAttempts.current >= 10) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }, [handleSuccess, numAmount, currency]);

  const handleCheckSendwave = async () => {
    if (!pending) return;
    setCheckingStatus(true);
    try {
      const tx = await api.getRechargeStatus(pending.transactionId);
      if (tx.status === "PAID") {
        await handleSuccess(`${fmt(numAmount, currency)} ${currency}`);
      } else {
        Alert.alert("En attente", "Ce paiement n'a pas encore été confirmé. Réessayez un peu plus tard.");
      }
    } catch {
      Alert.alert("Erreur", "Impossible de vérifier le statut pour le moment.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleOpenSendwave = () => {
    Linking.openURL(SENDWAVE_URL).catch(() => {
      Alert.alert("Erreur", "Impossible d'ouvrir Sendwave pour le moment.");
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (method === "CARD") {
        await api.rechargeByCard({
          amount: numAmount,
          currency,
          cardholderName: cardName.trim(),
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiry: cardExpiry,
        });
        resetCardForm();
        await handleSuccess(`${fmt(numAmount, currency)} ${currency}`);
      } else if (method === "ORANGE_MONEY") {
        const res = await api.rechargeByOrangeMoney(numAmount, currency, momoPhone.trim());
        setPending({ transactionId: res.transactionId, method: "ORANGE_MONEY" });
        pollOrangeMoney(res.transactionId);
      } else {
        const res = await api.rechargeBySendwave(numAmount, currency);
        setPending({ transactionId: res.transactionId, method: "SENDWAVE" });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "La recharge a échoué. Réessayez.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const changeMethod = (m: Method) => {
    setMethod(m);
    setPending(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  return (
    <Screen
      header={<NavBar title="Recharger mon wallet" onBack={() => router.back()} />}
      footer={
        <Button
          label="Recharger"
          icon="add-circle-outline"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit || submitting || !!pending}
        />
      }
    >
      {/* Solde actuel */}
      <UText v="overline" tone="muted" style={{ marginTop: 4 }}>Solde actuel</UText>
      <UText v="title" style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {balance === null ? "—" : `${fmt(balance, currency)} ${currency}`}
      </UText>

      {/* Méthode */}
      <Tabs
        style={{ marginTop: 22 }}
        items={METHODS.map((m) => ({ key: m.key, label: m.label }))}
        value={method}
        onChange={changeMethod}
      />

      {(method === "ORANGE_MONEY" || method === "SENDWAVE") && (
        <Notice tone="warn" style={{ marginTop: 16 }}>
          {method === "ORANGE_MONEY"
            ? "Intégration Orange Money en cours de finalisation avec l'opérateur. Le paiement est simulé pour le moment."
            : "Intégration Sendwave en cours de finalisation avec l'opérateur. Après paiement, la confirmation peut prendre un peu de temps."}
        </Notice>
      )}

      {/* Montant */}
      <View style={{ marginTop: 26 }}>
        <AmountInput label="MONTANT À CRÉDITER" value={amount} onChangeText={setAmount} currency={currency} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 2 }}>
          {quickAmounts.map((v) => (
            <Chip key={v} label={new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} active={numAmount === v} onPress={() => setAmount(String(v))} />
          ))}
        </ScrollView>
      </View>

      {/* Orange Money : compte débité */}
      {method === "ORANGE_MONEY" && (
        <View style={{ marginTop: 26 }}>
          <Field
            label="Numéro Orange Money"
            icon="call-outline"
            value={momoPhone}
            onChangeText={setMomoPhone}
            placeholder="+224 6XX XX XX XX"
            keyboardType="phone-pad"
            hint="Le montant sera débité de ce compte Orange Money."
          />
        </View>
      )}

      {/* Sendwave : paiement externe pour le moment */}
      {method === "SENDWAVE" && (
        <View style={{ marginTop: 20 }}>
          <Button label="Ouvrir Sendwave pour payer" kind="outline" icon="open-outline" onPress={handleOpenSendwave} />
        </View>
      )}

      {/* Carte bancaire */}
      {method === "CARD" && (
        <View style={{ marginTop: 26 }}>
          <UText v="overline" tone="muted" style={{ marginBottom: 12 }}>Carte bancaire</UText>
          <Field
            label="Titulaire"
            value={cardName}
            onChangeText={setCardName}
            placeholder="NOM PRÉNOM"
            autoCapitalize="characters"
          />
          <Field
            label="Numéro de carte"
            icon="card-outline"
            value={cardNumber}
            onChangeText={(t) => setCardNumber(formatCardNumber(t))}
            placeholder="0000 0000 0000 0000"
            keyboardType="numeric"
            maxLength={19}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Expiration"
                value={cardExpiry}
                onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                placeholder="MM/AA"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="CVV"
                value={cardCvv}
                onChangeText={(t) => setCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                placeholder="•••"
                keyboardType="numeric"
                maxLength={4}
                secure
              />
            </View>
          </View>
          <UText v="caption" tone="muted">🔒 Le CVV n'est jamais stocké.</UText>
        </View>
      )}

      {/* Recharge en attente (Orange Money / Sendwave) */}
      {pending && (
        <Card tone="outline" style={{ marginTop: 22, alignItems: "center", gap: 10 }}>
          {pending.method === "ORANGE_MONEY" ? (
            <>
              <ActivityIndicator color={C.ink} />
              <UText v="bodyStrong" align="center">Confirmation Orange Money en cours…</UText>
            </>
          ) : (
            <>
              <UText v="bodyStrong" align="center">En attente de confirmation Sendwave</UText>
              <UText v="caption" tone="muted" align="center">
                Référence : {pending.transactionId.slice(0, 8).toUpperCase()}
              </UText>
              <Button label="Vérifier le statut" kind="soft" small full={false} loading={checkingStatus} onPress={handleCheckSendwave} />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
