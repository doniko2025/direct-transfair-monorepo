// apps/direct-transfair-mobile/app/(auth)/terms.tsx
// ✅ v3.0 : DESIGN « CORRIDOR » — palette brume / forêt / feuille, polices Manrope (contenu inchangé).
// =========================================================
// ✅ phase 7 : la juridiction citée dans les CGU vient de la configuration (EXPO_PUBLIC_LEGAL_JURISDICTION, ex. « les tribunaux du ressort de la Cour d'Appel de Paris »).
// CONDITIONS GÉNÉRALES D'UTILISATION — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — palette neutre chaude (fond crème, accent encre, police système) ; contenu juridique inchangé.
// ✅ v1.1 (code) : Branding dynamique — plus de code en dur
//   PROBLÈME RÉSOLU : "Direct Transf'air SAS", l'agrément ACPR, le
//   capital social, le siège social, le contact, le médiateur et la
//   version/date des CGU étaient écrits en dur — un tenant société
//   (ex: FLASH26) affichait quand même l'identité légale de Direct
//   Transf'air à ses propres utilisateurs.
//   CORRECTIF : useTenant() → toutes les mentions d'identité/contact
//   viennent de `branding.*` (TenantProvider v1.3), avec repli sur le
//   nom de marque (`branding.name`) plutôt que sur les valeurs Direct
//   Transf'air quand un champ légal n'est pas configuré pour un
//   tenant société. Les lignes de la carte "Mentions légales" et le
//   badge de cadre réglementaire (DSP2) se masquent si la donnée
//   correspondante n'est pas configurée, plutôt que d'afficher une
//   valeur vide ou trompeuse.
//   ⚠️ NE COUVRE QUE L'IDENTITÉ/CONTACT — la substance des clauses
//   (juridiction, annulation, KYC, plafonds) reste un texte fixe,
//   volontairement non templatée : personnaliser ces clauses par
//   société demande une vraie relecture juridique par société.
//   ✅ Fix annexe : le bouton "×" appelait router.back() sans vérifier
//   qu'il y avait un historique — crash "GO_BACK not handled" en accès
//   direct à /terms (hors modal). router.canGoBack() vérifié désormais.
// =========================================================

import React from "react";
import {
  View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform, Linking,
} from 'react-native';
import { useRouter } from "expo-router";
import { Ionicons } from '../../components/ui/Icon';
import { useTenant } from "../../providers/TenantProvider";
import { getLegalJurisdiction } from "../../services/platformConfig";
import { useT } from "../../providers/I18nProvider";
import { getLang, getLocale } from "../../i18n/runtime";
import { rich } from "../../utils/richText";

import { Text } from '../../components/ui/Text';
const T = {
  bg:         "#FFFFFF",
  surface:    "#FFFFFF",
  accent:     "#111111",
  accentSoft: "#DDEBE2",
  accentText: "#111111",
  text:       "#111111",
  textSub:    "#2F463A",
  textDim:    "#6B6B6B",
  border:     "#E0E0E0",
  green:      "#1B8A4B",
  greenSoft:  "#E8F5ED",
  red:        "#DC2626",
  redSoft:    "#FEF2F2",
  amber:      "#D97706",
  amberSoft:  "#FEF3C7",
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  font: {
    display: Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
    sans:    Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Helpers de date ✅ v1.1 (nouveau) ─────────────────────
function formatTermsDateLong(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  if (getLang() !== "fr") return d.toLocaleDateString(getLocale(), { day: "numeric", month: "long", year: "numeric" });
  const dayLabel = day === 1 ? "1er" : String(day);
  const monthYear = d.toLocaleDateString(getLocale(), { month: "long", year: "numeric" });
  return `${dayLabel} ${monthYear}`;
}
function formatTermsDateShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(getLocale(), { month: "long", year: "numeric" });
}

// ─── Section ──────────────────────────────────────────────
function Section({ icon, title, color, bgColor, children }: {
  icon: string; title: string; color: string; bgColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sS.wrap}>
      <View style={[sS.header, { backgroundColor: bgColor, borderLeftColor: color }]}>
        <View style={[sS.iconBox, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon as any} size={15} color={color} />
        </View>
        <Text style={[sS.title, { color, fontFamily: T.font.display }]}>{title}</Text>
      </View>
      <View style={sS.body}>{children}</View>
    </View>
  );
}
const sS = StyleSheet.create({
  wrap:   { marginBottom: 16, backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderLeftWidth: 4 },
  iconBox:{ width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:  { fontSize: 13, fontWeight: "800", flex: 1 },
  body:   { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
});

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={[pS.t, { fontFamily: T.font.sans }]}>{children}</Text>;
}
const pS = StyleSheet.create({
  t: { fontSize: 13, color: T.textSub, lineHeight: 21, marginBottom: 10 },
});

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={bS.row}>
      <View style={[bS.dot, { backgroundColor: T.accent }]} />
      <Text style={[bS.t, { fontFamily: T.font.sans }]}>{children}</Text>
    </View>
  );
}
const bS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  dot: { width: 5, height: 5, borderRadius: 99, marginTop: 8, flexShrink: 0, backgroundColor: T.accent },
  t:   { flex: 1, fontSize: 13, color: T.textSub, lineHeight: 20 },
});

