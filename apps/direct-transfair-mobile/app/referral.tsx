//apps/direct-transfair-mobile/app/referral.tsx
// apps/direct-transfair-mobile/app/referral.tsx
// =========================================================
// REFERRAL SCREEN v4.0 — Direct Transf'air
// Design: Émeraude Profond (USER)
// ✅ Code parrainage · WhatsApp · SMS · Email · Partage
// =========================================================

import React, { useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Platform, ScrollView, Linking, Alert, StatusBar, Animated,
} from "react-native";
import { Share } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../providers/AuthProvider";
import { showAlert } from "../utils/alert";

const T = {
  g1: "#0B1F14", g2: "#0F2A1C",
  accent: "#10B981", accentSoft: "#34D399", accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#1C2820",
  white: "#FFFFFF", dim: "#8A9BB5", dimSoft: "#7B9E8A",
  whatsapp: "#25D366", sms: "#3B82F6", email: "#64748B",
  radius: { md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Étape ────────────────────────────────────────────────
function StepItem({ number, title, desc, accent }: { number: string; title: string; desc: string; accent: string }) {
  return (
    <View style={stS.row}>
      <View style={[stS.numBox, { backgroundColor: `${accent}15`, borderColor: `${accent}25` }]}>
        <Text style={[stS.num, { color: accent, fontFamily: T.font.display }]}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[stS.title, { fontFamily: T.font.sans }]}>{title}</Text>
        <Text style={[stS.desc, { fontFamily: T.font.sans }]}>{desc}</Text>
      </View>
    </View>
  );
}
const stS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 16 },
  numBox: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  num: { fontSize: 15, fontWeight: "900" },
  title: { color: T.white, fontSize: 14, fontWeight: "800", marginBottom: 2 },
  desc: { color: T.dim, fontSize: 12, fontWeight: "600", lineHeight: 17 },
});

