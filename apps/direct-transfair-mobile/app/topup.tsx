// apps/direct-transfair-mobile/app/topup.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon).
// =========================================================
// TOP-UP SCREEN v7.0 — Direct Transf'air
// ✅ v7.0 : RECHARGE RÉELLEMENT BRANCHÉE SUR LE SERVEUR
//    - Avant : après 2 s d'attente, l'écran appelait api.updateProfile({ balance: ancien + montant }).
//      Le serveur ignore ce champ (liste blanche du profil) : l'écran affichait « Paiement réussi »
//      sans que le solde bouge. Désormais : POST /payments/recharge/card ou /orange-money,
//      puis suivi du statut (Orange Money) et rafraîchissement du profil.
//    - Les moyens proposés viennent de la société (GET /payments/recharge/options, réglage « Recharge »
//      de l'admin). Aucun moyen ouvert → message clair au lieu d'un formulaire inutilisable.
//    - Devise = celle du compte (plus de « EUR » écrit en dur).
//    - Le CVV n'est plus saisi : le serveur ne l'a jamais accepté (PCI-DSS). Un vrai prestataire de
//      paiement fournira ses propres champs sécurisés.
//    - Bandeau « mode simulation » tant qu'aucun prestataire réel n'est branché.
// ✅ v6.0 : thème clair, onglets Carte / Orange Money, aperçu de carte aux couleurs de la société,
//    paramètre d'URL ?method=orange|card respecté.
// ✅ v5.1 : WHITE-LABEL — couleurs suivent la couleur de marque du tenant.
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "../components/ui/Icon";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";
import { AmountInput, Button, Chip, Field, IconButton, Notice, Screen, Tabs, UText, useUI } from "../components/ui";

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

type UiMethod = "CARD" | "OM";
/** Correspondance entre l'onglet de l'écran et le code du moyen côté serveur. */
const SERVER_CODE: Record<UiMethod, string> = { CARD: "CARD", OM: "ORANGE_MONEY" };

const POLL_EVERY_MS = 1500;
const POLL_MAX = 10;

