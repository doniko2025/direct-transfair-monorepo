// =========================================================
// PAYMENT METHODS v6.0 — Direct Transf'air
// ✅ Zéro donnée en dur — tout vient de l'API
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
import { useAuth } from "../../../providers/AuthProvider";

// ─── Thème ─────────────────────────────────────────────
const T = {
  bg: "#F0FDF4",
  surface: "#FFFFFF",
  border: "#D1FAE5",
  text: "#0F172A",
  textSub: "#475569",
  textDim: "#94A3B8",
  accent: "#059669",
  accentSoft: "#DCFCE7",
  blue: "#0284C7",
  blueSoft: "#E0F2FE",
  orange: "#D97706",
  orangeSoft: "#FED7AA",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  green: "#16A34A",
  radius: { sm: 10, md: 14, lg: 20, xl: 28 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Config statique des providers (UI uniquement) ─────
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

// ─── API helper ────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

function useApi(token: string | null) {
  return useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers ?? {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Erreur réseau");
      }
      return res.json();
    },
    [token],
  );
}

// ─── Light Modal ───────────────────────────────────────
function LightModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.15)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: T.radius.xl,
    borderTopRightRadius: T.radius.xl,
    maxHeight: "75%",
    borderWidth: 1,
    borderColor: T.border,
    paddingBottom: 30,
  },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  title: { color: T.text, fontSize: 18, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: T.radius.sm, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
});

// ─── Main Screen ───────────────────────────────────────
export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { user, token } = useAuth() as any;
  const api = useApi(token ?? null);

  const [cards, setCards] = useState<Card[]>([]);
  const [mobileWallets, setMobileWallets] = useState<MobileWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCardModal, setShowCardModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // ── Chargement initial ─────────────────────────────
  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("/payments/methods");
      setCards(data.cards ?? []);
      setMobileWallets(data.mobileWallets ?? []);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Impossible de charger les moyens de paiement");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void fetchMethods(); }, [fetchMethods]);

  // ── Ajouter une carte ──────────────────────────────
  const handleAddCard = async () => {
    const clean = newCardNumber.replace(/\s/g, "");
    if (clean.length < 13 || newCardExpiry.length < 4) {
      Alert.alert("Erreur", "Informations de carte invalides.");
      return;
    }
    try {
      setSaving(true);
      await api("/payments/cards", {
        method: "POST",
        body: JSON.stringify({ cardNumber: clean, expiry: newCardExpiry }),
      });
      setShowCardModal(false);
      setNewCardNumber("");
      setNewCardExpiry("");
      await fetchMethods();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer une carte ────────────────────────────
  const handleDeleteCard = async (cardId: string) => {
    Alert.alert("Supprimer la carte", "Confirmer la suppression ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await api(`/payments/cards/${cardId}`, { method: "DELETE" });
            await fetchMethods();
          } catch (e: any) {
            Alert.alert("Erreur", e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // ── Lier un wallet mobile ──────────────────────────
  const handleLinkWallet = async () => {
    if (newPhone.trim().length < 8) {
      Alert.alert("Erreur", "Numéro invalide");
      return;
    }
    try {
      setSaving(true);
      await api("/payments/mobile-wallet", {
        method: "PATCH",
        body: JSON.stringify({ provider: selectedProvider, number: newPhone }),
      });
      setShowPhoneModal(false);
      setNewPhone("");
      await fetchMethods();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Délier un wallet mobile ────────────────────────
  const handleUnlinkWallet = async (provider: string) => {
    Alert.alert("Délier le compte", `Délier ${WALLET_CONFIG[provider]?.label ?? provider} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Délier",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await api("/payments/mobile-wallet", {
              method: "PATCH",
              body: JSON.stringify({ provider, number: null }),
            });
            await fetchMethods();
          } catch (e: any) {
            Alert.alert("Erreur", e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // ── Rendu ──────────────────────────────────────────
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

            <TouchableOpacity
              style={s.addCard}
              onPress={() => setShowCardModal(true)}
              activeOpacity={0.85}
            >
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

            {mobileWallets.map((wallet) => {
              const config = WALLET_CONFIG[wallet.provider] ?? {
                label: wallet.provider,
                color: T.textSub,
                icon: "wallet",
              };
              return (
                <View key={wallet.provider} style={s.card}>
                  <View style={[s.iconBox, { backgroundColor: `${config.color}18` }]}>
                    <MaterialCommunityIcons
                      name={config.icon as any}
                      size={20}
                      color={config.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardName, { fontFamily: T.font.sans }]}>{config.label}</Text>
                    <Text
                      style={[
                        s.cardExp,
                        { fontFamily: T.font.mono },
                        !wallet.isLinked && { color: T.textDim },
                      ]}
                    >
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
                      style={[
                        s.linkBtn,
                        { backgroundColor: `${config.color}15`, borderColor: config.color },
                      ]}
                      onPress={() => {
                        setSelectedProvider(wallet.provider);
                        setShowPhoneModal(true);
                      }}
                      disabled={saving}
                    >
                      <Text style={[s.linkTxt, { color: config.color, fontFamily: T.font.sans }]}>
                        Lier
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        {/* ── Modal Carte ── */}
        <LightModal
          visible={showCardModal}
          onClose={() => setShowCardModal(false)}
          title="Ajouter une Carte"
        >
          <View style={{ padding: 20 }}>
            <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>NUMÉRO DE CARTE</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.mono }]}
              value={newCardNumber}
              onChangeText={setNewCardNumber}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor={T.textDim}
              keyboardType="numeric"
              maxLength={19}
            />
            <Text style={[s.inputLabel, { fontFamily: T.font.sans, marginTop: 14 }]}>
              DATE EXPIRATION (MM/AA)
            </Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.mono }]}
              value={newCardExpiry}
              onChangeText={setNewCardExpiry}
              placeholder="MM/AA"
              placeholderTextColor={T.textDim}
              keyboardType="numeric"
              maxLength={5}
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleAddCard} activeOpacity={0.85} disabled={saving}>
              <LinearGradient
                colors={[T.blue, "#0284C7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.confirmGrad}
              >
                {saving ? (
                  <ActivityIndicator color={T.surface} />
                ) : (
                  <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>AJOUTER LA CARTE</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="+224 6XX XX XX XX"
              placeholderTextColor={T.textDim}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleLinkWallet} activeOpacity={0.85} disabled={saving}>
              <LinearGradient
                colors={[T.accent, "#10B981"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.confirmGrad}
              >
                {saving ? (
                  <ActivityIndicator color={T.surface} />
                ) : (
                  <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>LIER CE NUMÉRO</Text>
                )}
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  iconBox: { width: 40, height: 40, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  cardName: { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  cardExp: { color: T.textDim, fontSize: 11, fontWeight: "600" },
  deleteCardBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.redSoft, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },

  addCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: T.blueSoft,
    borderRadius: T.radius.md,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: T.blue,
    borderStyle: "dashed",
  },
  addCardTxt: { fontSize: 13, fontWeight: "800" },

  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${T.green}12`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: T.radius.sm,
    borderWidth: 1,
  },
  linkedTxt: { color: T.green, fontSize: 11, fontWeight: "900" },
  linkBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: T.radius.sm, borderWidth: 1 },
  linkTxt: { fontSize: 11, fontWeight: "800" },

  inputLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: T.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: T.text,
    fontWeight: "600",
  },
  confirmBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 20 },
  confirmGrad: { paddingVertical: 16, alignItems: "center" },
  confirmTxt: { color: T.surface, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});