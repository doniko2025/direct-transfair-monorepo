// apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
// =========================================================
// PAYMENT METHODS v7.0 — Direct Transf'air
// ✅ v7.0 : REFONTE THÈME CLAIR — grand titre, cartes bancaires et comptes Mobile Money en
//    lignes à filet (pastille d'icône beige, bouton « Lier » / puce « Lié » discrets),
//    ajout de carte et liaison de numéro dans des feuilles basses claires, aperçu de carte
//    en temps réel aux couleurs de la société (texte auto-contrasté) au lieu du dégradé
//    sombre fixe. Chargement borné via useLoader (20 s) avec squelette et « Réessayer »
//    (avant : simple Alert en cas d'erreur). Plus de bleu/orange/vert écrits en dur.
//    LOGIQUE INCHANGÉE (GET /payments/methods, POST /payments/cards sans CVV — jamais
//    envoyé ni stocké —, DELETE /payments/cards/:id, PATCH /payments/mobile-wallet pour
//    lier / délier, mêmes validations et formatages, titulaire en ligne principale).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v6.4 : WHITE-LABEL + chargement borné (20 s).
// ✅ v6.3 : titulaire affiché dans la liste des cartes (repli « {brand} ···· {last4} »).
// ✅ v6.2 : formulaire d'ajout de carte complet (titulaire, CVV non envoyé, aperçu live,
//    formatage numéro / expiration, détection de marque purement visuelle).
// ✅ v6.1 : api.http (x-tenant-id ajouté automatiquement).
// =========================================================

import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useLoader } from "../../../components/wallet/useLoader";
import {
  Button, EmptyView, ErrorView, Field, IconButton, ListRow, NavBar, Pill, Screen, SectionHeader, Sheet, SkeletonRows, SlowNote, StatusDot, UText, useUI,
} from "../../../components/ui";

// ─── Config UI des providers (aucune valeur métier en dur) ─
const WALLET_CONFIG: Record<string, { label: string; icon: string }> = {
  ORANGE_MONEY: { label: "Orange Money", icon: "phone-portrait-outline" },
  SENDWAVE: { label: "Wave", icon: "swap-horizontal-outline" },
};

// ─── Types ─────────────────────────────────────────────
type Card = {
  id: string;
  // nullable : vide pour les cartes ajoutées avant le fix backend (add-card.dto.ts v1.1)
  cardholderName?: string | null;
  last4: string;
  expiry: string;
  brand: string;
  isDefault: boolean;
};

type MobileWallet = {
  provider: string;
  number: string | null;
  isLinked: boolean;
  recordId: string | null;
};

type Methods = { cards: Card[]; mobileWallets: MobileWallet[] };

