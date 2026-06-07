// apps/direct-transfair-mobile/app/(auth)/terms.tsx
// =========================================================
// CONDITIONS GÉNÉRALES D'UTILISATION v1.0
// + MENTIONS LÉGALES — Direct Transf'air
// ✅ Conforme directive DSP2 (Services de paiement)
// ✅ Droit applicable : France
// ✅ Présentation modale depuis index.tsx
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const T = {
  bg:         "#F8FAFF",
  surface:    "#FFFFFF",
  accent:     "#1D4ED8",
  accentSoft: "#EFF6FF",
  accentText: "#1E3A8A",
  text:       "#0F172A",
  textSub:    "#374151",
  textDim:    "#6B7280",
  border:     "#E2E8F0",
  green:      "#059669",
  greenSoft:  "#D1FAE5",
  red:        "#DC2626",
  redSoft:    "#FEF2F2",
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
              Conditions générales
            </Text>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
              Mise à jour : Juin 2025
            </Text>
          </View>
          <View style={s.dsp2Badge}>
            <Text style={[s.dsp2Txt, { fontFamily: T.font.sans }]}>DSP2</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={s.introBanner}>
            <Ionicons name="document-text" size={20} color={T.accent} />
            <Text style={[s.introTxt, { fontFamily: T.font.sans }]}>
              Les présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation de l'application Direct Transf'air. En utilisant notre service, vous acceptez sans réserve ces conditions.
            </Text>
          </View>

          {/* 1. Objet */}
          <Section icon="information-circle-outline" title="1. Objet et acceptation" color={T.accent} bgColor={T.accentSoft}>
            <Para>
              Direct Transf'air est une plateforme de transfert d'argent international opérée par <Text style={{ fontWeight: "700", color: T.text }}>Direct Transf'air SAS</Text>, établissement de paiement agréé par l'Autorité de Contrôle Prudentiel et de Résolution (ACPR).
            </Para>
            <Para>
              L'utilisation du service vaut acceptation des présentes CGU. Direct Transf'air se réserve le droit de les modifier à tout moment, avec notification préalable de 30 jours pour les modifications substantielles.
            </Para>
          </Section>

          {/* 2. Services */}
          <Section icon="swap-horizontal-outline" title="2. Services proposés" color={T.green} bgColor={T.greenSoft}>
            <Para>Direct Transf'air propose les services suivants :</Para>
            <Bullet>Transferts d'argent internationaux vers l'Afrique de l'Ouest et le monde</Bullet>
            <Bullet>Paiements en espèces via les agences partenaires (cash pickup)</Bullet>
            <Bullet>Virements bancaires et dépôts sur comptes mobile money</Bullet>
            <Bullet>Conversion de devises (EUR, XOF, GNF, USD, GBP)</Bullet>
            <Bullet>Portefeuille électronique (wallet) et gestion de bénéficiaires</Bullet>
            <Bullet>Virements programmés et récurrents</Bullet>

            <InfoBox icon="information-circle-outline" color={T.accent} bgColor={T.accentSoft}>
              Les services sont soumis à disponibilité selon les pays destinataires et peuvent varier selon votre niveau de vérification KYC.
            </InfoBox>
          </Section>

          {/* 3. Conditions d'accès */}
          <Section icon="person-outline" title="3. Conditions d'accès" color="#7C3AED" bgColor="#F5F3FF">
            <Para>Pour utiliser Direct Transf'air, vous devez :</Para>
            <Bullet>Être âgé d'au moins 18 ans</Bullet>
            <Bullet>Résider dans un pays éligible au service</Bullet>
            <Bullet>Fournir des informations d'identité exactes et à jour</Bullet>
            <Bullet>Compléter la vérification d'identité (KYC) selon les niveaux requis</Bullet>
            <Bullet>Ne pas utiliser le service à des fins illicites ou frauduleuses</Bullet>

            <InfoBox icon="alert-circle-outline" color={T.amber} bgColor={T.amberSoft}>
              Toute fausse déclaration ou tentative de fraude entraîne la suspension immédiate du compte et peut faire l'objet de poursuites judiciaires.
            </InfoBox>
          </Section>

          {/* 4. Tarifs */}
          <Section icon="card-outline" title="4. Tarifs et frais" color={T.amber} bgColor={T.amberSoft}>
            <Para>
              Les frais applicables sont affichés <Text style={{ fontWeight: "700" }}>avant confirmation</Text> de chaque transaction. Vous acceptez explicitement les frais avant d'initier tout transfert.
            </Para>
            <Bullet>Les frais sont exprimés en montant fixe et/ou en pourcentage selon la destination</Bullet>
            <Bullet>Les taux de change appliqués incluent une marge commerciale</Bullet>
            <Bullet>Aucuns frais cachés ne sont prélevés après votre validation</Bullet>
            <Bullet>Les promotions et réductions sont soumises à conditions et durées limitées</Bullet>

            <InfoBox icon="checkmark-circle-outline" color={T.green} bgColor={T.greenSoft}>
              Conformément à la DSP2, vous recevez une confirmation détaillée (montant, frais, taux, montant final) avant chaque paiement.
            </InfoBox>
          </Section>

          {/* 5. Annulation & remboursement */}
          <Section icon="arrow-undo-outline" title="5. Annulation et remboursement" color="#0284C7" bgColor="#E0F2FE">
            <Para>
              <Text style={{ fontWeight: "700" }}>Droit de rétractation :</Text> Conformément à l'article L.221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s'applique pas aux services de paiement dont l'exécution a commencé avec votre accord exprès.
            </Para>
            <Bullet>Un transfert peut être annulé tant qu'il est en statut "En attente" (PENDING)</Bullet>
            <Bullet>Un transfert validé ou payé ne peut plus être annulé unilatéralement</Bullet>
            <Bullet>En cas d'erreur avérée de notre part, le remboursement est effectué sous 5 jours ouvrés</Bullet>
            <Bullet>Les réclamations doivent être soumises dans les 30 jours suivant la transaction</Bullet>
          </Section>

          {/* 6. Plafonds */}
          <Section icon="speedometer-outline" title="6. Plafonds et limites" color={T.green} bgColor={T.greenSoft}>
            <Para>
              Les plafonds de transfert sont déterminés par votre niveau de vérification KYC et par la réglementation applicable :
            </Para>
            <Bullet><Text style={{ fontWeight: "700" }}>KYC Niveau 0 :</Text> 150 € / jour — 600 € / mois</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>KYC Niveau 1 :</Text> 500 € / jour — 2 500 € / mois</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>KYC Niveau 2 :</Text> 2 000 € / jour — 10 000 € / mois</Bullet>
            <Bullet><Text style={{ fontWeight: "700" }}>KYC Niveau 3 :</Text> Plafonds personnalisés sur demande</Bullet>
            <Para>
              Ces plafonds peuvent être ajustés par Direct Transf'air en fonction des exigences réglementaires LCB-FT.
            </Para>
          </Section>

          {/* 7. Responsabilité */}
          <Section icon="shield-outline" title="7. Responsabilité" color={T.red} bgColor={T.redSoft}>
            <Para>
              Direct Transf'air s'engage à exécuter les transferts dans les meilleurs délais, généralement entre quelques minutes et 3 jours ouvrés selon la destination et le mode de paiement.
            </Para>
            <Para>
              Notre responsabilité est limitée aux dommages directs résultant d'une faute avérée de notre part. Elle est exclue en cas de :
            </Para>
            <Bullet>Force majeure ou événement hors de notre contrôle</Bullet>
            <Bullet>Informations erronées fournies par l'utilisateur</Bullet>
            <Bullet>Blocage par les autorités compétentes (compliance, LCB-FT)</Bullet>
            <Bullet>Défaillance des systèmes bancaires correspondants</Bullet>
          </Section>

          {/* 8. Suspension */}
          <Section icon="ban-outline" title="8. Suspension et clôture" color={T.red} bgColor={T.redSoft}>
            <Para>Direct Transf'air se réserve le droit de suspendre ou clôturer un compte dans les cas suivants :</Para>
            <Bullet>Non-respect des présentes CGU</Bullet>
            <Bullet>Suspicion de fraude, blanchiment ou financement du terrorisme</Bullet>
            <Bullet>Fausse déclaration lors de la vérification d'identité</Bullet>
            <Bullet>Inactivité prolongée (plus de 24 mois)</Bullet>
            <Bullet>Demande de l'utilisateur</Bullet>
            <Para>
              En cas de solde positif, le montant est restitué après vérification de l'identité, déduction faite des éventuels frais dus.
            </Para>
          </Section>

          {/* 9. Droit applicable */}
          <Section icon="globe-outline" title="9. Droit applicable et litiges" color={T.accent} bgColor={T.accentSoft}>
            <Para>
              Les présentes CGU sont soumises au <Text style={{ fontWeight: "700" }}>droit français</Text>. En cas de litige, une solution amiable sera recherchée en priorité.
            </Para>
            <Para>
              Conformément aux articles L.616-1 et R.616-1 du Code de la consommation, vous pouvez recourir gratuitement au service de médiation :{"\n"}
              <Text style={{ fontWeight: "700", color: T.text }}>Médiateur de l'ACPR</Text>{"\n"}
              <Text
                style={{ color: T.accent, textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("https://www.acpr.banque-france.fr")}
              >
                www.acpr.banque-france.fr
              </Text>
            </Para>
            <Para>
              À défaut de résolution amiable, les tribunaux compétents sont ceux du ressort de la Cour d'Appel de Paris.
            </Para>
          </Section>

          {/* Mentions légales */}
          <View style={s.legalCard}>
            <Text style={[s.legalTitle, { fontFamily: T.font.display }]}>Mentions légales</Text>
            <View style={s.legalRow}>
              <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>Société</Text>
              <Text style={[s.legalValue, { fontFamily: T.font.sans }]}>Direct Transf'air SAS</Text>
            </View>
            <View style={s.legalRow}>
              <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>Agrément ACPR</Text>
              <Text style={[s.legalValue, { fontFamily: T.font.mono }]}>N° 12345 — Établissement de paiement</Text>
            </View>
            <View style={s.legalRow}>
              <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>Capital social</Text>
              <Text style={[s.legalValue, { fontFamily: T.font.sans }]}>100 000 € entièrement libéré</Text>
            </View>
            <View style={s.legalRow}>
              <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>Siège social</Text>
              <Text style={[s.legalValue, { fontFamily: T.font.sans }]}>Paris, France</Text>
            </View>
            <View style={s.legalRow}>
              <Text style={[s.legalKey,   { fontFamily: T.font.sans }]}>Contact</Text>
              <Text
                style={[s.legalValue, s.legalLink, { fontFamily: T.font.mono }]}
                onPress={() => Linking.openURL("mailto:contact@directtransfair.com")}
              >
                contact@directtransfair.com
              </Text>
            </View>
          </View>

          <Text style={[s.version, { fontFamily: T.font.mono }]}>
            Version 1.0 — En vigueur depuis le 1er Juin 2025
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