// apps/direct-transfair-mobile/app/(auth)/assistance.tsx
// ✅ v3.0 : DESIGN « CORRIDOR » — palette brume / forêt / feuille, polices Manrope (contenu inchangé).
// =========================================================
// ✅ phase 7 : contacts de secours fictifs supprimés (secours via services/platformConfig.ts) ; cartes e-mail / téléphone / WhatsApp masquées si aucun contact n'est configuré.
// ASSISTANCE & COOKIES v1.1 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — palette neutre chaude (fond crème, accent encre, police système) ; contenu et coordonnées dynamiques inchangés.
// ✅ v1.1 : Branding dynamique pour les canaux de contact
//   PROBLÈME RÉSOLU : email/téléphone/WhatsApp/médiateur de support
//   étaient écrits en dur, ainsi qu'une mention "Direct Transf'air"
//   dans une réponse FAQ. Un tenant société voyait les coordonnées de
//   Direct Transf'air plutôt que les siennes.
//   CORRECTIF : useTenant() → email (branding.supportEmail), téléphone
//   (branding.contactPhone), WhatsApp (branding.whatsappNumber, replie
//   sur contactPhone), médiateur (branding.mediatorName/Url — carte
//   masquée si non configuré). FALLBACK_EMAIL/FALLBACK_PHONE ne sont
//   qu'un filet de sécurité pour ne jamais ouvrir un lien "mailto:null"
//   si un tenant société n'a rien configuré — DEFAULT_BRANDING fournit
//   déjà de vraies valeurs pour le tenant plateforme (DONIKO).
//   ✅ Fix annexe : même crash "GO_BACK not handled" que terms.tsx,
//   même correctif (router.canGoBack()).
// ✅ v1.0 : FAQ transferts d'argent, cookies (RGPD), canaux de contact
// =========================================================