// ─── Social Button ────────────────────────────────────────
function SocialBtn({ icon, label, color, onPress }: { icon: React.ReactNode; label: string; color: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[sbS.btn, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {icon}
        <Text style={[sbS.label, { color, fontFamily: T.font.sans }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const sbS = StyleSheet.create({
  btn: { alignItems: "center", paddingVertical: 14, borderRadius: T.radius.lg, gap: 8, borderWidth: 1 },
  label: { fontSize: 11, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const referralCode = user
    ? `${user.firstName?.toUpperCase().substring(0, 3)}${user.id.substring(0, 4)}`
    : "CODE123";
  const referralLink = `https://direct-transfair.com/register?ref=${referralCode}`;
  const message = `Salut ! 👋\n\nUtilise mon code parrainage *${referralCode}* sur Direct Transf'air.\n\nInscris-toi ici pour envoyer de l'argent sans frais : ${referralLink}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    showAlert("Copié ✓", "Code copié dans le presse-papier !");
  };

  const handleSystemShare = async () => {
    try {
      await Share.share({ message, url: referralLink, title: "Invitation Direct Transf'air" });
    } catch { /* noop */ }
  };

  const handleWhatsApp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (ok) await Linking.openURL(url);
    else handleSystemShare();
  };

  const handleSMS = async () => {
    const sep = Platform.OS === "ios" ? "&" : "?";
    await Linking.openURL(`sms:${sep}body=${encodeURIComponent(message)}`);
  };

  const handleEmail = async () => {
    await Linking.openURL(
      `mailto:?subject=Invitation Direct Transf'air&body=${encodeURIComponent(message)}`
    );
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Parrainage</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ── */}
          <View style={s.hero}>
            <LinearGradient
              colors={[`${T.accent}25`, `${T.accent}08`]}
              style={s.heroIconBox}
            >
              <Ionicons name="gift" size={40} color={T.accent} />
            </LinearGradient>
            <Text style={[s.heroTitle, { fontFamily: T.font.display }]}>Gagnez de l'argent !</Text>
            <Text style={[s.heroText, { fontFamily: T.font.sans }]}>
              Invitez vos amis et gagnez{" "}
              <Text style={{ fontWeight: "900", color: T.accent }}>5€</Text>{" "}
              pour chaque ami qui effectue son premier transfert.
            </Text>
          </View>

          {/* ── Code parrainage ── */}
          <View style={s.codeCard}>
            <Text style={[s.codeLabel, { fontFamily: T.font.sans }]}>VOTRE CODE DE PARRAINAGE</Text>
            <TouchableOpacity style={s.codeBox} onPress={handleCopy} activeOpacity={0.8}>
              <LinearGradient
                colors={[T.accentGlow, "transparent"]}
                style={s.codeBoxGrad}
              >
                <Text style={[s.codeValue, { fontFamily: T.font.mono }]}>{referralCode}</Text>
                <View style={[s.copyBtn, { backgroundColor: T.accentGlow, borderColor: `${T.accent}30` }]}>
                  <Ionicons name="copy-outline" size={16} color={T.accent} />
                  <Text style={[s.copyTxt, { fontFamily: T.font.sans }]}>Copier</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={[s.codeHint, { fontFamily: T.font.sans }]}>
              Appuyez pour copier dans le presse-papier
            </Text>
          </View>

          {/* ── Partage ── */}
          <View style={s.card}>
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>PARTAGER VIA</Text>
            </View>

            <View style={s.socialRow}>
              <SocialBtn
                icon={<FontAwesome name="whatsapp" size={24} color={T.whatsapp} />}
                label="WhatsApp"
                color={T.whatsapp}
                onPress={handleWhatsApp}
              />
              <SocialBtn
                icon={<Ionicons name="chatbubble-ellipses" size={24} color={T.sms} />}
                label="SMS"
                color={T.sms}
                onPress={handleSMS}
              />
              <SocialBtn
                icon={<Ionicons name="mail" size={24} color={T.email} />}
                label="Email"
                color={T.email}
                onPress={handleEmail}
              />
            </View>

            <TouchableOpacity style={s.moreBtn} onPress={handleSystemShare} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={16} color={T.accent} />
              <Text style={[s.moreTxt, { fontFamily: T.font.sans }]}>Autres options de partage…</Text>
            </TouchableOpacity>
          </View>

          {/* ── Comment ça marche ── */}
          <View style={s.card}>
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>COMMENT ÇA MARCHE ?</Text>
            </View>
            <StepItem number="1" title="Envoyez une invitation" desc="Partagez votre code avec vos proches via WhatsApp, SMS ou email." accent={T.accent} />
            <StepItem number="2" title="Ils s'inscrivent" desc="Ils utilisent votre code lors de leur inscription sur Direct Transf'air." accent={T.accent} />
            <StepItem number="3" title="Vous gagnez tous les deux" desc="Recevez 5€ chacun après leur premier transfert réussi." accent={T.accent} />
          </View>

          {/* ── Solde gains ── */}
          <View style={[s.card, { borderColor: `${T.accent}20` }]}>
            <View style={s.earningsRow}>
              <View>
                <Text style={[s.earningsLabel, { fontFamily: T.font.sans }]}>GAINS CUMULÉS</Text>
                <Text style={[s.earningsValue, { color: T.accent, fontFamily: T.font.display }]}>0,00 €</Text>
              </View>
              <View style={[s.earningsBadge, { backgroundColor: T.accentGlow, borderColor: `${T.accent}25` }]}>
                <Ionicons name="people-outline" size={14} color={T.accent} />
                <Text style={[s.earningsBadgeTxt, { color: T.accent, fontFamily: T.font.sans }]}>
                  0 filleul{false ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  hero: { alignItems: "center", marginBottom: 20, paddingTop: 8 },
  heroIconBox: { width: 80, height: 80, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: `${T.accent}20` },
  heroTitle: { color: T.white, fontSize: 26, fontWeight: "700", marginBottom: 8 },
  heroText: { color: T.dim, fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  codeCard: { backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder, alignItems: "center" },
  codeLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 12 },
  codeBox: { width: "100%", borderRadius: T.radius.md, overflow: "hidden", marginBottom: 8 },
  codeBoxGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderRadius: T.radius.md, borderWidth: 1, borderColor: `${T.accent}20` },
  codeValue: { color: T.white, fontSize: 28, fontWeight: "900", letterSpacing: 3 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1 },
  copyTxt: { color: T.accent, fontSize: 12, fontWeight: "800" },
  codeHint: { color: T.dim, fontSize: 10, fontWeight: "600" },

  card: { backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  socialRow: { flexDirection: "row", gap: 10, marginBottom: 12 },

  moreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: T.radius.md, backgroundColor: T.accentGlow, borderWidth: 1, borderColor: `${T.accent}20` },
  moreTxt: { color: T.accent, fontSize: 13, fontWeight: "800" },

  earningsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  earningsLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 4 },
  earningsValue: { fontSize: 24, fontWeight: "800" },
  earningsBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  earningsBadgeTxt: { fontSize: 12, fontWeight: "800" },
});