/** Message d'erreur serveur lisible (même schéma que les autres écrans). */
function errMsg(e: any, fallback: string): string {
  const m = e?.response?.data?.message;
  const txt = Array.isArray(m) ? m[0] : m;
  return typeof txt === "string" && txt ? txt : fallback;
}

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n); }
  catch { return n.toString(); }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function TopUpScreen() {
  const { C, R } = useUI();
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string }>();
  const { user, refreshUser } = useAuth();
  const currency = String((user as any)?.currency ?? (user as any)?.primaryCurrency ?? "EUR");

  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const wantedOm = String(params?.method ?? "").toLowerCase().startsWith("orange");
  const [method, setMethod] = useState<UiMethod>(wantedOm ? "OM" : "CARD");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Moyens ouverts par la société : null = chargement, [] = aucun
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await api.getRechargeOptions();
        if (!alive) return;
        setEnabled(o.methods);
        setBlocked(o.blocked);
        setOptionsError(null);
      } catch (e) {
        if (!alive) return;
        setEnabled([]);
        setOptionsError(errMsg(e, "Impossible de charger les moyens de recharge."));
      }
    })();
    return () => { alive = false; };
  }, []);

  const tabItems = ([
    { key: "CARD" as UiMethod, label: "Carte", icon: "card-outline" as const },
    { key: "OM" as UiMethod, label: "Orange Money", icon: "phone-portrait-outline" as const },
  ]).filter((t) => (enabled ?? []).includes(SERVER_CODE[t.key]));

  // Si l'onglet courant n'est pas ouvert par la société, bascule sur le premier disponible.
  useEffect(() => {
    if (tabItems.length > 0 && !tabItems.some((t) => t.key === method)) setMethod(tabItems[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const numAmount = parseFloat(amount.replace(",", ".")) || 0;
  const cardDigits = cardNumber.replace(/\D/g, "");
  const canPay =
    tabItems.length > 0 &&
    numAmount >= 1 &&
    (method === "CARD"
      ? cardHolder.trim().length >= 2 && cardDigits.length >= 13 && /^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)
      : mobileNumber.replace(/\D/g, "").length >= 9);

  const handleClose = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/home"); };

  const onExpiryChange = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setCardExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  };

  const handleTopUp = () => {
    if (!canPay) { Alert.alert("Données manquantes", "Veuillez compléter tous les champs."); return; }
    const label = method === "CARD" ? "par carte" : "par Orange Money";
    Alert.alert("Confirmation", `Recharger ${fmt(numAmount)} ${currency} ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "PAYER", onPress: () => void processPayment() },
    ]);
  };

  /** Orange Money : le crédit arrive après validation de l'opérateur → on interroge le statut. */
  const waitForSettlement = async (transactionId: string): Promise<"PAID" | "FAILED" | "PENDING"> => {
    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_EVERY_MS);
      if (!mounted.current) return "PENDING";
      const tx = await api.getRechargeStatus(transactionId);
      const st = String((tx as any)?.status ?? "").toUpperCase();
      if (st === "PAID") return "PAID";
      if (st === "FAILED" || st === "CANCELLED") return "FAILED";
    }
    return "PENDING";
  };

  const processPayment = async () => {
    setLoading(true);
    try {
      let outcome: "PAID" | "FAILED" | "PENDING";
      if (method === "CARD") {
        const tx = await api.rechargeByCard({
          amount: numAmount,
          currency,
          cardholderName: cardHolder.trim(),
          cardNumber: cardDigits,
          expiry: cardExpiry,
        });
        const st = String((tx as any)?.status ?? "").toUpperCase();
        outcome = st === "PAID" ? "PAID" : st === "FAILED" || st === "CANCELLED" ? "FAILED" : "PENDING";
      } else {
        const started = await api.rechargeByOrangeMoney(numAmount, currency, mobileNumber.trim());
        outcome = await waitForSettlement(started.transactionId);
      }

      await refreshUser();
      if (!mounted.current) return;

      if (outcome === "PAID") {
        Alert.alert("✅ Recharge effectuée", `Votre compte a été crédité de ${fmt(numAmount)} ${currency}.`, [
          { text: "Super", onPress: handleClose },
        ]);
      } else if (outcome === "PENDING") {
        Alert.alert(
          "Recharge en cours",
          "Le paiement n'est pas encore confirmé. Votre solde sera mis à jour dès la validation.",
          [{ text: "OK", onPress: handleClose }],
        );
      } else {
        Alert.alert("Recharge refusée", "Le paiement n'a pas abouti. Aucun montant n'a été débité de votre compte.");
      }
    } catch (e) {
      Alert.alert("Erreur", errMsg(e, "Le rechargement a échoué. Réessayez."));
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const previewNumber = cardDigits.length > 0 ? cardDigits.replace(/(.{4})/g, "$1 ").trim() : "•••• •••• •••• ••••";

  return (
    <Screen
      header={
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, minHeight: 64, gap: 12 }}>
          <UText v="heading" style={{ flex: 1 }}>Recharger le compte</UText>
          <IconButton icon="close" label="Fermer" onPress={handleClose} />
        </View>
      }
      footer={
        tabItems.length > 0 ? (
          <Button
            label={`Payer ${numAmount > 0 ? `${fmt(numAmount)} ${currency}` : ""} ${method === "CARD" ? "par carte" : "par Orange Money"}`.replace(/\s+/g, " ").trim()}
            icon={method === "CARD" ? "card-outline" : "phone-portrait-outline"}
            onPress={handleTopUp}
            loading={loading}
            disabled={!canPay || loading}
          />
        ) : undefined
      }
    >
      {enabled === null ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : tabItems.length === 0 ? (
        <Notice tone="info" icon="information-circle-outline">
          {optionsError
            ? optionsError
            : blocked
              ? "La recharge du compte n'est pas encore disponible."
              : "Aucun moyen de recharge n'est ouvert par votre société pour le moment. Contactez votre agence."}
        </Notice>
      ) : (
        <>
          {/* Montant */}
          <AmountInput label="MONTANT À AJOUTER" value={amount} onChangeText={setAmount} currency={currency} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {QUICK_AMOUNTS.map((v) => (
              <Chip key={v} label={`${v}`} active={numAmount === v} onPress={() => setAmount(String(v))} />
            ))}
          </ScrollView>

          {/* Méthode (un seul moyen ouvert → pas d'onglets) */}
          {tabItems.length > 1 ? (
            <Tabs style={{ marginTop: 26, marginBottom: 22 }} items={tabItems} value={method} onChange={setMethod} />
          ) : (
            <View style={{ height: 22 }} />
          )}

          <Notice tone="info" icon="information-circle-outline">
            Mode simulation : aucun vrai prélèvement n'est effectué, le compte est crédité à titre de test.
          </Notice>
          <View style={{ height: 16 }} />

          {method === "CARD" ? (
            <>
              {/* Aperçu de la carte, aux couleurs de la société */}
              <View style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: 20, height: 150, justifyContent: "space-between", marginBottom: 22 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Ionicons name="card-outline" size={24} color={C.accentInk} style={{ opacity: 0.75 }} />
                  <View style={{ width: 36, height: 26, borderRadius: 5, backgroundColor: C.accentInk, opacity: 0.25 }} />
                </View>
                <UText v="subheading" color={C.accentInk} style={{ letterSpacing: 2 }} numberOfLines={1}>{previewNumber}</UText>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <UText v="label" color={C.accentInk} style={{ textTransform: "uppercase", flex: 1, opacity: 0.85 }} numberOfLines={1}>
                    {cardHolder || "Nom du titulaire"}
                  </UText>
                  <UText v="label" color={C.accentInk} style={{ opacity: 0.85 }}>{cardExpiry || "MM/AA"}</UText>
                </View>
              </View>

              <Field label="Nom du titulaire" value={cardHolder} onChangeText={setCardHolder} placeholder="Jean DUPONT" autoCapitalize="words" />
              <Field
                label="Numéro de carte"
                icon="card-outline"
                value={cardNumber}
                onChangeText={(v: string) => setCardNumber(v.replace(/\D/g, "").slice(0, 19))}
                placeholder="0000 0000 0000 0000"
                keyboardType="numeric"
                maxLength={19}
              />
              <Field label="Expiration" value={cardExpiry} onChangeText={onExpiryChange} placeholder="MM/AA" keyboardType="numeric" maxLength={5} />
            </>
          ) : (
            <>
              <Field
                label="Numéro Orange Money"
                icon="call-outline"
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder="Numéro complet avec indicatif"
                keyboardType="phone-pad"
              />
              <Notice tone="info" icon="information-circle-outline">
                Tu recevras un SMS pour valider le paiement Orange Money.
              </Notice>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
