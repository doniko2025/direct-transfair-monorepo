// apps/direct-transfair-mobile/app/topup.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// TOP-UP SCREEN v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR (modale) — fond crème, grand montant, puces de montants
//    rapides, onglets Carte / Orange Money soulignés, aperçu de carte aux couleurs de la
//    société, champs arrondis et bouton pilule collé en bas. Plus de bleu/orange/vert écrits
//    en dur, police système. Le paramètre d'URL ?method=orange|card (envoyé par l'écran
//    « Envoyer » quand le solde est insuffisant) est maintenant respecté : l'onglet
//    correspondant s'ouvre directement. Le faux drapeau/indicatif +221 (propre à un pays)
//    est retiré : le numéro Orange Money se saisit en entier.
//    LOGIQUE DE PAIEMENT INCHANGÉE (mêmes validations, même confirmation, même appel
//    api.updateProfile + refreshUser).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.1 : WHITE-LABEL — couleurs vertes suivent la couleur de marque du tenant.
// ✅ Carte bancaire + Orange Money · Montants rapides
// =========================================================

import React, { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '../components/ui/Icon';
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";
import { AmountInput, Button, Chip, Field, IconButton, Notice, Screen, Tabs, UText, useUI } from "../components/ui";

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n); }
  catch { return n.toString(); }
}

export default function TopUpScreen() {
  const { C, R } = useUI();
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string }>();
  const { user, refreshUser } = useAuth();

  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<"CARD" | "OM">(
    String(params?.method ?? "").toLowerCase().startsWith("orange") ? "OM" : "CARD",
  );
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const numAmount = parseFloat(amount) || 0;
  const canPay = numAmount >= 1 && (
    method === "CARD"
      ? cardHolder.trim().length >= 2 && cardNumber.length >= 16 && cardExpiry.length >= 4 && cardCvc.length >= 3
      : mobileNumber.length >= 9
  );

  const handleClose = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/home"); };

  const handleTopUp = () => {
    if (!canPay) { Alert.alert("Données manquantes", "Veuillez compléter tous les champs."); return; }
    const label = method === "CARD" ? "par carte" : "par Orange Money";
    Alert.alert("Confirmation", `Recharger ${fmt(numAmount)} EUR ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "PAYER", onPress: () => void processPayment() },
    ]);
  };

  const processPayment = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const cur = user?.balance ? Number(user.balance) : 0;
      await api.updateProfile({ balance: cur + numAmount } as any);
      await refreshUser();
      Alert.alert("✅ Paiement réussi", `Votre compte a été crédité de ${fmt(numAmount)} EUR.`, [{ text: "Super", onPress: handleClose }]);
    } catch {
      Alert.alert("Erreur", "Le rechargement a échoué. Réessayez.");
    } finally { setLoading(false); }
  };

  const previewNumber = cardNumber.length > 0 ? cardNumber.replace(/(.{4})/g, "$1 ").trim() : "•••• •••• •••• ••••";

  return (
    <Screen
      header={
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, minHeight: 64, gap: 12 }}>
          <UText v="heading" style={{ flex: 1 }}>Recharger le compte</UText>
          <IconButton icon="close" label="Fermer" onPress={handleClose} />
        </View>
      }
      footer={
        <Button
          label={`Payer ${numAmount > 0 ? `${fmt(numAmount)} EUR` : ""} ${method === "CARD" ? "par carte" : "par Orange Money"}`.replace(/\s+/g, " ").trim()}
          icon={method === "CARD" ? "card-outline" : "phone-portrait-outline"}
          onPress={handleTopUp}
          loading={loading}
          disabled={!canPay || loading}
        />
      }
    >
      {/* Montant */}
      <AmountInput label="MONTANT À AJOUTER" value={amount} onChangeText={setAmount} currency="EUR" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {QUICK_AMOUNTS.map((v) => (
          <Chip key={v} label={`${v} €`} active={numAmount === v} onPress={() => setAmount(String(v))} />
        ))}
      </ScrollView>

      {/* Méthode */}
      <Tabs
        style={{ marginTop: 26, marginBottom: 22 }}
        items={[
          { key: "CARD", label: "Carte", icon: "card-outline" },
          { key: "OM", label: "Orange Money", icon: "phone-portrait-outline" },
        ]}
        value={method}
        onChange={setMethod}
      />

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
            onChangeText={setCardNumber}
            placeholder="0000 0000 0000 0000"
            keyboardType="numeric"
            maxLength={16}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Expiration" value={cardExpiry} onChangeText={setCardExpiry} placeholder="MM/AA" keyboardType="numeric" maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CVV" value={cardCvc} onChangeText={setCardCvc} placeholder="•••" keyboardType="numeric" maxLength={3} secure />
            </View>
          </View>
          <UText v="caption" tone="muted">🔒 Paiement sécurisé · 3D Secure</UText>
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
    </Screen>
  );
}
