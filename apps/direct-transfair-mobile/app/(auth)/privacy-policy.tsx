// apps/direct-transfair-mobile/app/(auth)/privacy-policy.tsx
// =========================================================
// POLITIQUE DE CONFIDENTIALITÉ v1.0 — Direct Transf'air
// ✅ Conforme RGPD (Règlement UE 2016/679)
// ✅ Adapté aux obligations PSP / transferts d'argent
// ✅ Présentation modale depuis index.tsx et login.tsx
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const T = {
  bg:         "#F0FDF4",
  surface:    "#FFFFFF",
  accent:     "#059669",
  accentSoft: "#D1FAE5",
  accentText: "#065F46",
  text:       "#0F172A",
  textSub:    "#374151",
  textDim:    "#6B7280",
  border:     "#E2E8F0",
  borderGreen:"#A7F3D0",
  blue:       "#1D4ED8",
  blueSoft:   "#DBEAFE",
  amber:      "#D97706",
  amberSoft:  "#FEF3C7",
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

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
const sS = StyleSheet.create({
  wrap:    { marginBottom: 20, backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  header:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderLeftWidth: 4 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 14, fontWeight: "800", flex: 1 },
  body:    { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
});

// ─── Paragraph ────────────────────────────────────────────
function Para({ children }: { children: React.ReactNode }) {
  return <Text style={[pS.text, { fontFamily: T.font.sans }]}>{children}</Text>;
}
const pS = StyleSheet.create({
  text: { fontSize: 13, color: T.textSub, lineHeight: 21, marginBottom: 10 },
});

// ─── Bullet ───────────────────────────────────────────────
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={bS.row}>
      <View style={[bS.dot, { backgroundColor: T.accent }]} />
      <Text style={[bS.text, { fontFamily: T.font.sans }]}>{children}</Text>
    </View>
  );
}
const bS = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  dot:  { width: 5, height: 5, borderRadius: 99, marginTop: 8, flexShrink: 0 },
  text: { flex: 1, fontSize: 13, color: T.textSub, lineHeight: 20 },
});

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
const rbS = StyleSheet.create({
  box:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10, backgroundColor: T.accentSoft, borderRadius: T.radius.sm, padding: 12 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.surface, justifyContent: "center", alignItems: "center", marginTop: 2 },
  title:   { fontSize: 12, fontWeight: "800", color: T.accentText, marginBottom: 2 },
  desc:    { fontSize: 12, color: T.textSub, lineHeight: 18 },
});

