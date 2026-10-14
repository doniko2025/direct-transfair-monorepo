// apps/direct-transfair-mobile/app/referral.tsx
// =========================================================
// REFERRAL SCREEN v5.0 — Direct Transf'air
// ✅ v5.0 : REFONTE — même style que tout le wallet (kit components/wallet) :
//    en-tête de marque, cartes blanches ombrées, couleurs du tenant.
//    Et surtout, plus RIEN de codé en dur propre à une société :
//    • nom de la société : branding.name (était « Direct Transf'air » partout) ;
//    • lien d'inscription : domaine/sous-domaine du tenant (buildCompanyPortalUrl),
//      sinon EXPO_PUBLIC_PORTAL_URL ; sans lien, le message part sans lien
//      (était https://direct-transfair.com/register?ref=… pour TOUTES les sociétés) ;
//    • récompense : branding.referralBonusLabel si le tenant la définit, sinon
//      libellé générique (était « 5€ » écrit en dur) ;
//    • carte « Gains cumulés 0,00 € / 0 filleul » SUPPRIMÉE : c'était un faux
//      compteur figé à zéro (aucune donnée derrière) qui trompait l'utilisateur.
//    Logique de partage (copier, WhatsApp, SMS, email, partage système) inchangée.
// Historique : v4.1 white-label brand.ts · v4.0 thème « Émeraude Profond » sombre.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  Linking, Share, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../providers/AuthProvider";
import { useTenant, buildCompanyPortalUrl } from "../providers/TenantProvider";
import { showAlert } from "../utils/alert";
import ScreenHeader from "../components/wallet/ScreenHeader";
import { Card, SectionTitle } from "../components/wallet/WalletParts";
import { useWalletTheme, N, FONT, RADIUS, alpha } from "../components/wallet/walletTheme";

// Couleurs de marque des canaux de partage (identité de WhatsApp, etc. — pas du tenant)
const CHANNELS = { whatsapp: "#25D366", sms: "#2563EB", email: "#64748B" } as const;