import React, { useState } from "react";
import {
  View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform, Linking, Switch,
} from 'react-native';
import { useRouter } from "expo-router";
import { Ionicons } from '../../components/ui/Icon';
import { useTenant } from "../../providers/TenantProvider";
import { getFallbackSupportEmail, getFallbackSupportPhone } from "../../services/platformConfig";
import { useT } from "../../providers/I18nProvider";

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
  borderAmber:"#E0E0E0",
  green:      "#1B8A4B",
  greenSoft:  "#E8F5ED",
  blue:       "#1D4ED8",
  blueSoft:   "#DBEAFE",
  purple:     "#7C3AED",
  purpleSoft: "#F5F3FF",
  red:        "#DC2626",
  radius: { sm: 10, md: 14, lg: 18 },
  font: {
    display: Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
    sans:    Platform.select({ ios: "System", android: "sans-serif", default: "system-ui, sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ✅ v1.1 (nouveau) — filet de sécurité uniquement, jamais utilisé pour
// DONIKO (DEFAULT_BRANDING fournit déjà de vraies valeurs).
// ✅ phase 7 : plus de contact fictif en dur — secours configurables (EXPO_PUBLIC_SUPPORT_EMAIL / _PHONE), sinon carte masquée.
const FALLBACK_EMAIL = getFallbackSupportEmail();
const FALLBACK_PHONE = getFallbackSupportPhone();

// ─── Tab bar ──────────────────────────────────────────────
const TABS = [
  { key: "faq",     label: "as.tabFaq",     icon: "help-circle-outline"  },
  { key: "contact", label: "as.tabContact", icon: "chatbubble-outline"   },
  { key: "cookies", label: "as.tabCookies", icon: "settings-outline"     },
] as const;
type TabKey = typeof TABS[number]["key"];

// ─── FAQ Item ─────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[faqS.wrap, open && faqS.wrapOpen]}
      onPress={() => setOpen(!open)}
      activeOpacity={0.85}
    >
      <View style={faqS.row}>
        <Text style={[faqS.q, { fontFamily: T.font.sans }]}>{q}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16} color={T.accent}
        />
      </View>
      {open && (
        <Text style={[faqS.a, { fontFamily: T.font.sans }]}>{a}</Text>
      )}
    </TouchableOpacity>
  );
}
const faqS = StyleSheet.create({
  wrap:     { backgroundColor: T.surface, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  wrapOpen: { borderColor: T.borderAmber, backgroundColor: "#FFFFFF" },
  row:      { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  q:        { flex: 1, fontSize: 13, fontWeight: "700", color: T.text, lineHeight: 20 },
  a:        { marginTop: 12, fontSize: 13, color: T.textSub, lineHeight: 21, fontWeight: "500" },
});

// ─── Contact Card ─────────────────────────────────────────
function ContactCard({ icon, title, subtitle, action, actionLabel, color, bgColor }: {
  icon: string; title: string; subtitle: string;
  action: () => void; actionLabel: string;
  color: string; bgColor: string;
}) {
  return (
    <View style={[ccS.card, { borderColor: color + "30" }]}>
      <View style={[ccS.iconBox, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ccS.title, { fontFamily: T.font.sans }]}>{title}</Text>
        <Text style={[ccS.sub,   { fontFamily: T.font.sans }]}>{subtitle}</Text>
      </View>
      <TouchableOpacity
        style={[ccS.btn, { backgroundColor: bgColor, borderColor: color + "40" }]}
        onPress={action}
        activeOpacity={0.8}
      >
        <Text style={[ccS.btnTxt, { color, fontFamily: T.font.sans }]}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}
const ccS = StyleSheet.create({
  card:   { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 16, borderWidth: 1, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  iconBox:{ width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  title:  { fontSize: 14, fontWeight: "700", color: T.text, marginBottom: 2 },
  sub:    { fontSize: 11, color: T.textDim, lineHeight: 16 },
  btn:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  btnTxt: { fontSize: 11, fontWeight: "800" },
});

// ─── Cookie Toggle ────────────────────────────────────────
function CookieToggle({ title, desc, value, onChange, required = false, color }: {
  title: string; desc: string; value: boolean;
  onChange: (v: boolean) => void; required?: boolean; color: string;
}) {
  const t = useT();
  return (
    <View style={ctS.wrap}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[ctS.title, { fontFamily: T.font.sans }]}>{title}</Text>
          {required && (
            <View style={ctS.reqBadge}>
              <Text style={[ctS.reqTxt, { fontFamily: T.font.sans }]}>{t("as.required")}</Text>
            </View>
          )}
        </View>
        <Text style={[ctS.desc, { fontFamily: T.font.sans }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={required ? undefined : onChange}
        disabled={required}
        trackColor={{ false: "#E2E8F0", true: color }}
        thumbColor={T.surface}
        style={{ marginLeft: 8 }}
      />
    </View>
  );
}
const ctS = StyleSheet.create({
  wrap:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  title:    { fontSize: 13, fontWeight: "700", color: T.text },
  desc:     { fontSize: 11, color: T.textDim, lineHeight: 17 },
  reqBadge: { backgroundColor: "#F3F4F6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  reqTxt:   { fontSize: 9, fontWeight: "800", color: T.textDim, letterSpacing: 0.5 },
});

// ─── Section Header ───────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <View style={slS.row}>
      <View style={slS.dot} />
      <Text style={[slS.t, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const slS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.accent },
  t:   { fontSize: 10, fontWeight: "900", color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AssistanceScreen() {
  const t = useT();
  const router = useRouter();
  const { branding } = useTenant(); // ✅ v1.1 (nouveau)
  const [activeTab, setActiveTab] = useState<TabKey>("faq");

  const [analyticsEnabled,   setAnalyticsEnabled]   = useState(true);
  const [marketingEnabled,   setMarketingEnabled]   = useState(false);
  const [personalisationEnabled, setPersonalisationEnabled] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/login-v2");
  };

  const supportEmail = branding.supportEmail || FALLBACK_EMAIL || "";
  const supportPhone = branding.contactPhone || FALLBACK_PHONE || "";
  const whatsappRaw   = (branding.whatsappNumber || branding.contactPhone || FALLBACK_PHONE || "").replace(/\D/g, "");

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={goBack} hitSlop={12}>
            <Ionicons name="close" size={20} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
            {t("as.title")}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={15}
                  color={active ? T.accent : T.textDim}
                />
                <Text style={[
                  s.tabTxt, { fontFamily: T.font.sans },
                  active && s.tabTxtActive,
                ]}>
                  {t(tab.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── FAQ ── */}
          {activeTab === "faq" && (
            <View>
              <SectionLabel label={t("as.secTransfers")} />
              <FaqItem
                q={t("as.q1")}
                a={t("as.a1")}
              />
              <FaqItem
                q={t("as.q2")}
                a={t("as.a2")}
              />
              <FaqItem
                q={t("as.q3")}
                a={t("as.a3", { app: branding.name })}
              />
              <FaqItem
                q={t("as.q4")}
                a={t("as.a4")}
              />
              <FaqItem
                q={t("as.q5")}
                a={t("as.a5")}
              />

              <SectionLabel label={t("as.secAccount")} />
              <FaqItem
                q={t("as.q6")}
                a={t("as.a6")}
              />
              <FaqItem
                q={t("as.q7")}
                a={t("as.a7")}
              />
              <FaqItem
                q={t("as.q8")}
                a={t("as.a8")}
              />
              <FaqItem
                q={t("as.q9")}
                a={t("as.a9")}
              />

              <SectionLabel label={t("as.secSecurity")} />
              <FaqItem
                q={t("as.q10")}
                a={t("as.a10")}
              />
              <FaqItem
                q={t("as.q11")}
                a={t("as.a11")}
              />
            </View>
          )}

          {/* ── CONTACT ── */}
          {activeTab === "contact" && (
            <View>
              <View style={s.contactBanner}>
                <Ionicons name="headset-outline" size={20} color={T.accent} />
                <Text style={[s.contactBannerTxt, { fontFamily: T.font.sans }]}>
                  {t("as.hours")}
                </Text>
              </View>

              <SectionLabel label={t("as.contactUs")} />
              {!!supportEmail && <ContactCard
                icon="mail-outline"
                title={t("as.email")}
                subtitle={t("as.emailSub")}
                action={() => Linking.openURL(`mailto:${supportEmail}`)}
                actionLabel={t("as.write")}
                color={T.blue}
                bgColor={T.blueSoft}
              />}
              {!!supportPhone && <ContactCard
                icon="call-outline"
                title={t("as.phone")}
                subtitle={t("as.phoneSub")}
                action={() => Linking.openURL(`tel:${supportPhone}`)}
                actionLabel={t("as.call")}
                color={T.green}
                bgColor={T.greenSoft}
              />}
              {!!whatsappRaw && <ContactCard
                icon="logo-whatsapp"
                title="WhatsApp"
                subtitle={t("as.whatsappSub")}
                action={() => Linking.openURL(`https://wa.me/${whatsappRaw}`)}
                actionLabel={t("as.open")}
                color="#25D366"
                bgColor="#F0FDF4"
              />}
              <ContactCard
                icon="chatbubbles-outline"
                title={t("as.chat")}
                subtitle={t("as.chatSub")}
                action={() => {}}
                actionLabel={t("as.soon")}
                color={T.purple}
                bgColor={T.purpleSoft}
              />

              {/* ✅ v1.1 — carte masquée si aucun médiateur configuré */}
              {!!(branding.mediatorName && branding.mediatorUrl) && (
                <>
                  <SectionLabel label={t("as.mediation")} />
                  <View style={s.mediationCard}>
                    <View style={s.mediationIconBox}>
                      <Ionicons name="scale-outline" size={18} color={T.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mediationTitle, { fontFamily: T.font.sans }]}>
                        {branding.mediatorName}
                      </Text>
                      <Text style={[s.mediationDesc, { fontFamily: T.font.sans }]}>
                        {t("as.mediationDesc", { name: branding.mediatorName ?? "" })}
                      </Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(branding.mediatorUrl as string)}
                      >
                        <Text style={[s.mediationLink, { fontFamily: T.font.mono }]}>
                          {(branding.mediatorUrl as string).replace(/^https?:\/\//, "")} →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── COOKIES ── */}
          {activeTab === "cookies" && (
            <View>
              <View style={s.cookieBanner}>
                <Ionicons name="information-circle-outline" size={20} color={T.blue} />
                <Text style={[s.cookieBannerTxt, { fontFamily: T.font.sans }]}>
                  {t("as.cookieIntro")}
                </Text>
              </View>

              <SectionLabel label={t("as.cookiePrefs")} />

              <View style={s.cookieCard}>
                <CookieToggle
                  title={t("as.ckEssential")}
                  desc={t("as.ckEssentialD")}
                  value={true}
                  onChange={() => {}}
                  required
                  color={T.green}
                />
                <CookieToggle
                  title={t("as.ckAnalytics")}
                  desc={t("as.ckAnalyticsD")}
                  value={analyticsEnabled}
                  onChange={setAnalyticsEnabled}
                  color={T.blue}
                />
                <CookieToggle
                  title={t("as.ckMarketing")}
                  desc={t("as.ckMarketingD")}
                  value={marketingEnabled}
                  onChange={setMarketingEnabled}
                  color={T.accent}
                />
                <CookieToggle
                  title={t("as.ckPerso")}
                  desc={t("as.ckPersoD")}
                  value={personalisationEnabled}
                  onChange={setPersonalisationEnabled}
                  color={T.purple}
                />
              </View>

              <SectionLabel label={t("as.cookieDetail")} />

              {[
                { name: "dt_session",    type: t("as.typeEssential"),  duree: t("as.durSession"), desc: t("as.ck1") },
                { name: "dt_token",      type: t("as.typeEssential"),  duree: t("as.dur30d"),     desc: t("as.ck2") },
                { name: "dt_tenant",     type: t("as.typeEssential"),  duree: t("as.dur365d"),    desc: t("as.ck3") },
                { name: "_amplitude",    type: t("as.typeAnalytics"),  duree: t("as.dur13m"),     desc: t("as.ck4") },
                { name: "_fbp",          type: t("as.typeMarketing"),  duree: t("as.dur90d"),     desc: t("as.ck5") },
              ].map((cookie) => (
                <View key={cookie.name} style={s.cookieRow}>
                  <Text style={[s.cookieName, { fontFamily: T.font.mono }]}>{cookie.name}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cookieDesc, { fontFamily: T.font.sans }]}>{cookie.desc}</Text>
                    <Text style={[s.cookieMeta, { fontFamily: T.font.sans }]}>
                      {cookie.type} · {cookie.duree}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={s.saveBtn}
                activeOpacity={0.85}
                onPress={goBack}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={T.surface} />
                <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>
                  {t("as.savePrefs")}
                </Text>
              </TouchableOpacity>

              <Text style={[s.cookieFooter, { fontFamily: T.font.sans }]}>
                {t("as.moreInfo")}
                <Text
                  style={{ color: T.blue, textDecorationLine: "underline" }}
                  onPress={() => router.push("/(auth)/privacy-policy")}
                >
                  {t("as.privacy")}
                </Text>.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14,
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  closeBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: T.text },

  tabBar: {
    flexDirection: "row", backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
    paddingHorizontal: 16,
  },
  tab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:    { borderBottomColor: T.accent },
  tabTxt:       { fontSize: 12, fontWeight: "600", color: T.textDim },
  tabTxtActive: { color: T.accent, fontWeight: "800" },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  contactBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: T.accentSoft, borderRadius: T.radius.md,
    padding: 14, borderWidth: 1, borderColor: T.borderAmber, marginBottom: 18,
  },
  contactBannerTxt: { flex: 1, fontSize: 12, color: T.accentText, lineHeight: 19, fontWeight: "500" },

  mediationCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 16, borderWidth: 1, borderColor: T.border, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  mediationIconBox:  { width: 36, height: 36, borderRadius: 10, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" },
  mediationTitle:    { fontSize: 14, fontWeight: "700", color: T.text, marginBottom: 4 },
  mediationDesc:     { fontSize: 12, color: T.textDim, lineHeight: 18, marginBottom: 8 },
  mediationLink:     { fontSize: 12, color: T.blue, fontWeight: "700" },

  cookieBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: T.blueSoft, borderRadius: T.radius.md,
    padding: 14, borderWidth: 1, borderColor: T.blue + "30", marginBottom: 18,
  },
  cookieBannerTxt: { flex: 1, fontSize: 12, color: T.blue, lineHeight: 19, fontWeight: "500" },

  cookieCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: T.border,
    marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },

  cookieRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  cookieName: { fontSize: 10, fontWeight: "700", color: T.accent, backgroundColor: T.accentSoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, marginTop: 2 },
  cookieDesc: { fontSize: 12, color: T.textSub, lineHeight: 18 },
  cookieMeta: { fontSize: 10, color: T.textDim, marginTop: 2 },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.accent, borderRadius: T.radius.md,
    paddingVertical: 16, marginTop: 18, marginBottom: 10,
  },
  saveTxt: { color: T.surface, fontWeight: "800", fontSize: 14 },

  cookieFooter: { fontSize: 11, color: T.textDim, textAlign: "center", lineHeight: 17, marginBottom: 8 },
});