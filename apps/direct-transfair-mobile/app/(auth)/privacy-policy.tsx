// apps/direct-transfair-mobile/app/(auth)/privacy-policy.tsx
// ✅ v3.0 : DESIGN « CORRIDOR » — palette brume / forêt / feuille, polices Manrope (contenu inchangé).
// =========================================================
// ✅ v3.1 (phase 7) : marque, raison sociale, régulateur, e-mail du DPO et autorité de protection des données viennent du tenant / de services/platformConfig.ts (plus rien d'écrit en dur).
// POLITIQUE DE CONFIDENTIALITÉ v1.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — palette neutre chaude (fond crème, accent encre, police système) ; contenu inchangé.
// ✅ Conforme RGPD (Règlement UE 2016/679)
// ✅ Adapté aux obligations PSP / transferts d'argent
// ✅ Présentation modale depuis index.tsx et login.tsx
// =========================================================

import React from "react";
import {
  View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform, Linking,
} from 'react-native';
import { useRouter } from "expo-router";
import { Ionicons } from '../../components/ui/Icon';

import { Text } from '../../components/ui/Text';
import { useTenant } from '../../providers/TenantProvider';
import { getDpoEmail, getDataAuthority } from '../../services/platformConfig';
import { useT } from '../../providers/I18nProvider';
import { rich } from '../../utils/richText';
import { getScheme } from '../../components/ui/themeMode';
import { N } from '../../components/auth/authTheme';
import { useTheme } from '../../providers/ThemeProvider';
import { themed } from '../../components/wallet/brand';
// themed() : palette recalculée au changement de thème clair / sombre.
const dk = (light: string, dark: string) => (getScheme() === "dark" ? dark : light);
const T = themed(() => ({
  bg:         dk("#FFFFFF", "#0D0F12"),
  surface:    dk("#FFFFFF", "#16191E"),
  accent:     dk("#111111", "#F4F5F7"),
  accentSoft: dk("#DDEBE2", "#1F2A24"),
  accentText: dk("#111111", "#F4F5F7"),
  text:       dk("#111111", "#F4F5F7"),
  textSub:    dk("#2F463A", "#C9D1CC"),
  textDim:    dk("#6B6B6B", "#9CA3AF"),
  border:     dk("#E0E0E0", "#2B3038"),
  borderGreen:dk("#E0E0E0", "#2B3038"),
  blue:       dk("#1D4ED8", "#6AA2FF"),
  blueSoft:   dk("#DBEAFE", "#14233F"),
  amber:      dk("#D97706", "#F2B24C"),
  amberSoft:  dk("#FEF3C7", "#3A2D12"),
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  font: {
    display: Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
    sans:    Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
}));

// ─── Section ──────────────────────────────────────────────
function Section({ icon, title, color, bgColor, children }: {
  icon: string; title: string; color: string; bgColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sS.wrap}>
      <View style={[sS.header, { backgroundColor: bgColor, borderLeftColor: color }]}>
        <View style={[sS.iconBox, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon as any} size={16} color={color} />
        </View>
        <Text style={[sS.title, { color, fontFamily: T.font.display }]}>{title}</Text>
      </View>
      <View style={sS.body}>{children}</View>
    </View>
  );
}
const sS = themed(() => StyleSheet.create({
  wrap:    { marginBottom: 20, backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  header:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderLeftWidth: 4 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 14, fontWeight: "800", flex: 1 },
  body:    { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
}));

// ─── Paragraph ────────────────────────────────────────────
function Para({ children }: { children: React.ReactNode }) {
  return <Text style={[pS.text, { fontFamily: T.font.sans }]}>{children}</Text>;
}
const pS = themed(() => StyleSheet.create({
  text: { fontSize: 13, color: T.textSub, lineHeight: 21, marginBottom: 10 },
}));

// ─── Bullet ───────────────────────────────────────────────
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={bS.row}>
      <View style={[bS.dot, { backgroundColor: T.accent }]} />
      <Text style={[bS.text, { fontFamily: T.font.sans }]}>{children}</Text>
    </View>
  );
}
const bS = themed(() => StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  dot:  { width: 5, height: 5, borderRadius: 99, marginTop: 8, flexShrink: 0 },
  text: { flex: 1, fontSize: 13, color: T.textSub, lineHeight: 20 },
}));

// ─── Rights Box ───────────────────────────────────────────
function RightBox({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={rbS.box}>
      <View style={rbS.iconBox}>
        <Ionicons name={icon as any} size={15} color={T.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rbS.title, { fontFamily: T.font.sans }]}>{title}</Text>
        <Text style={[rbS.desc,  { fontFamily: T.font.sans }]}>{desc}</Text>
      </View>
    </View>
  );
}
const rbS = themed(() => StyleSheet.create({
  box:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10, backgroundColor: T.accentSoft, borderRadius: T.radius.sm, padding: 12 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.surface, justifyContent: "center", alignItems: "center", marginTop: 2 },
  title:   { fontSize: 12, fontWeight: "800", color: T.accentText, marginBottom: 2 },
  desc:    { fontSize: 12, color: T.textSub, lineHeight: 18 },
}));