// ─── Main ─────────────────────────────────────────────────
export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
              Politique de confidentialité
            </Text>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
              Mise à jour : Juin 2025
            </Text>
          </View>
          <View style={[s.gdprBadge]}>
            <Text style={[s.gdprTxt, { fontFamily: T.font.sans }]}>RGPD</Text>
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
              Direct Transf'air s'engage à protéger vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679) et à la loi Informatique et Libertés.
            </Text>
          </View>

          {/* 1. Responsable */}
          <Section icon="business-outline" title="1. Responsable du traitement" color={T.accent} bgColor={T.accentSoft}>
            <Para>
              Le responsable du traitement de vos données personnelles est la société <Text style={{ fontWeight: "700", color: T.text }}>Direct Transf'air SAS</Text>, immatriculée au Registre du Commerce et des Sociétés.
            </Para>
            <Para>
              En qualité d'établissement de paiement, Direct Transf'air est soumis à la supervision de l'Autorité de Contrôle Prudentiel et de Résolution (ACPR) et au respect des obligations LCB-FT (Lutte contre le Blanchiment de Capitaux et le Financement du Terrorisme).
            </Para>
          </Section>

          {/* 2. Données collectées */}
          <Section icon="document-text-outline" title="2. Données collectées" color={T.blue} bgColor={T.blueSoft}>
            <Para>Dans le cadre de nos services de transfert d'argent, nous collectons les catégories de données suivantes :</Para>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>Données d'identité (KYC)</Text>
            <Bullet>Nom, prénom, date et lieu de naissance</Bullet>
            <Bullet>Nationalité et pays de résidence</Bullet>
            <Bullet>Pièces d'identité (CNI, passeport, titre de séjour)</Bullet>
            <Bullet>Justificatif de domicile</Bullet>
            <Bullet>Selfie de vérification biométrique</Bullet>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>Données de contact</Text>
            <Bullet>Adresse email et numéro de téléphone</Bullet>
            <Bullet>Adresse postale complète</Bullet>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>Données financières</Text>
            <Bullet>Historique des transactions et virements</Bullet>
            <Bullet>Coordonnées bancaires (IBAN, BIC)</Bullet>
            <Bullet>Numéros de mobile money (Orange Money, Wave, etc.)</Bullet>
            <Bullet>Montants, devises et bénéficiaires des transferts</Bullet>

            <Text style={[s.subTitle, { fontFamily: T.font.sans }]}>Données techniques</Text>
            <Bullet>Adresse IP et informations de connexion</Bullet>
            <Bullet>Identifiant d'appareil et système d'exploitation</Bullet>
            <Bullet>Journaux d'activité et cookies de session</Bullet>
          </Section>

          {/* 3. Finalités */}
          <Section icon="analytics-outline" title="3. Finalités du traitement" color="#7C3AED" bgColor="#F5F3FF">
            <Para>Vos données sont traitées pour les finalités suivantes, sur les bases légales indiquées :</Para>
            <Bullet><Text style={{ fontWeight: "700" }}>Exécution du contrat :</Text> traitement des transferts, gestion de votre compte, service client</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Obligation légale :</Text> vérification d'identité (KYC), lutte contre le blanchiment (LCB-FT), déclaration de soupçon à Tracfin</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Intérêt légitime :</Text> prévention de la fraude, sécurité informatique, amélioration du service</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Consentement :</Text> notifications marketing, cookies non essentiels</Bullet>
          </Section>

          {/* 4. Partage */}
          <Section icon="share-social-outline" title="4. Partage des données" color={T.amber} bgColor={T.amberSoft}>
            <Para>Vos données peuvent être transmises aux catégories de destinataires suivantes :</Para>
            <Bullet>Partenaires bancaires et établissements de paiement pour l'exécution des virements</Bullet>
            <Bullet>Prestataires de vérification d'identité (KYC) et de scoring anti-fraude</Bullet>
            <Bullet>Autorités réglementaires (ACPR, Tracfin, autorités judiciaires) sur réquisition légale</Bullet>
            <Bullet>Prestataires techniques (hébergement, messagerie, push notifications) soumis à des accords de traitement</Bullet>
            <Para>
            <Text style={{ fontWeight: "700", color: T.text, marginTop: 6 }}>Aucune donnée n'est vendue à des tiers à des fins publicitaires.</Text>
            </Para>
          </Section>

          {/* 5. Conservation */}
          <Section icon="time-outline" title="5. Durées de conservation" color="#0284C7" bgColor="#E0F2FE">
            <Bullet><Text style={{ fontWeight: "700" }}>Données de transaction :</Text> 10 ans à compter de la date de l'opération (obligation LCB-FT)</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Documents KYC :</Text> 5 ans après la fin de la relation commerciale</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Données de connexion :</Text> 12 mois (LCEN)</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Données de compte actif :</Text> durée de la relation + 3 ans</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>Cookies :</Text> 13 mois maximum</Bullet>
          </Section>

          {/* 6. Vos droits */}
          <Section icon="person-circle-outline" title="6. Vos droits RGPD" color={T.accent} bgColor={T.accentSoft}>
            <Para>Conformément au RGPD, vous disposez des droits suivants :</Para>
            <RightBox icon="eye-outline"         title="Droit d'accès"       desc="Obtenir une copie de toutes vos données personnelles que nous détenons." />
            <RightBox icon="pencil-outline"      title="Droit de rectification" desc="Corriger toute donnée inexacte ou incomplète vous concernant." />
            <RightBox icon="trash-outline"       title="Droit à l'effacement" desc="Demander la suppression de vos données (sous réserve des obligations légales de conservation)." />
            <RightBox icon="hand-left-outline"   title="Droit d'opposition"  desc="Vous opposer au traitement de vos données à des fins de marketing ou de profilage." />
            <RightBox icon="download-outline"    title="Droit à la portabilité" desc="Recevoir vos données dans un format structuré et lisible par machine." />
            <RightBox icon="pause-circle-outline" title="Droit à la limitation" desc="Demander la suspension du traitement dans certaines circonstances." />
            <Para>
              Pour exercer vos droits, contactez notre Délégué à la Protection des Données :{"\n"}
              <Text
                style={{ color: T.blue, fontWeight: "700", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("mailto:dpo@directtransfair.com")}
              >
                dpo@directtransfair.com
              </Text>
            </Para>
            <Para>
              Vous pouvez également introduire une réclamation auprès de la <Text style={{ fontWeight: "700" }}>CNIL</Text> (Commission Nationale de l'Informatique et des Libertés) sur{" "}
              <Text
                style={{ color: T.blue, textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("https://www.cnil.fr")}
              >
                www.cnil.fr
              </Text>.
            </Para>
          </Section>

          {/* 7. Sécurité */}
          <Section icon="lock-closed-outline" title="7. Sécurité des données" color="#DC2626" bgColor="#FEF2F2">
            <Para>
              Direct Transf'air met en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, perte, destruction ou divulgation :
            </Para>
            <Bullet>Chiffrement TLS 1.3 pour toutes les communications</Bullet>
            <Bullet>Authentification forte (MFA / biométrie)</Bullet>
            <Bullet>Hébergement sur infrastructure certifiée ISO 27001</Bullet>
            <Bullet>Journalisation et surveillance des accès 24h/24</Bullet>
            <Bullet>Hachage irréversible des mots de passe (bcrypt)</Bullet>
          </Section>

          {/* 8. Contact */}
          <View style={s.contactCard}>
            <Ionicons name="mail-outline" size={20} color={T.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactTitle, { fontFamily: T.font.sans }]}>Contact DPO</Text>
              <Text style={[s.contactDesc,  { fontFamily: T.font.sans }]}>
                Pour toute question relative à vos données personnelles :
              </Text>
              <Text
                style={[s.contactLink, { fontFamily: T.font.mono }]}
                onPress={() => Linking.openURL("mailto:dpo@directtransfair.com")}
              >
                dpo@directtransfair.com
              </Text>
            </View>
          </View>

          <Text style={[s.version, { fontFamily: T.font.mono }]}>
            Version 1.0 — Entrée en vigueur : 1er Juin 2025
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
});