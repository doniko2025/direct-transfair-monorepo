//apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/payment-methods.tsx
// =========================================================
// PAYMENT METHODS v4.0 — Direct Transf'air
// Design: Émeraude Profond (USER uniquement)
// ✅ Cartes bancaires + Mobile Money avec modales dark
// =========================================================

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Modal, TextInput, Alert,
  Platform, Animated, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";

const T = {
  g1: "#0B1F14",
  g2: "#0F2A1C",
  accent: "#10B981",
  accentSoft: "#34D399",
  accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "#1C2820",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  red: "#EF4444",
  blue: "#60A5FA",
  orange: "#F97316",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Dark Modal ───────────────────────────────────────────
function DarkModal({
  visible, onClose, title, children,
}: {
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
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
const dmS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0B1F14", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", borderWidth: 1, borderColor: T.inkBorder, paddingBottom: 30 },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  title: { color: T.white, fontSize: 18, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [cards, setCards] = useState([
    { id: "1", last4: "4242", expiry: "12/25", brand: "Visa" },
  ]);
  const [mobileWallets, setMobileWallets] = useState([
    { id: "om", provider: "Orange Money", number: "+221 77 000 00 00", isLinked: true,  color: T.orange, icon: "cellphone" },
    { id: "wave", provider: "Wave",         number: null,                isLinked: false, color: T.blue,  icon: "penguin" },
  ]);

  const [showCardModal, setShowCardModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const handleAddCard = () => {
    if (newCardNumber.replace(/\s/g, "").length < 16 || newCardExpiry.length < 4) {
      Alert.alert("Erreur", "Informations de carte invalides."); return;
    }
    setCards([...cards, { id: Date.now().toString(), last4: newCardNumber.slice(-4), expiry: newCardExpiry, brand: "Visa" }]);
    setShowCardModal(false); setNewCardNumber(""); setNewCardExpiry("");
  };

  const handleLinkWallet = () => {
    if (newPhone.trim().length < 8) { Alert.alert("Erreur", "Numéro invalide"); return; }
    setMobileWallets(mobileWallets.map((w) =>
      w.id === selectedWalletId ? { ...w, isLinked: true, number: newPhone } : w
    ));
    setShowPhoneModal(false); setNewPhone("");
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Moyens de Paiement</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>
              Cartes & Mobile Money
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Cartes ── */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>CARTES BANCAIRES</Text>
          </View>

          {cards.map((card) => (
            <View key={card.id} style={s.card}>
              <View style={[s.iconBox, { backgroundColor: `${T.blue}15` }]}>
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
                onPress={() => setCards(cards.filter((c) => c.id !== card.id))}
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
          <View style={[s.sectionRow, { marginTop: 8 }]}>
            <View style={[s.sectionDot, { backgroundColor: T.orange }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MOBILE MONEY</Text>
          </View>

          {mobileWallets.map((wallet) => (
            <View key={wallet.id} style={s.card}>
              <View style={[s.iconBox, { backgroundColor: `${wallet.color}15` }]}>
                <MaterialCommunityIcons name={wallet.icon as any} size={20} color={wallet.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardName, { fontFamily: T.font.sans }]}>{wallet.provider}</Text>
                <Text style={[s.cardExp, { fontFamily: T.font.mono }, !wallet.isLinked && { color: T.dim + "80" }]}>
                  {wallet.isLinked ? wallet.number : "Non lié"}
                </Text>
              </View>
              {wallet.isLinked ? (
                <View style={[s.linkedBadge, { borderColor: "rgba(34,197,94,0.25)" }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                  <Text style={[s.linkedTxt, { fontFamily: T.font.sans }]}>Lié</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.linkBtn, { backgroundColor: `${wallet.color}15`, borderColor: `${wallet.color}25` }]}
                  onPress={() => { setSelectedWalletId(wallet.id); setShowPhoneModal(true); }}
                >
                  <Text style={[s.linkTxt, { color: wallet.color, fontFamily: T.font.sans }]}>Lier</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ── Modal Carte ── */}
        <DarkModal visible={showCardModal} onClose={() => setShowCardModal(false)} title="Ajouter une Carte">
          <View style={{ padding: 20 }}>
            <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>NUMÉRO DE CARTE</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.mono }]}
              value={newCardNumber}
              onChangeText={setNewCardNumber}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor={T.dim + "55"}
              keyboardType="numeric"
              maxLength={19}
            />
            <Text style={[s.inputLabel, { fontFamily: T.font.sans, marginTop: 12 }]}>DATE EXPIRATION (MM/AA)</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.mono }]}
              value={newCardExpiry}
              onChangeText={setNewCardExpiry}
              placeholder="MM/AA"
              placeholderTextColor={T.dim + "55"}
              keyboardType="numeric"
              maxLength={5}
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleAddCard} activeOpacity={0.85}>
              <LinearGradient
                colors={[T.blue, "#93C5FD"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.confirmGrad}
              >
                <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>AJOUTER LA CARTE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </DarkModal>

        {/* ── Modal Wallet ── */}
        <DarkModal visible={showPhoneModal} onClose={() => setShowPhoneModal(false)} title="Lier le Numéro">
          <View style={{ padding: 20 }}>
            <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>NUMÉRO MOBILE MONEY</Text>
            <TextInput
              style={[s.input, { fontFamily: T.font.sans }]}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="+221 77 000 00 00"
              placeholderTextColor={T.dim + "55"}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity style={s.confirmBtn} onPress={handleLinkWallet} activeOpacity={0.85}>
              <LinearGradient
                colors={[T.accent, T.accentSoft]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.confirmGrad}
              >
                <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>LIER CE NUMÉRO</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </DarkModal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.inkBorder,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardName: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  cardExp: { color: T.dim, fontSize: 11, fontWeight: "600" },
  deleteCardBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(239,68,68,0.10)", justifyContent: "center", alignItems: "center" },

  addCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: `${T.blue}10`, borderRadius: T.radius.md,
    paddingVertical: 14, marginBottom: 20,
    borderWidth: 1, borderColor: `${T.blue}20`, borderStyle: "dashed",
  },
  addCardTxt: { fontSize: 13, fontWeight: "800" },

  linkedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(34,197,94,0.10)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
  },
  linkedTxt: { color: "#22C55E", fontSize: 11, fontWeight: "900" },
  linkBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  linkTxt: { fontSize: 12, fontWeight: "800" },

  inputLabel: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: T.white, fontWeight: "700",
  },
  confirmBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 20 },
  confirmGrad: { paddingVertical: 17, alignItems: "center" },
  confirmTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});