// ─── Main ─────────────────────────────────────────────────
export default function PrivacyPolicyScreen() {
  const t = useT();
  const { isDark } = useTheme();   // se redessine au changement de thème
  // ✅ phase 7 : marque, raison sociale, régulateur, DPO et autorité de protection viennent du tenant / de la configuration.
  const { branding } = useTenant();
  const brandName = branding.name;
  const legalName = branding.legalCompanyName || branding.name;
  const regulatorAcronym = branding.regulatorAcronym;
  const regulatorLabel = branding.regulatorName
    ? `${branding.regulatorName}${regulatorAcronym ? ` (${regulatorAcronym})` : ""}`
    : t("pp.authorityDefault");
  const dpoEmail = getDpoEmail() || branding.contactEmail || branding.supportEmail || "";
  const authority = getDataAuthority();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={T.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
              {t("pp.title")}
            </Text>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
              {t("pp.updated")}
            </Text>
          </View>
          <View style={[s.gdprBadge]}>
            <Text style={[s.gdprTxt, { fontFamily: T.font.sans }]}>{t("pp.badge")}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={s.introBanner}>
            <Ionicons name="shield-checkmark" size={22} color={T.accent} />
            <Text style={[s.introTxt, { fontFamily: T.font.sans }]}>
              {t("pp.intro", { app: brandName })}
            </Text>
          </View>

          {/* 1. Responsable */}
          <Section icon="business-outline" title={t("pp.s1")} color={T.accent} bgColor={T.accentSoft}>
            <Para>{rich(t("pp.s1p1", { legal: legalName }), T.text)}</Para>
            <Para>{t("pp.s1p2", { app: brandName, regulator: regulatorLabel })}</Para>
          </Section>

          {/* 2. Données collectées */}
          <Section icon="document-text-outline" title={t("pp.s2")} color={T.blue} bgColor={T.blueSoft}>
            <Para>{t("pp.s2intro")}</Para>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>{t("pp.subId")}</Text>
            <Bullet>{t("pp.id1")}</Bullet>
            <Bullet>{t("pp.id2")}</Bullet>
            <Bullet>{t("pp.id3")}</Bullet>
            <Bullet>{t("pp.id4")}</Bullet>
            <Bullet>{t("pp.id5")}</Bullet>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>{t("pp.subContact")}</Text>
            <Bullet>{t("pp.ct1")}</Bullet>
            <Bullet>{t("pp.ct2")}</Bullet>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>{t("pp.subFin")}</Text>
            <Bullet>{t("pp.fn1")}</Bullet>
            <Bullet>{t("pp.fn2")}</Bullet>
            <Bullet>{t("pp.fn3")}</Bullet>
            <Bullet>{t("pp.fn4")}</Bullet>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>{t("pp.subTech")}</Text>
            <Bullet>{t("pp.tc1")}</Bullet>
            <Bullet>{t("pp.tc2")}</Bullet>
            <Bullet>{t("pp.tc3")}</Bullet>
          </Section>

          {/* 3. Finalités */}
          <Section icon="analytics-outline" title={t("pp.s3")} color={dk("#7C3AED", "#A78BFA")} bgColor={dk("#F5F3FF", "#241B3D")}>
            <Para>{t("pp.s3intro")}</Para>
            <Bullet>{rich(t("pp.s3b1"))}</Bullet>
            <Bullet>{rich(t("pp.s3b2"))}</Bullet>
            <Bullet>{rich(t("pp.s3b3"))}</Bullet>
            <Bullet>{rich(t("pp.s3b4"))}</Bullet>
          </Section>

          {/* 4. Partage */}
          <Section icon="share-social-outline" title={t("pp.s4")} color={T.amber} bgColor={T.amberSoft}>
            <Para>{t("pp.s4intro")}</Para>
            <Bullet>{t("pp.s4b1")}</Bullet>
            <Bullet>{t("pp.s4b2")}</Bullet>
            <Bullet>{t("pp.s4b3", { acronym: regulatorAcronym ? `${regulatorAcronym}, ` : "" })}</Bullet>
            <Bullet>{t("pp.s4b4")}</Bullet>
            <Para>
            <Text style={{ fontWeight: "700", color: T.text, marginTop: 6 }}>{t("pp.s4none")}</Text>
            </Para>
          </Section>

          {/* 5. Conservation */}
          <Section icon="time-outline" title={t("pp.s5")} color={dk("#0284C7", "#5CC2F2")} bgColor={dk("#E0F2FE", "#10283A")}>
            <Bullet>{rich(t("pp.s5b1"))}</Bullet>
            <Bullet>{rich(t("pp.s5b2"))}</Bullet>
            <Bullet>{rich(t("pp.s5b3"))}</Bullet>
            <Bullet>{rich(t("pp.s5b4"))}</Bullet>
            <Bullet>{rich(t("pp.s5b5"))}</Bullet>
          </Section>

          {/* 6. Vos droits */}
          <Section icon="person-circle-outline" title={t("pp.s6")} color={T.accent} bgColor={T.accentSoft}>
            <Para>{t("pp.s6intro")}</Para>
            <RightBox icon="eye-outline"         title={t("pp.r1t")} desc={t("pp.r1d")} />
            <RightBox icon="pencil-outline"      title={t("pp.r2t")} desc={t("pp.r2d")} />
            <RightBox icon="trash-outline"       title={t("pp.r3t")} desc={t("pp.r3d")} />
            <RightBox icon="hand-left-outline"   title={t("pp.r4t")} desc={t("pp.r4d")} />
            <RightBox icon="download-outline"    title={t("pp.r5t")} desc={t("pp.r5d")} />
            <RightBox icon="pause-circle-outline" title={t("pp.r6t")} desc={t("pp.r6d")} />
            <Para>
              {t("pp.exercise")}{"\n"}
              <Text
                style={{ color: T.blue, fontWeight: "700", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL(`mailto:${dpoEmail}`)}
              >
                {dpoEmail}
              </Text>
            </Para>
            <Para>
              {rich(t("pp.complaint", { authority: authority.name }))}
              <Text
                style={{ color: T.blue, textDecorationLine: "underline" }}
                onPress={() => Linking.openURL(authority.url)}
              >
                {authority.url.replace(/^https?:\/\//, "")}
              </Text>.
            </Para>
          </Section>

          {/* 7. Sécurité */}
          <Section icon="lock-closed-outline" title={t("pp.s7")} color={dk("#DC2626", "#FF7A7A")} bgColor={dk("#FEF2F2", "#3B1D1F")}>
            <Para>
              {t("pp.s7intro", { app: brandName })}
            </Para>
            <Bullet>{t("pp.s7b1")}</Bullet>
            <Bullet>{t("pp.s7b2")}</Bullet>
            <Bullet>{t("pp.s7b3")}</Bullet>
            <Bullet>{t("pp.s7b4")}</Bullet>
            <Bullet>{t("pp.s7b5")}</Bullet>
          </Section>

          {/* 8. Contact */}
          <View style={s.contactCard}>
            <Ionicons name="mail-outline" size={20} color={T.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactTitle, { fontFamily: T.font.sans }]}>{t("pp.contactTitle")}</Text>
              <Text style={[s.contactDesc,  { fontFamily: T.font.sans }]}>
                {t("pp.contactDesc")}
              </Text>
              <Text
                style={[s.contactLink, { fontFamily: T.font.mono }]}
                onPress={() => Linking.openURL(`mailto:${dpoEmail}`)}
              >
                {dpoEmail}
              </Text>
            </View>
          </View>

          <Text style={[s.version, { fontFamily: T.font.mono }]}>
            {t("pp.version")}
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  closeBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: N.field, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.text, fontSize: 16, fontWeight: "700" },
  headerSub:   { color: T.textDim, fontSize: 11, marginTop: 1 },
  gdprBadge:   { backgroundColor: T.accentSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: T.borderGreen },
  gdprTxt:     { color: T.accentText, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },

  introBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: T.accentSoft, borderRadius: T.radius.md,
    padding: 16, borderWidth: 1, borderColor: T.borderGreen,
    marginBottom: 20,
  },
  introTxt: { flex: 1, fontSize: 13, color: T.accentText, lineHeight: 20, fontWeight: "500" },

  subTitle: { fontSize: 11, fontWeight: "800", color: T.text, letterSpacing: 0.5, marginTop: 10, marginBottom: 6, textTransform: "uppercase" },

  contactCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 18, borderWidth: 1, borderColor: T.borderGreen,
    marginBottom: 16,
  },
  contactTitle: { fontSize: 14, fontWeight: "800", color: T.text, marginBottom: 4 },
  contactDesc:  { fontSize: 12, color: T.textDim, marginBottom: 6 },
  contactLink:  { fontSize: 13, color: T.blue, fontWeight: "700", textDecorationLine: "underline" },

  version: { textAlign: "center", color: T.textDim, fontSize: 10, letterSpacing: 0.5 },
}));