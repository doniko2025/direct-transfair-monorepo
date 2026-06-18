// apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
// =========================================================
// PAYMENT METHODS v6.2 — Direct Transf'air
// ✅ v6.1 : Remplacement du fetch brut par api.http
//           Le fetch brut n'envoyait pas x-tenant-id
//           → TenantGuard rejetait avant d'atteindre la route
//           → "Cannot GET /payments/methods"
//           api.http ajoute automatiquement x-tenant-id via l'intercepteur
// ✅ v6.2 : FORMULAIRE D'AJOUT DE CARTE — refonte complète
//    PROBLÈME : formulaire minimal (numéro + expiration seulement),
//    pas de nom du titulaire, pas de CVV, pas de formatage de saisie.
//    AJOUTS :
//    - Champ "Titulaire de la carte" (cardholderName), envoyé au backend
//    - Champ CVV (3-4 chiffres, secureTextEntry) — ⚠️ collecté pour la
//      complétude du formulaire mais JAMAIS envoyé au backend ni stocké.
//      Règle PCI-DSS de base : le CVV ne doit jamais être persisté,
//      même chiffré, après une autorisation. Si un vrai prestataire de
//      paiement (Stripe, etc.) tokenise la carte côté client, le CVV
//      doit lui être transmis directement, jamais via votre propre API.
//    - Aperçu de carte en temps réel (CardPreview) : numéro masqué,
//      titulaire, expiration, et badge de marque détectée
//    - Formatage automatique du numéro de carte (espace tous les 4
//      chiffres) et de l'expiration (MM/AA avec "/" auto-inséré)
//    - Détection de marque (Visa/Mastercard/Amex) côté client, purement
//      visuelle pour l'aperçu — le backend reste seul responsable du
//      champ `brand` retourné et affiché dans la liste des cartes
//    - Validation étendue : nom non vide, CVV 3-4 chiffres
//    Logique de chargement/suppression/liaison wallet mobile inchangée.
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api"; // ✅ v6.1 — import api.http

