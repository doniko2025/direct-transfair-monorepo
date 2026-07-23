// apps/direct-transfair-mobile/app/(auth)/assistance.tsx
// =========================================================
// ASSISTANCE & COOKIES v1.1 — Direct Transf'air
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
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Linking, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTenant } from "../../providers/TenantProvider";

const T = {
  bg:         "#FFFBF0",
  surface:    "#FFFFFF",
  accent:     "#D97706",
  accentSoft: "#FEF3C7",
  accentText: "#92400E",
  text:       "#0F172A",
  textSub:    "#374151",
  textDim:    "#6B7280",
  border:     "#E2E8F0",
  borderAmber:"#FDE68A",
  green:      "#059669",
  greenSoft:  "#D1FAE5",
  blue:       "#1D4ED8",
  blueSoft:   "#DBEAFE",
  purple:     "#7C3AED",
  purpleSoft: "#F5F3FF",
  red:        "#DC2626",
  radius: { sm: 10, md: 14, lg: 18 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ✅ v1.1 (nouveau) — filet de sécurité uniquement, jamais utilisé pour
// DONIKO (DEFAULT_BRANDING fournit déjà de vraies valeurs).
const FALLBACK_EMAIL = "support@directtransfair.com";
const FALLBACK_PHONE = "+33123456789";

// ─── Tab bar ──────────────────────────────────────────────
const TABS = [
  { key: "faq",     label: "FAQ",     icon: "help-circle-outline"  },
  { key: "contact", label: "Contact", icon: "chatbubble-outline"   },
  { key: "cookies", label: "Cookies", icon: "settings-outline"     },
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
  wrapOpen: { borderColor: T.borderAmber, backgroundColor: "#FFFDF5" },
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
  return (
    <View style={ctS.wrap}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[ctS.title, { fontFamily: T.font.sans }]}>{title}</Text>
          {required && (
            <View style={ctS.reqBadge}>
              <Text style={[ctS.reqTxt, { fontFamily: T.font.sans }]}>Requis</Text>
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

  const supportEmail = branding.supportEmail || FALLBACK_EMAIL;
  const supportPhone = branding.contactPhone || FALLBACK_PHONE;
  const whatsappRaw   = (branding.whatsappNumber || branding.contactPhone || FALLBACK_PHONE).replace(/\D/g, "");

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
            Assistance & Cookies
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
                  {tab.label}
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
              <SectionLabel label="Transferts" />
              <FaqItem
                q="Combien de temps prend un transfert ?"
                a="La plupart des transferts sont exécutés en quelques minutes. Les virements bancaires peuvent prendre 1 à 3 jours ouvrés selon la banque destinataire et le pays. En cas de vérification de sécurité, un délai supplémentaire peut s'appliquer."
              />
              <FaqItem
                q="Quels sont les frais de transfert ?"
                a="Les frais sont calculés et affichés clairement avant chaque confirmation de transfert. Ils varient selon le montant, la devise, le pays destinataire et le mode de paiement. Vous n'êtes jamais débité de frais cachés."
              />
              <FaqItem
                q="Quels pays peut-on atteindre ?"
                a={`${branding.name} couvre principalement l'Afrique de l'Ouest (Guinée, Sénégal, Mali, Côte d'Ivoire, Burkina Faso, etc.) et l'Europe. La liste complète des destinations est disponible lors de la saisie de votre transfert.`}
              />
              <FaqItem
                q="Comment le bénéficiaire reçoit l'argent ?"
                a="Selon la destination, le bénéficiaire peut recevoir l'argent : en espèces dans une agence partenaire (cash pickup), via virement bancaire sur son compte, ou via mobile money (Orange Money, Wave, MTN, etc.)."
              />
              <FaqItem
                q="Que faire si mon transfert est bloqué ?"
                a="Un transfert peut être mis en attente pour des raisons de sécurité ou de conformité réglementaire. Notre équipe vous contactera par email ou dans l'app si des informations supplémentaires sont nécessaires. Vous pouvez aussi nous contacter via le support."
              />

              <SectionLabel label="Compte & Vérification" />
              <FaqItem
                q="Pourquoi dois-je vérifier mon identité ?"
                a="La vérification d'identité (KYC) est une obligation légale pour tout établissement de paiement, conformément à la directive européenne LCB-FT. Elle nous permet aussi de protéger votre compte contre toute utilisation frauduleuse."
              />
              <FaqItem
                q="Quels documents sont acceptés pour le KYC ?"
                a="Nous acceptons les documents d'identité en cours de validité : carte nationale d'identité, passeport biométrique, titre de séjour. Un justificatif de domicile récent (moins de 3 mois) peut être demandé pour les niveaux supérieurs."
              />
              <FaqItem
                q="Comment augmenter mes plafonds de transfert ?"
                a="Complétez votre vérification d'identité pour passer aux niveaux KYC supérieurs. Plus votre niveau est élevé, plus vos plafonds journaliers et mensuels augmentent. Accédez à 'Mes plafonds' dans votre profil pour voir votre niveau actuel."
              />
              <FaqItem
                q="Comment supprimer mon compte ?"
                a="Vous pouvez demander la suppression de votre compte depuis 'Mon compte → Supprimer mon compte'. Conformément à nos obligations légales, certaines données de transaction sont conservées 10 ans (LCB-FT). Les autres données sont supprimées sous 30 jours."
              />

              <SectionLabel label="Sécurité" />
              <FaqItem
                q="Comment protéger mon compte ?"
                a="Activez la biométrie (Face ID / Touch ID) dans vos paramètres de sécurité, utilisez un mot de passe fort et unique, et ne partagez jamais vos identifiants. En cas de perte ou vol de votre téléphone, révoquez l'appareil dans 'Appareils connectés'."
              />
              <FaqItem
                q="Que faire si je suspecte une activité frauduleuse ?"
                a="Contactez immédiatement notre support via email ou téléphone. Changez votre mot de passe et révoquez tous les appareils inconnus depuis votre profil. Si votre compte est compromis, nous le bloquerons en urgence pour votre protection."
              />
            </View>
          )}

          {/* ── CONTACT ── */}
          {activeTab === "contact" && (
            <View>
              <View style={s.contactBanner}>
                <Ionicons name="headset-outline" size={20} color={T.accent} />
                <Text style={[s.contactBannerTxt, { fontFamily: T.font.sans }]}>
                  Notre équipe est disponible du lundi au vendredi de 9h à 18h (heure de Paris) et le samedi de 9h à 13h.
                </Text>
              </View>

              <SectionLabel label="Nous contacter" />
              <ContactCard
                icon="mail-outline"
                title="Email"
                subtitle="Réponse sous 24h ouvrées"
                action={() => Linking.openURL(`mailto:${supportEmail}`)}
                actionLabel="Écrire"
                color={T.blue}
                bgColor={T.blueSoft}
              />
              <ContactCard
                icon="call-outline"
                title="Téléphone"
                subtitle="Lun–Ven 9h–18h · Sam 9h–13h"
                action={() => Linking.openURL(`tel:${supportPhone}`)}
                actionLabel="Appeler"
                color={T.green}
                bgColor={T.greenSoft}
              />
              <ContactCard
                icon="logo-whatsapp"
                title="WhatsApp"
                subtitle="Réponse rapide, 7j/7 de 8h à 20h"
                action={() => Linking.openURL(`https://wa.me/${whatsappRaw}`)}
                actionLabel="Ouvrir"
                color="#25D366"
                bgColor="#F0FDF4"
              />
              <ContactCard
                icon="chatbubbles-outline"
                title="Chat en direct"
                subtitle="Disponible depuis l'application"
                action={() => {}}
                actionLabel="Bientôt"
                color={T.purple}
                bgColor={T.purpleSoft}
              />

              {/* ✅ v1.1 — carte masquée si aucun médiateur configuré */}
              {!!(branding.mediatorName && branding.mediatorUrl) && (
                <>
                  <SectionLabel label="Médiation" />
                  <View style={s.mediationCard}>
                    <View style={s.mediationIconBox}>
                      <Ionicons name="scale-outline" size={18} color={T.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mediationTitle, { fontFamily: T.font.sans }]}>
                        {branding.mediatorName}
                      </Text>
                      <Text style={[s.mediationDesc, { fontFamily: T.font.sans }]}>
                        Si votre réclamation n'est pas résolue sous 60 jours, vous pouvez saisir gratuitement le {branding.mediatorName}.
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
                  Nous utilisons des cookies pour faire fonctionner notre service et, avec votre accord, pour analyser notre trafic et personnaliser votre expérience.
                </Text>
              </View>

              <SectionLabel label="Préférences des cookies" />

              <View style={s.cookieCard}>
                <CookieToggle
                  title="Cookies essentiels"
                  desc="Authentification, session, sécurité. Indispensables au fonctionnement de l'application."
                  value={true}
                  onChange={() => {}}
                  required
                  color={T.green}
                />
                <CookieToggle
                  title="Cookies analytiques"
                  desc="Mesure d'audience anonymisée pour améliorer nos services (Amplitude, Mixpanel)."
                  value={analyticsEnabled}
                  onChange={setAnalyticsEnabled}
                  color={T.blue}
                />
                <CookieToggle
                  title="Cookies marketing"
                  desc="Affichage de publicités ciblées sur nos partenaires externes."
                  value={marketingEnabled}
                  onChange={setMarketingEnabled}
                  color={T.accent}
                />
                <CookieToggle
                  title="Personnalisation"
                  desc="Adaptation du contenu et des offres à votre profil d'utilisation."
                  value={personalisationEnabled}
                  onChange={setPersonalisationEnabled}
                  color={T.purple}
                />
              </View>

              <SectionLabel label="Détail des cookies utilisés" />

              {[
                { name: "dt_session",    type: "Essentiel",    duree: "Session",  desc: "Maintien de votre connexion sécurisée" },
                { name: "dt_token",      type: "Essentiel",    duree: "30 jours", desc: "Token d'authentification chiffré" },
                { name: "dt_tenant",     type: "Essentiel",    duree: "365 jours",desc: "Identification de votre espace société" },
                { name: "_amplitude",    type: "Analytique",   duree: "13 mois",  desc: "Analyse anonymisée des parcours utilisateurs" },
                { name: "_fbp",          type: "Marketing",    duree: "90 jours", desc: "Suivi des conversions publicitaires Facebook" },
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
                  Enregistrer mes préférences
                </Text>
              </TouchableOpacity>

              <Text style={[s.cookieFooter, { fontFamily: T.font.sans }]}>
                Pour en savoir plus sur la façon dont nous utilisons vos données, consultez notre{" "}
                <Text
                  style={{ color: T.blue, textDecorationLine: "underline" }}
                  onPress={() => router.push("/(auth)/privacy-policy")}
                >
                  Politique de confidentialité
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