// ─── Étape ────────────────────────────────────────────────
function StepItem({ number, title, desc }: { number: string; title: string; desc: string }) {
  const { P } = useWalletTheme();
  return (
    <View style={st.row}>
      <View style={[st.numBox, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
        <Text style={[st.num, { color: P.action }]}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>{title}</Text>
        <Text style={st.desc}>{desc}</Text>
      </View>
    </View>
  );
}

// ─── Bouton de partage ────────────────────────────────────
function SocialBtn({ icon, label, color, onPress }: { icon: React.ReactNode; label: string; color: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[sb.btn, { backgroundColor: alpha(color, 0.08), borderColor: alpha(color, 0.25) }]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        accessibilityLabel={label}
      >
        {icon}
        <Text style={[sb.label, { color }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Écran ────────────────────────────────────────────────
export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { branding } = useTenant();
  const { P } = useWalletTheme();

  const brandName = branding?.name || "notre application";
  const bonus = ((branding as any)?.referralBonusLabel as string | undefined)?.trim() || "une récompense";

  const referralCode = user
    ? `${user.firstName?.toUpperCase().substring(0, 3)}${user.id.substring(0, 4)}`
    : "CODE123";

  const portal = buildCompanyPortalUrl(branding as any) || process.env.EXPO_PUBLIC_PORTAL_URL || "";
  const referralLink = portal ? `${portal.replace(/\/$/, "")}/register?ref=${referralCode}` : "";
  const message =
    `Salut ! 👋\n\nUtilise mon code parrainage *${referralCode}* sur ${brandName}.` +
    (referralLink ? `\n\nInscris-toi ici pour envoyer de l'argent sans frais : ${referralLink}` : "");

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    showAlert("Copié ✓", "Code copié dans le presse-papier !");
  };

  const handleSystemShare = async () => {
    try {
      await Share.share({ message, url: referralLink || undefined, title: `Invitation ${brandName}` });
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
      `mailto:?subject=${encodeURIComponent(`Invitation ${brandName}`)}&body=${encodeURIComponent(message)}`
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: N.page }}>
      <ScreenHeader
        compact
        title="Parrainage"
        subtitle={`Invite tes proches sur ${brandName}`}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
            <Ionicons name="gift" size={34} color={P.action} />
          </View>
          <Text style={s.heroTitle}>Invite tes amis, gagnez ensemble</Text>
          <Text style={s.heroText}>
            Partage ton code : tes proches s'inscrivent avec, et vous gagnez{" "}
            <Text style={{ fontWeight: "800", color: P.action }}>{bonus}</Text>{" "}
            dès leur premier transfert réussi.
          </Text>
        </View>

        {/* ── Code ── */}
        <Card style={{ alignItems: "center", marginBottom: 14 }}>
          <Text style={s.codeLabel}>TON CODE DE PARRAINAGE</Text>
          <TouchableOpacity
            style={[s.codeBox, { backgroundColor: P.tint, borderColor: P.tintBorder }]}
            onPress={handleCopy}
            activeOpacity={0.8}
            accessibilityLabel="Copier le code de parrainage"
          >
            <Text style={[s.codeValue, { color: P.bg2 }]}>{referralCode}</Text>
            <View style={[s.copyBtn, { backgroundColor: P.action }]}>
              <Ionicons name="copy-outline" size={15} color="#fff" />
              <Text style={s.copyTxt}>Copier</Text>
            </View>
          </TouchableOpacity>
          <Text style={s.codeHint}>Appuie pour copier dans le presse-papier</Text>
        </Card>

        {/* ── Partage ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle title="Partager via" />
          <View style={s.socialRow}>
            <SocialBtn icon={<FontAwesome name="whatsapp" size={24} color={CHANNELS.whatsapp} />} label="WhatsApp" color={CHANNELS.whatsapp} onPress={handleWhatsApp} />
            <SocialBtn icon={<Ionicons name="chatbubble-ellipses" size={24} color={CHANNELS.sms} />} label="SMS" color={CHANNELS.sms} onPress={handleSMS} />
            <SocialBtn icon={<Ionicons name="mail" size={24} color={CHANNELS.email} />} label="Email" color={CHANNELS.email} onPress={handleEmail} />
          </View>
          <TouchableOpacity style={[s.moreBtn, { backgroundColor: P.tint, borderColor: P.tintBorder }]} onPress={handleSystemShare} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={16} color={P.action} />
            <Text style={[s.moreTxt, { color: P.action }]}>Autres options de partage…</Text>
          </TouchableOpacity>
        </Card>

        {/* ── Comment ça marche ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle title="Comment ça marche ?" />
          <StepItem number="1" title="Envoie une invitation" desc="Partage ton code avec tes proches via WhatsApp, SMS ou email." />
          <StepItem number="2" title="Ils s'inscrivent" desc={`Ils saisissent ton code lors de leur inscription sur ${brandName}.`} />
          <StepItem number="3" title="Vous gagnez tous les deux" desc={`Vous recevez ${bonus} après leur premier transfert réussi.`} />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  numBox: { width: 34, height: 34, borderRadius: 11, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  num: { fontFamily: FONT.display, fontSize: 15, fontWeight: "800" },
  title: { fontFamily: FONT.body, color: N.ink, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  desc: { fontFamily: FONT.body, color: N.inkSub, fontSize: 12.5, lineHeight: 18 },
});

const sb = StyleSheet.create({
  btn: { alignItems: "center", paddingVertical: 14, borderRadius: RADIUS.lg, gap: 8, borderWidth: 1 },
  label: { fontFamily: FONT.body, fontSize: 11.5, fontWeight: "800" },
});

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  hero: { alignItems: "center", marginBottom: 18 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 14, borderWidth: 1 },
  heroTitle: { fontFamily: FONT.display, color: N.ink, fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  heroText: { fontFamily: FONT.body, color: N.inkSub, fontSize: 14, textAlign: "center", lineHeight: 21, paddingHorizontal: 10 },
  codeLabel: { fontFamily: FONT.body, fontSize: 10.5, fontWeight: "800", color: N.muted, letterSpacing: 1.4, marginBottom: 12 },
  codeBox: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: 8 },
  codeValue: { fontFamily: FONT.display, fontSize: 26, fontWeight: "800", letterSpacing: 3 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  copyTxt: { fontFamily: FONT.body, color: "#fff", fontSize: 12.5, fontWeight: "800" },
  codeHint: { fontFamily: FONT.body, color: N.muted, fontSize: 11 },
  socialRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  moreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1 },
  moreTxt: { fontFamily: FONT.body, fontSize: 13, fontWeight: "800" },
});