// ─── Thème ─────────────────────────────────────────────
const T = {
  bg:         "#F0FDF4",
  surface:    "#FFFFFF",
  border:     "#D1FAE5",
  text:       "#0F172A",
  textSub:    "#475569",
  textDim:    "#94A3B8",
  accent:     "#059669",
  accentSoft: "#DCFCE7",
  blue:       "#0284C7",
  blueSoft:   "#E0F2FE",
  orange:     "#D97706",
  orangeSoft: "#FED7AA",
  red:        "#DC2626",
  redSoft:    "#FEE2E2",
  green:      "#16A34A",
  radius: { sm: 10, md: 14, lg: 20, xl: 28 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Config UI des providers (aucune valeur métier en dur) ─
const WALLET_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ORANGE_MONEY: { label: "Orange Money", color: T.orange, icon: "briefcase" },
  SENDWAVE:     { label: "Wave",         color: T.blue,   icon: "penguin"   },
};

// ─── Types ─────────────────────────────────────────────
type Card = {
  id: string;
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

// ─── ✅ v6.2 — Helpers de formatage / détection carte ─────
function formatCardNumber(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
function detectBrand(cardNumber: string): { label: string; icon: string } {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits))        return { label: "VISA",       icon: "card" };
  if (/^5[1-5]/.test(digits))   return { label: "MASTERCARD",  icon: "card" };
  if (/^3[47]/.test(digits))    return { label: "AMEX",        icon: "card" };
  if (digits.length === 0)      return { label: "CARTE",       icon: "card-outline" };
  return { label: "CARTE", icon: "card-outline" };
}

// ─── ✅ v6.2 — Aperçu de carte en temps réel ──────────────
function CardPreview({
  number, name, expiry,
}: { number: string; name: string; expiry: string }) {
  const brand = detectBrand(number);
  const digits = number.replace(/\D/g, "");
  const groups = [0, 1, 2, 3].map((i) => {
    const slice = digits.slice(i * 4, i * 4 + 4);
    return slice.length > 0 ? slice.padEnd(4, "•") : "••••";
  });
  return (
    <LinearGradient
      colors={["#1E293B", "#0F172A"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={cp.card}
    >
      <View style={cp.topRow}>
        <Ionicons name="wifi" size={18} color="rgba(255,255,255,0.55)" style={{ transform: [{ rotate: "90deg" }] }} />
        <Text style={[cp.brand, { fontFamily: T.font.sans }]}>{brand.label}</Text>
      </View>
      <Text style={[cp.number, { fontFamily: T.font.mono }]}>{groups.join("  ")}</Text>
      <View style={cp.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={[cp.label, { fontFamily: T.font.sans }]}>TITULAIRE</Text>
          <Text style={[cp.value, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {name.trim() ? name.trim().toUpperCase() : "VOTRE NOM"}
          </Text>
        </View>
        <View>
          <Text style={[cp.label, { fontFamily: T.font.sans }]}>EXP.</Text>
          <Text style={[cp.value, { fontFamily: T.font.mono }]}>{expiry || "MM/AA"}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}
const cp = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 18, marginBottom: 18,
    height: 160, justifyContent: "space-between",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12 },
      android: { elevation: 5 },
      default: {},
    }),
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand:  { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  number: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", letterSpacing: 1.5 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  label:  { color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 3 },
  value:  { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});

// ─── Light Modal ───────────────────────────────────────
function LightModal({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dmS.overlay}>
        <View style={dmS.sheet}>
          <View style={dmS.handle} />
          <View style={dmS.headerRow}>
            <Text style={[dmS.title, { fontFamily: T.font.display }]}>{title}</Text>
            <TouchableOpacity style={dmS.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={T.textDim} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
const dmS = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.15)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: T.surface, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, maxHeight: "88%", borderWidth: 1, borderColor: T.border, paddingBottom: 30 },
  handle:    { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  title:     { color: T.text, fontSize: 18, fontWeight: "700" },
  closeBtn:  { width: 32, height: 32, borderRadius: T.radius.sm, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
});

// ─── Main Screen ───────────────────────────────────────
export default function PaymentMethodsScreen() {
  const router = useRouter();

  const [cards,         setCards]         = useState<Card[]>([]);
  const [mobileWallets, setMobileWallets] = useState<MobileWallet[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);

  const [showCardModal,   setShowCardModal]   = useState(false);
  const [showPhoneModal,  setShowPhoneModal]  = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // ✅ v6.2 — nouveaux champs : titulaire + CVV (CVV jamais envoyé au backend)
  const [newCardName,   setNewCardName]   = useState("");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardCvv,    setNewCardCvv]    = useState("");
  const [newPhone,      setNewPhone]      = useState("");

  const resetCardForm = () => {
    setNewCardName("");
    setNewCardNumber("");
    setNewCardExpiry("");
    setNewCardCvv("");
  };

  // ── ✅ v6.1 : Chargement via api.http (x-tenant-id ajouté automatiquement) ──
  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.http.get<{ cards: Card[]; mobileWallets: MobileWallet[] }>(
        "/payments/methods"
      );
      setCards(res.data.cards ?? []);
      setMobileWallets(res.data.mobileWallets ?? []);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Impossible de charger les moyens de paiement";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMethods(); }, [fetchMethods]);

  // ── ✅ v6.2 : Ajouter une carte — validation étendue (nom + CVV) ──
  // ⚠️ Le CVV (newCardCvv) n'est INTENTIONNELLEMENT PAS envoyé dans le
  // payload ci-dessous — voir le commentaire d'en-tête du fichier.
  const handleAddCard = async () => {
    const cleanNumber = newCardNumber.replace(/\s/g, "");
    const cleanName   = newCardName.trim();

    if (!cleanName) {
      Alert.alert("Erreur", "Le nom du titulaire est requis.");
      return;
    }
    if (cleanNumber.length < 13) {
      Alert.alert("Erreur", "Numéro de carte invalide.");
      return;
    }
    if (newCardExpiry.length < 5) {
      Alert.alert("Erreur", "Date d'expiration invalide.");
      return;
    }
    if (newCardCvv.length < 3) {
      Alert.alert("Erreur", "Code de sécurité (CVV) invalide.");
      return;
    }

    try {
      setSaving(true);
      await api.http.post("/payments/cards", {
        cardholderName: cleanName,
        cardNumber:     cleanNumber,
        expiry:         newCardExpiry,
        // cvv volontairement omis — non persisté côté backend (PCI-DSS)
      });
      setShowCardModal(false);
      resetCardForm();
      await fetchMethods();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Erreur lors de l'ajout";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSaving(false);
    }
  };

  // ── ✅ v6.1 : Supprimer une carte via api.http ──
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
            await fetchMethods();
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

  // ── ✅ v6.1 : Lier un wallet mobile via api.http ──
  const handleLinkWallet = async () => {
    if (newPhone.trim().length < 8) {
      Alert.alert("Erreur", "Numéro invalide");
      return;
    }
    try {
      setSaving(true);
      await api.http.patch("/payments/mobile-wallet", {
        provider: selectedProvider,
        number: newPhone.trim(),
      });
      setShowPhoneModal(false);
      setNewPhone("");
      await fetchMethods();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Erreur de liaison";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSaving(false);
    }
  };

  // ── ✅ v6.1 : Délier un wallet mobile via api.http ──
  const handleUnlinkWallet = async (provider: string) => {
    Alert.alert("Délier le compte", `Délier ${WALLET_CONFIG[provider]?.label ?? provider} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Délier",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await api.http.patch("/payments/mobile-wallet", {
              provider,
              number: null,
            });
            await fetchMethods();
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
    <LinearGradient colors={[T.bg, "rgba(220,252,231,0.5)"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Moyens de Paiement</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>
              Cartes & Mobile Money
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Cartes bancaires ── */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>CARTES BANCAIRES</Text>
            </View>

            {cards.map((card) => (
              <View key={card.id} style={s.card}>
                <View style={[s.iconBox, { backgroundColor: T.blueSoft }]}>
                  <Ionicons name="card" size={20} color={T.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardName, { fontFamily: T.font.sans }]}>
                    {card.brand} ···· {card.last4}
                  </Text>
                  <Text style={[s.cardExp, { fontFamily: T.font.mono }]}>Expire {card.expiry}</Text>
                </View>
                <TouchableOpacity
                  style={s.deleteCardBtn}
                  onPress={() => handleDeleteCard(card.id)}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={16} color={T.red} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={s.addCard} onPress={() => setShowCardModal(true)} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={18} color={T.blue} />
              <Text style={[s.addCardTxt, { color: T.blue, fontFamily: T.font.sans }]}>
                Ajouter une carte bancaire
              </Text>
            </TouchableOpacity>

            {/* ── Mobile Money ── */}
            <View style={[s.sectionRow, { marginTop: 20 }]}>
              <View style={[s.sectionDot, { backgroundColor: T.orange }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MOBILE MONEY</Text>
            </View>

            {mobileWallets.length === 0 && (
              <View style={s.emptyWallets}>
                <Ionicons name="phone-portrait-outline" size={22} color={T.textDim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>
                  Aucun compte Mobile Money configuré
                </Text>
              </View>
            )}

            {mobileWallets.map((wallet) => {
              const config = WALLET_CONFIG[wallet.provider] ?? {
                label: wallet.provider, color: T.textSub, icon: "wallet",
              };
              return (
                <View key={wallet.provider} style={s.card}>
                  <View style={[s.iconBox, { backgroundColor: `${config.color}18` }]}>
                    <MaterialCommunityIcons name={config.icon as any} size={20} color={config.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardName, { fontFamily: T.font.sans }]}>{config.label}</Text>
                    <Text style={[s.cardExp, { fontFamily: T.font.mono }, !wallet.isLinked && { color: T.textDim }]}>
                      {wallet.isLinked ? wallet.number : "Non lié"}
                    </Text>
                  </View>
                  {wallet.isLinked ? (
                    <TouchableOpacity
                      style={[s.linkedBadge, { borderColor: `${T.green}40` }]}
                      onPress={() => handleUnlinkWallet(wallet.provider)}
                      disabled={saving}
                    >
                      <Ionicons name="checkmark-circle" size={14} color={T.green} />
                      <Text style={[s.linkedTxt, { fontFamily: T.font.sans }]}>Lié</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.linkBtn, { backgroundColor: `${config.color}15`, borderColor: config.color }]}
                      onPress={() => { setSelectedProvider(wallet.provider); setShowPhoneModal(true); }}
                      disabled={saving}
                    >
                      <Text style={[s.linkTxt, { color: config.color, fontFamily: T.font.sans }]}>Lier</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        {/* ── Modal Carte — ✅ v6.2 : refonte avec aperçu live + nom + CVV ── */}
        <LightModal
          visible={showCardModal}
          onClose={() => { setShowCardModal(false); resetCardForm(); }}
          title="Ajouter une Carte"
        >
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <CardPreview number={newCardNumber} name={newCardName} expiry={newCardExpiry} />

            <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>TITULAIRE DE LA CARTE</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.sans, textTransform: "uppercase" }]}
              value={newCardName} onChangeText={setNewCardName}
              placeholder="NOM PRÉNOM" placeholderTextColor={T.textDim}
              autoCapitalize="characters"
            />

            <Text style={[s.inputLabel, { fontFamily: T.font.sans, marginTop: 14 }]}>NUMÉRO DE CARTE</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.mono }]}
              value={newCardNumber}
              onChangeText={(t) => setNewCardNumber(formatCardNumber(t))}
              placeholder="0000 0000 0000 0000" placeholderTextColor={T.textDim}
              keyboardType="numeric" maxLength={19}
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>EXPIRATION</Text>
                <TextInput
                  style={[s.input, { fontFamily: T.font.mono }]}
                  value={newCardExpiry}
                  onChangeText={(t) => setNewCardExpiry(formatExpiry(t))}
                  placeholder="MM/AA" placeholderTextColor={T.textDim}
                  keyboardType="numeric" maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>CVV</Text>
                <TextInput
                  style={[s.input, { fontFamily: T.font.mono }]}
                  value={newCardCvv}
                  onChangeText={(t) => setNewCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                  placeholder="•••" placeholderTextColor={T.textDim}
                  keyboardType="numeric" maxLength={4} secureTextEntry
                />
              </View>
            </View>

            <View style={s.secureNote}>
              <Ionicons name="lock-closed" size={12} color={T.textDim} />
              <Text style={[s.secureNoteTxt, { fontFamily: T.font.sans }]}>
                Vos informations sont chiffrées. Le CVV n'est jamais stocké.
              </Text>
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={handleAddCard} activeOpacity={0.85} disabled={saving}>
              <LinearGradient colors={[T.blue, "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmGrad}>
                {saving
                  ? <ActivityIndicator color={T.surface} />
                  : <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>AJOUTER LA CARTE</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </LightModal>

        {/* ── Modal Wallet ── */}
        <LightModal
          visible={showPhoneModal}
          onClose={() => setShowPhoneModal(false)}
          title={`Lier ${selectedProvider ? (WALLET_CONFIG[selectedProvider]?.label ?? selectedProvider) : ""}`}
        >
          <View style={{ padding: 20 }}>
            <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>NUMÉRO MOBILE MONEY</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.sans }]}
              value={newPhone} onChangeText={setNewPhone}
              placeholder="+224 6XX XX XX XX" placeholderTextColor={T.textDim}
              keyboardType="phone-pad" autoFocus
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleLinkWallet} activeOpacity={0.85} disabled={saving}>
              <LinearGradient colors={[T.accent, "#10B981"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmGrad}>
                {saving
                  ? <ActivityIndicator color={T.surface} />
                  : <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>LIER CE NUMÉRO</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LightModal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 12,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:    { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle:{ color: T.text, fontSize: 18, fontWeight: "700" },
  headerSub:  { fontSize: 11, fontWeight: "700", marginTop: 2 },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  sectionRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot:  { width: 6, height: 6, borderRadius: 99 },
  sectionLabel:{ fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox:       { width: 40, height: 40, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  cardName:      { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  cardExp:       { color: T.textDim, fontSize: 11, fontWeight: "600" },
  deleteCardBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.redSoft, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },

  addCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.blueSoft, borderRadius: T.radius.md, paddingVertical: 14, marginBottom: 20,
    borderWidth: 1.5, borderColor: T.blue, borderStyle: "dashed",
  },
  addCardTxt: { fontSize: 13, fontWeight: "800" },

  emptyWallets: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border },
  emptyTxt:     { color: T.textDim, fontSize: 12, fontWeight: "600" },

  linkedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${T.green}12`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: T.radius.sm, borderWidth: 1 },
  linkedTxt:   { color: T.green, fontSize: 11, fontWeight: "900" },
  linkBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: T.radius.sm, borderWidth: 1 },
  linkTxt:     { fontSize: 11, fontWeight: "800" },

  inputLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  input:      { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.text, fontWeight: "600", marginBottom: 4 },
  secureNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  secureNoteTxt: { fontSize: 10.5, color: T.textDim, fontWeight: "600", flexShrink: 1 },
  confirmBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 20 },
  confirmGrad:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  confirmTxt: { color: T.surface, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
});