// ─── Info Box ─────────────────────────────────────────────
function InfoBox({ icon, color, bgColor, children }: {
  icon: string; color: string; bgColor: string; children: React.ReactNode;
}) {
  return (
    <View style={[ibS.box, { backgroundColor: bgColor, borderColor: color + "40" }]}>
      <Ionicons name={icon as any} size={16} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
      <Text style={[ibS.t, { color, fontFamily: T.font.sans }]}>{children}</Text>
    </View>
  );
}
const ibS = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: T.radius.sm, padding: 12, borderWidth: 1, marginBottom: 10 },
  t:   { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "600" },
});

// ─── Main ─────────────────────────────────────────────────
export default function TermsScreen() {
  const t = useT();
  const router = useRouter();
  const { branding } = useTenant(); // ✅ v1.1 (nouveau)

  // ✅ v1.1 — repli sur le nom de marque, jamais sur les valeurs
  // Direct Transf'air, quand un tenant société n'a pas configuré son
  // nom légal complet.
  const legalName = branding.legalCompanyName || branding.name;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/login-v2");
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={goBack} hitSlop={12}>
            <Ionicons name="close" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
              {t("tm.title")}
            </Text>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
              {t("tm.updated", { date: formatTermsDateShort(branding.termsEffectiveDate) || "—" })}
            </Text>
          </View>
          {/* ✅ v1.1 — badge masqué si aucun cadre réglementaire configuré */}
          {!!branding.regulatoryFrameworkLabel && (
            <View style={s.dsp2Badge}>
              <Text style={[s.dsp2Txt, { fontFamily: T.font.sans }]}>
                {branding.regulatoryFrameworkLabel}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={s.introBanner}>
            <Ionicons name="document-text" size={20} color={T.accent} />
            <Text style={[s.introTxt, { fontFamily: T.font.sans }]}>
              {t("tm.intro", { app: branding.name })}
            </Text>
          </View>

          {/* 1. Objet */}
          <Section icon="information-circle-outline" title={t("tm.s1")} color={T.accent} bgColor={T.accentSoft}>
            <Para>
              {rich(t("tm.s1p1", {
                app: branding.name,
                legal: legalName,
                tail: branding.regulatorName ? t("tm.s1tail", { regulator: branding.regulatorName }) : ".",
              }), T.text)}
            </Para>
            <Para>{t("tm.s1p2", { app: branding.name })}</Para>
          </Section>

          {/* 2. Services */}
          <Section icon="swap-horizontal-outline" title={t("tm.s2")} color={T.green} bgColor={T.greenSoft}>
            <Para>{t("tm.s2intro", { app: branding.name })}</Para>
            <Bullet>{t("tm.s2b1")}</Bullet>
            <Bullet>{t("tm.s2b2")}</Bullet>
            <Bullet>{t("tm.s2b3")}</Bullet>
            <Bullet>{t("tm.s2b4")}</Bullet>
            <Bullet>{t("tm.s2b5")}</Bullet>
            <Bullet>{t("tm.s2b6")}</Bullet>

            <InfoBox icon="information-circle-outline" color={T.accent} bgColor={T.accentSoft}>
              {t("tm.s2info")}
            </InfoBox>
          </Section>

          {/* 3. Conditions d'accès */}
          <Section icon="person-outline" title={t("tm.s3")} color="#7C3AED" bgColor="#F5F3FF">
            <Para>{t("tm.s3intro", { app: branding.name })}</Para>
            <Bullet>{t("tm.s3b1")}</Bullet>
            <Bullet>{t("tm.s3b2")}</Bullet>
            <Bullet>{t("tm.s3b3")}</Bullet>
            <Bullet>{t("tm.s3b4")}</Bullet>
            <Bullet>{t("tm.s3b5")}</Bullet>

            <InfoBox icon="alert-circle-outline" color={T.amber} bgColor={T.amberSoft}>
              {t("tm.s3info")}
            </InfoBox>
          </Section>

          {/* 4. Tarifs */}
          <Section icon="card-outline" title={t("tm.s4")} color={T.amber} bgColor={T.amberSoft}>
            <Para>{rich(t("tm.s4p1"))}</Para>
            <Bullet>{t("tm.s4b1")}</Bullet>
            <Bullet>{t("tm.s4b2")}</Bullet>
            <Bullet>{t("tm.s4b3")}</Bullet>
            <Bullet>{t("tm.s4b4")}</Bullet>

            <InfoBox icon="checkmark-circle-outline" color={T.green} bgColor={T.greenSoft}>
              {t("tm.s4info")}
            </InfoBox>
          </Section>

          {/* 5. Annulation & remboursement */}
          <Section icon="arrow-undo-outline" title={t("tm.s5")} color="#0284C7" bgColor="#E0F2FE">
            <Para>{rich(t("tm.s5p1"))}</Para>
            <Bullet>{t("tm.s5b1")}</Bullet>
            <Bullet>{t("tm.s5b2")}</Bullet>
            <Bullet>{t("tm.s5b3")}</Bullet>
            <Bullet>{t("tm.s5b4")}</Bullet>
          </Section>

          {/* 6. Plafonds */}
          <Section icon="speedometer-outline" title={t("tm.s6")} color={T.green} bgColor={T.greenSoft}>
            <Para>{t("tm.s6p1")}</Para>
            <Bullet>{rich(t("tm.s6b0"))}</Bullet>
            <Bullet>{rich(t("tm.s6b1"))}</Bullet>
            <Bullet>{rich(t("tm.s6b2"))}</Bullet>
            <Bullet>{rich(t("tm.s6b3"))}</Bullet>
            <Para>{t("tm.s6p2", { app: branding.name })}</Para>
          </Section>

          {/* 7. Responsabilité */}
          <Section icon="shield-outline" title={t("tm.s7")} color={T.red} bgColor={T.redSoft}>
            <Para>{t("tm.s7p1", { app: branding.name })}</Para>
            <Para>{t("tm.s7p2")}</Para>
            <Bullet>{t("tm.s7b1")}</Bullet>
            <Bullet>{t("tm.s7b2")}</Bullet>
            <Bullet>{t("tm.s7b3")}</Bullet>
            <Bullet>{t("tm.s7b4")}</Bullet>
          </Section>

          {/* 8. Suspension */}
          <Section icon="ban-outline" title={t("tm.s8")} color={T.red} bgColor={T.redSoft}>
            <Para>{t("tm.s8intro", { app: branding.name })}</Para>
            <Bullet>{t("tm.s8b1")}</Bullet>
            <Bullet>{t("tm.s8b2")}</Bullet>
            <Bullet>{t("tm.s8b3")}</Bullet>
            <Bullet>{t("tm.s8b4")}</Bullet>
            <Bullet>{t("tm.s8b5")}</Bullet>
            <Para>{t("tm.s8p2")}</Para>
          </Section>

          {/* 9. Droit applicable */}
          <Section icon="globe-outline" title={t("tm.s9")} color={T.accent} bgColor={T.accentSoft}>
            <Para>{rich(t("tm.s9p1"))}</Para>
            {!!(branding.mediatorName && branding.mediatorUrl) && (
              <Para>
                {t("tm.s9med")}{"\n"}
                <Text style={{ fontWeight: "700", color: T.text }}>{branding.mediatorName}</Text>{"\n"}
                <Text
                  style={{ color: T.accent, textDecorationLine: "underline" }}
                  onPress={() => Linking.openURL(branding.mediatorUrl as string)}
                >
                  {branding.mediatorUrl.replace(/^https?:\/\//, "")}
                </Text>
              </Para>
            )}
            <Para>{t("tm.s9court", { court: getLegalJurisdiction() ?? t("tm.defaultCourt") })}</Para>
          </Section>

          {/* Mentions légales — ✅ v1.1 : chaque ligne se masque si la
              donnée correspondante n'est pas configurée pour ce tenant */}
          <View style={s.legalCard}>
            <Text style={[s.legalTitle, { fontFamily: T.font.display }]}>{t("tm.legalTitle")}</Text>
            <View style={s.legalRow}>
              <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>{t("tm.company")}</Text>
              <Text style={[s.legalValue, { fontFamily: T.font.sans }]}>{legalName}</Text>
            </View>
            {!!(branding.regulatorAcronym || branding.regulatorLicenseNumber) && (
              <View style={s.legalRow}>
                <Text style={[s.legalKey, { fontFamily: T.font.sans }]}>
                  {t("tm.license", { acronym: branding.regulatorAcronym ?? "" })}
                </Text>
                <Text style={[s.legalValue, { fontFamily: T.font.mono }]}>
                  {[branding.regulatorLicenseNumber, branding.regulatorLicenseType].filter(Boolean).join(" — ")}
                </Text>
              </View>
            )}
            {!!branding.capitalSocial && (
              <View style={s.legalRow}>
                <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>{t("tm.capital")}</Text>
                <Text style={[s.legalValue, { fontFamily: T.font.sans }]}>{branding.capitalSocial}</Text>
              </View>
            )}
            {!!branding.address && (
              <View style={s.legalRow}>
                <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>{t("tm.hq")}</Text>
                <Text style={[s.legalValue, { fontFamily: T.font.sans }]}>{branding.address}</Text>
              </View>
            )}
            {!!branding.contactEmail && (
              <View style={s.legalRow}>
                <Text style={[s.legalKey, { fontFamily: T.font.sans }]}>{t("tm.contact")}</Text>
                <Text
                  style={[s.legalValue, s.legalLink, { fontFamily: T.font.mono }]}
                  onPress={() => Linking.openURL(`mailto:${branding.contactEmail}`)}
                >
                  {branding.contactEmail}
                </Text>
              </View>
            )}
          </View>

          <Text style={[s.version, { fontFamily: T.font.mono }]}>
            {t("tm.version", { version: branding.termsVersion ?? "1.0", date: formatTermsDateLong(branding.termsEffectiveDate) || "—" })}
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  closeBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.text, fontSize: 16, fontWeight: "700" },
  headerSub:   { color: T.textDim, fontSize: 11, marginTop: 1 },
  dsp2Badge:   { backgroundColor: T.accentSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: T.accent + "40" },
  dsp2Txt:     { color: T.accentText, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },

  introBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: T.accentSoft, borderRadius: T.radius.md,
    padding: 16, borderWidth: 1, borderColor: T.accent + "40",
    marginBottom: 20,
  },
  introTxt: { flex: 1, fontSize: 13, color: T.accentText, lineHeight: 20, fontWeight: "500" },

  legalCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 18, borderWidth: 1, borderColor: T.border, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  legalTitle: { fontSize: 15, fontWeight: "700", color: T.text, marginBottom: 14 },
  legalRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  legalKey:   { fontSize: 11, fontWeight: "700", color: T.textDim, flex: 0.45, textTransform: "uppercase", letterSpacing: 0.3 },
  legalValue: { fontSize: 12, fontWeight: "600", color: T.text, flex: 0.55, textAlign: "right" },
  legalLink:  { color: T.accent, textDecorationLine: "underline" },

  version: { textAlign: "center", color: T.textDim, fontSize: 10, letterSpacing: 0.5 },
});