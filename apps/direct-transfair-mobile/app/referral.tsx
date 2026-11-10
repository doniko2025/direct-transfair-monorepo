// apps/direct-transfair-mobile/app/referral.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// REFERRAL SCREEN v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR — fond crème, grand titre, carte « code de parrainage »
//    en accent de la société (texte auto-contrasté), canaux de partage en tuiles rondes,
//    étapes numérotées en lignes à filet, bouton pilule « Partager ». Police système.
//    LOGIQUE INCHANGÉE (copier, WhatsApp, SMS, email, partage système ; code, lien et
//    message construits exactement comme en v5.0 — rien de codé en dur par société :
//    branding.name, buildCompanyPortalUrl / EXPO_PUBLIC_PORTAL_URL, referralBonusLabel).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.0 : REFONTE — nom/lien/récompense issus du tenant ; faux compteur « gains cumulés »
//    supprimé. Historique : v4.1 white-label brand.ts · v4.0 thème « Émeraude Profond ».
// =========================================================

import React from "react";
import { View, Pressable, Linking, Share, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../components/ui/Icon';
import { FontAwesome } from '@expo/vector-icons';
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../providers/AuthProvider";
import { useTenant, buildCompanyPortalUrl } from "../providers/TenantProvider";
import { showAlert } from "../utils/alert";
import { Button, Card, NavBar, Screen, UText, alpha, useUI } from "../components/ui";
import { useT } from "../providers/I18nProvider";

// Couleurs de marque des canaux de partage (identité de WhatsApp, etc. — pas du tenant)
const CHANNELS = { whatsapp: "#25D366", sms: "#2563EB", email: "#64748B" } as const;

function Step({ n, title, desc, last }: { n: string; title: string; desc: string; last?: boolean }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" }}>
        <UText v="bodyStrong" color={C.darkInk}>{n}</UText>
      </View>
      <View style={{ flex: 1 }}>
        <UText v="bodyStrong">{title}</UText>
        <UText v="caption" tone="muted" style={{ marginTop: 2, lineHeight: 19 }}>{desc}</UText>
      </View>
    </View>
  );
}

function Channel({ icon, label, color, onPress }: { icon: React.ReactNode; label: string; color: string; onPress: () => void }) {
  const { C } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: alpha(color, 0.12), alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <UText v="label" style={{ color: C.text }}>{label}</UText>
    </Pressable>
  );
}

export default function ReferralScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const { branding } = useTenant();
  const { C, R } = useUI();

  const brandName = branding?.name || t("ref.thisApp");
  const bonus = ((branding as any)?.referralBonusLabel as string | undefined)?.trim() || t("ref.aReward");

  const referralCode = user
    ? `${user.firstName?.toUpperCase().substring(0, 3)}${user.id.substring(0, 4)}`
    : "CODE123";

  const portal = buildCompanyPortalUrl(branding as any) || process.env.EXPO_PUBLIC_PORTAL_URL || "";
  const referralLink = portal ? `${portal.replace(/\/$/, "")}/register?ref=${referralCode}` : "";
  const message =
    t("ref.shareText", { code: referralCode, app: brandName }) +
    (referralLink ? t("ref.shareLink", { link: referralLink }) : "");

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    showAlert(t("ref.copiedTitle"), t("ref.copiedMsg"));
  };

  const handleSystemShare = async () => {
    try {
      await Share.share({ message, url: referralLink || undefined, title: t("ref.invite", { app: brandName }) });
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
      `mailto:?subject=${encodeURIComponent(t("ref.invite", { app: brandName }))}&body=${encodeURIComponent(message)}`
    );
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      footer={<Button label={t("ref.shareBtn")} icon="share-social-outline" onPress={handleSystemShare} />}
    >
      <UText v="hero">{t("ref.title")}</UText>
      <UText v="body" tone="muted" style={{ marginTop: 6, marginBottom: 22 }}>
        {t("ref.intro", { app: brandName, bonus })}
      </UText>

      {/* Code */}
      <Pressable onPress={handleCopy} accessibilityRole="button" accessibilityLabel={t("ref.copyCode")}>
        <View style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: 22 }}>
          <UText v="overline" color={C.accentInk} style={{ opacity: 0.7 }}>{t("ref.yourCode")}</UText>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <UText v="display" color={C.accentInk} style={{ letterSpacing: 3, fontSize: 36 }} numberOfLines={1} adjustsFontSizeToFit>
              {referralCode}
            </UText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 38, borderRadius: R.pill, backgroundColor: C.accentInk }}>
              <Ionicons name="copy-outline" size={15} color={C.accent} />
              <UText v="label" color={C.accent}>{t("ref.copy")}</UText>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Canaux */}
      <UText v="overline" tone="muted" style={{ marginTop: 30, marginBottom: 16 }}>{t("ref.shareVia")}</UText>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Channel icon={<FontAwesome name="whatsapp" size={28} color={CHANNELS.whatsapp} />} label="WhatsApp" color={CHANNELS.whatsapp} onPress={handleWhatsApp} />
        <Channel icon={<Ionicons name="chatbubble-ellipses" size={26} color={CHANNELS.sms} />} label="SMS" color={CHANNELS.sms} onPress={handleSMS} />
        <Channel icon={<Ionicons name="mail" size={26} color={CHANNELS.email} />} label="Email" color={CHANNELS.email} onPress={handleEmail} />
      </View>

      {/* Étapes */}
      <UText v="overline" tone="muted" style={{ marginTop: 30, marginBottom: 4 }}>{t("ref.how")}</UText>
      <Card pad={0} tone="outline" style={{ paddingHorizontal: 16, borderWidth: 0, backgroundColor: "transparent" }}>
        <Step n="1" title={t("ref.s1")} desc={t("ref.s1d")} />
        <Step n="2" title={t("ref.s2")} desc={t("ref.s2d", { app: brandName })} />
        <Step n="3" title={t("ref.s3")} desc={t("ref.s3d", { bonus })} last />
      </Card>
    </Screen>
  );
}