// ─── Helpers de formatage / détection carte ──────────────
function formatCardNumber(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
function detectBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "VISA";
  if (/^5[1-5]/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  return "CARTE";
}

// ─── Aperçu de carte en temps réel (couleur de la société) ─
function CardPreview({ number, name, expiry }: { number: string; name: string; expiry: string }) {
  const { C, R } = useUI();
  const digits = number.replace(/\D/g, "");
  const groups = [0, 1, 2, 3].map((i) => {
    const slice = digits.slice(i * 4, i * 4 + 4);
    return slice.length > 0 ? slice.padEnd(4, "•") : "••••";
  });
  return (
    <View style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: 20, height: 168, justifyContent: "space-between", marginBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Ionicons name="wifi" size={20} color={C.accentInk} style={{ opacity: 0.6, transform: [{ rotate: "90deg" }] }} />
        <UText v="overline" color={C.accentInk}>{detectBrand(number)}</UText>
      </View>
      <UText v="subheading" color={C.accentInk} style={{ letterSpacing: 2 }} numberOfLines={1}>{groups.join("  ")}</UText>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="overline" color={C.accentInk} style={{ opacity: 0.6 }}>Titulaire</UText>
          <UText v="label" color={C.accentInk} numberOfLines={1} style={{ marginTop: 3 }}>
            {name.trim() ? name.trim().toUpperCase() : "VOTRE NOM"}
          </UText>
        </View>
        <View>
          <UText v="overline" color={C.accentInk} style={{ opacity: 0.6 }}>Exp.</UText>
          <UText v="label" color={C.accentInk} style={{ marginTop: 3 }}>{expiry || "MM/AA"}</UText>
        </View>
      </View>
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const { C } = useUI();
  const router = useRouter();

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<Methods>(async () => {
    const res = await api.http.get<{ cards: Card[]; mobileWallets: MobileWallet[] }>("/payments/methods");
    return { cards: res.data.cards ?? [], mobileWallets: res.data.mobileWallets ?? [] };
  });
  const cards = data?.cards ?? [];
  const mobileWallets = data?.mobileWallets ?? [];

  const [saving, setSaving] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Champs : titulaire + CVV (CVV jamais envoyé au backend)
  const [newCardName, setNewCardName] = useState("");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardCvv, setNewCardCvv] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const resetCardForm = () => {
    setNewCardName(""); setNewCardNumber(""); setNewCardExpiry(""); setNewCardCvv("");
  };

  // ⚠️ Le CVV (newCardCvv) n'est INTENTIONNELLEMENT PAS envoyé dans le payload ci-dessous.
  const handleAddCard = async () => {
    const cleanNumber = newCardNumber.replace(/\s/g, "");
    const cleanName = newCardName.trim();

    if (!cleanName) { Alert.alert("Erreur", "Le nom du titulaire est requis."); return; }
    if (cleanNumber.length < 13) { Alert.alert("Erreur", "Numéro de carte invalide."); return; }
    if (newCardExpiry.length < 5) { Alert.alert("Erreur", "Date d'expiration invalide."); return; }
    if (newCardCvv.length < 3) { Alert.alert("Erreur", "Code de sécurité (CVV) invalide."); return; }

    try {
      setSaving(true);
      await api.http.post("/payments/cards", {
        cardholderName: cleanName,
        cardNumber: cleanNumber,
        expiry: newCardExpiry,
        // cvv volontairement omis — non persisté côté backend (PCI-DSS)
      });
      setShowCardModal(false);
      resetCardForm();
      await refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Erreur lors de l'ajout";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    Alert.alert("Supprimer la carte", "Confirmer la suppression ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await api.http.delete(`/payments/cards/${cardId}`);
            await refresh();
          } catch (e: any) {
            const msg = e?.response?.data?.message ?? e?.message ?? "Erreur";
            Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleLinkWallet = async () => {
    if (newPhone.trim().length < 8) { Alert.alert("Erreur", "Numéro invalide"); return; }
    try {
      setSaving(true);
      await api.http.patch("/payments/mobile-wallet", { provider: selectedProvider, number: newPhone.trim() });
      setShowPhoneModal(false);
      setNewPhone("");
      await refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Erreur de liaison";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkWallet = async (provider: string) => {
    Alert.alert("Délier le compte", `Délier ${WALLET_CONFIG[provider]?.label ?? provider} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Délier",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await api.http.patch("/payments/mobile-wallet", { provider, number: null });
            await refresh();
          } catch (e: any) {
            const msg = e?.response?.data?.message ?? e?.message ?? "Erreur";
            Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      header={<NavBar title="Moyens de paiement" subtitle="Cartes & Mobile Money" onBack={() => router.back()} />}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={3} />
        </>
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? "Chargement impossible"} message={error?.message ?? "Réessaie dans un instant."} onRetry={() => void reload()} />
      ) : (
        <>
          {/* Cartes bancaires */}
          <SectionHeader title="Cartes bancaires" style={{ marginTop: 4 }} />
          {cards.map((card) => (
            <ListRow
              key={card.id}
              icon="card-outline"
              // titulaire en ligne principale, repli sur « {brand} ···· {last4} » si absent
              title={card.cardholderName ? card.cardholderName.toUpperCase() : `${card.brand} ···· ${card.last4}`}
              subtitle={card.cardholderName ? `${card.brand} ···· ${card.last4} · Expire ${card.expiry}` : `Expire ${card.expiry}`}
              right={
                <IconButton icon="trash-outline" label="Supprimer la carte" kind="plain" onPress={() => handleDeleteCard(card.id)} />
              }
            />
          ))}
          <View style={{ marginTop: 14 }}>
            <Button label="Ajouter une carte bancaire" kind="outline" icon="add-circle-outline" onPress={() => setShowCardModal(true)} />
          </View>

          {/* Mobile Money */}
          <SectionHeader title="Mobile Money" />
          {mobileWallets.length === 0 && (
            <EmptyView icon="phone-portrait-outline" title="Aucun compte Mobile Money configuré" />
          )}
          {mobileWallets.map((wallet, i) => {
            const config = WALLET_CONFIG[wallet.provider] ?? { label: wallet.provider, icon: "wallet-outline" };
            return (
              <ListRow
                key={wallet.provider}
                icon={config.icon}
                title={config.label}
                subtitle={wallet.isLinked ? wallet.number ?? "" : "Non lié"}
                last={i === mobileWallets.length - 1}
                right={
                  wallet.isLinked ? (
                    <Pressable
                      onPress={() => handleUnlinkWallet(wallet.provider)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel={`Délier ${config.label}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <StatusDot color={C.pos} label="Lié" />
                    </Pressable>
                  ) : (
                    <Pill
                      label="Lier"
                      tone="dark"
                      style={{ opacity: saving ? 0.5 : 1 }}
                    />
                  )
                }
                onPress={wallet.isLinked ? undefined : () => { setSelectedProvider(wallet.provider); setShowPhoneModal(true); }}
              />
            );
          })}
        </>
      )}

      {/* Feuille : ajout de carte (aperçu live + titulaire + CVV) */}
      <Sheet
        visible={showCardModal}
        onClose={() => { setShowCardModal(false); resetCardForm(); }}
        title="Ajouter une carte"
        footer={<Button label="Ajouter la carte" onPress={handleAddCard} loading={saving} disabled={saving} />}
      >
        <View style={{ paddingTop: 8 }}>
          <CardPreview number={newCardNumber} name={newCardName} expiry={newCardExpiry} />
          <Field label="Titulaire de la carte" value={newCardName} onChangeText={setNewCardName} placeholder="NOM PRÉNOM" autoCapitalize="characters" />
          <Field
            label="Numéro de carte"
            icon="card-outline"
            value={newCardNumber}
            onChangeText={(t) => setNewCardNumber(formatCardNumber(t))}
            placeholder="0000 0000 0000 0000"
            keyboardType="numeric"
            maxLength={19}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Expiration" value={newCardExpiry} onChangeText={(t) => setNewCardExpiry(formatExpiry(t))} placeholder="MM/AA" keyboardType="numeric" maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CVV" value={newCardCvv} onChangeText={(t) => setNewCardCvv(t.replace(/\D/g, "").slice(0, 4))} placeholder="•••" keyboardType="numeric" maxLength={4} secure />
            </View>
          </View>
          <UText v="caption" tone="muted">🔒 Tes informations sont chiffrées. Le CVV n'est jamais stocké.</UText>
        </View>
      </Sheet>

      {/* Feuille : liaison d'un numéro Mobile Money */}
      <Sheet
        visible={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        title={`Lier ${selectedProvider ? (WALLET_CONFIG[selectedProvider]?.label ?? selectedProvider) : ""}`}
        footer={<Button label="Lier ce numéro" onPress={handleLinkWallet} loading={saving} disabled={saving} />}
      >
        <View style={{ paddingTop: 8 }}>
          <Field
            label="Numéro Mobile Money"
            icon="call-outline"
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="+224 6XX XX XX XX"
            keyboardType="phone-pad"
            autoFocus
          />
        </View>
      </Sheet>
    </Screen>
  );
}
