// apps/direct-transfair-mobile/components/auth/AuthShell.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// CADRE DES ÉCRANS D'AUTHENTIFICATION v2.6 — Direct Transf'air
// ✅ v2.6 : REFONTE DU CADRE TÉLÉPHONE (style « Rainbow ») — plein écran en dégradé aux couleurs de la société avec halos décoratifs,
//    icône de l'app centrée dans un anneau clair + nom de la marque, puis UNE carte blanche flottante (coins 28, ombre) qui porte le titre et
//    le sous-titre centrés, le formulaire et le `footer`. Nouvelle prop `below` : contenu placé SOUS la carte, en clair sur le fond (ex. « Pas encore
//    de compte ? », liens légaux). Mêmes props qu'avant (title, subtitle, onBack, compact, footer, headerRight, hero, children). Ordinateur inchangé.
// ✅ v2.5 : la mise en page « logo centré » devient celle de TOUS les écrans d'authentification sur téléphone (connexion, mot de passe oublié,
//    inscription, vérification, codes) : même tuile d'icône (112 px) centrée au-dessus, même taille partout. Le titre et le sous-titre passent
//    en tête de la feuille blanche (le bandeau ne porte plus que la marque). `hero={false}` rétablit l'ancien cadre clair. Ordinateur inchangé.
// ✅ v2.4 : variante `hero` ÉPURÉE — plus d'arcs ni de gros titre : l'icône de l'app (tuile arrondie « t’ », même rendu que l'icône du téléphone)
//    centrée sur un fond sombre, le nom de la marque en une ligne, puis la feuille blanche. Titre et sous-titre ne s'affichent que s'ils sont fournis.
// ✅ v2.3 : variante `hero` (téléphone uniquement) — grand bandeau aux couleurs de la société (dégradé forêt, marque, titre blanc,
//    arcs décoratifs) et feuille blanche aux coins arrondis qui chevauche le bandeau et porte le formulaire. Les autres écrans
//    gardent le cadre clair habituel ; sur ordinateur (web ≥ 900 px) la variante est ignorée (carte centrée inchangée).
// ✅ v2.2 : marque via <TenantMark /> (monogramme « t’ » pour la plateforme ; logo du tenant prioritaire ; icône neutre
//    pour une autre société sans logo). Mêmes props, mise en page inchangée.
// ✅ v2.1 : MISE EN PAGE ORDINATEUR (web ≥ 900 px) — avant, la même colonne étroite collée en haut de
//    la page laissait un grand vide crème et obligeait à défiler. Désormais : carte blanche arrondie
//    et ombrée, centrée à l'écran (verticalement et horizontalement), titre un peu plus petit, marque
//    et pastille d'état dans la carte. Sur téléphone / petite fenêtre : rendu strictement inchangé.
// ✅ v2.0 : REFONTE TOTALE en thème clair (inspirée de « Taptap Send » : grand titre, champs sur fond crème,
//    bouton principal en pilule). Plus de dégradé sombre ni de « feuille » : fond crème, rangée du haut
//    (retour / pastille d'état du serveur), marque (logo + nom du tenant), gros titre, sous-titre, contenu.
//    Mêmes props qu'avant (title, subtitle, onBack, compact, footer, headerRight, children) : tous les
//    écrans qui utilisent ce cadre passent au thème clair sans changement de logique.
// ✅ v1.0 : cadre commun (clavier géré, contenu borné sur tablette / web, logo du tenant).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '../ui/Icon';
import { TenantMark } from '../brand/BrandMark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTenant } from '../../providers/TenantProvider';
import { alpha, buildPalette, darken, FONT, MAX_WIDTH, N, type AuthPalette } from './authTheme';
import { SERIF } from '../ui/fonts';
import { buildColors } from '../ui/theme';

import { Text } from '../ui/Text';
type Props = {
  title: string;
  subtitle?: string;
  /** Affiche la flèche de retour. */
  onBack?: () => void;
  /** En-tête réduit (écrans secondaires) : marque plus discrète. */
  compact?: boolean;
  /** Contenu affiché en bas de la carte (aide, changer de compte…). */
  footer?: React.ReactNode;
  /** Contenu placé sous la carte, directement sur le fond dégradé (texte clair attendu). */
  below?: React.ReactNode;
  /** Élément à droite de la rangée du haut (ex. pastille d'état serveur). */
  headerRight?: React.ReactNode;
  /** Bandeau avec la marque centrée + feuille blanche (téléphone). Actif par défaut ; false = ancien cadre clair. */
  hero?: boolean;
  children: React.ReactNode;
};

/**
 * Largeur de la fenêtre du navigateur (0 hors web, et 0 au tout premier rendu).
 * Départ volontairement à 0 : en export statique le HTML est pré-rendu sans fenêtre ; si le 1er rendu client
 * différait, React garderait les styles du pré-rendu (aucune correction d'attributs à l'hydratation).
 * La vraie largeur est lue juste après, ce qui force un rendu propre.
 */
function useBrowserWidth(): number {
  const [w, setW] = useState<number>(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

export function useAuthPalette(): AuthPalette {
  const { branding } = useTenant();
  return React.useMemo(() => buildPalette(branding.primaryColor), [branding.primaryColor]);
}

export default function AuthShell({
  title, subtitle, onBack, compact = false, footer, below, headerRight, hero = true, children,
}: Props) {
  const { branding } = useTenant();
  const C = React.useMemo(() => buildColors(branding.primaryColor), [branding.primaryColor]);
  const insets = useSafeAreaInsets();
  const winW = useBrowserWidth();
  const wide = Platform.OS === 'web' && winW >= 900;
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 6;

  // ── Variante « carte flottante sur dégradé » (téléphone) ──
  if (hero && !wide) {
    const top = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 8;
    const dark = darken(C.forest, 0.72);
    const mid = darken(C.forest, 0.45);
    const tile = compact ? 76 : 92;
    return (
      <KeyboardAvoidingView style={[s.root, { backgroundColor: dark }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="light-content" backgroundColor={dark} />
        <LinearGradient colors={[mid, dark]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {/* Halos décoratifs (couleurs de la société) */}
        <View pointerEvents="none" style={[s.bokeh, { width: 260, height: 260, top: -90, right: -90, backgroundColor: alpha(C.leaf, 0.22) }]} />
        <View pointerEvents="none" style={[s.bokeh, { width: 150, height: 150, top: 150, left: -70, backgroundColor: alpha(C.sun, 0.14) }]} />
        <View pointerEvents="none" style={[s.bokeh, { width: 220, height: 220, bottom: -80, left: -60, backgroundColor: alpha(C.leaf, 0.16) }]} />
        <View pointerEvents="none" style={[s.bokeh, { width: 90, height: 90, bottom: 120, right: -30, backgroundColor: alpha('#FFFFFF', 0.07) }]} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, { paddingTop: top, paddingBottom: Math.max(insets.bottom, 14) + 18 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={s.heroInner}>
            <View style={s.topRow}>
              {onBack ? (
                <Pressable onPress={onBack} style={s.heroBack} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </Pressable>
              ) : <View style={s.backSpacer} />}
              <View style={{ flex: 1 }} />
              {headerRight}
            </View>

            <View style={[s.heroBrand, compact && { marginTop: 0, gap: 10 }]}>
              <View style={[s.ring, { borderRadius: Math.round(tile * 0.34) + 8 }]}>
                <TenantMark size={tile} radius={Math.round(tile * 0.29)} background="#FFFFFF" iconColor={C.dark} logoScale={0.78} animated />
              </View>
              <Text style={s.heroBrandName} numberOfLines={1}>{branding.name}</Text>
            </View>

            {/* Carte flottante */}
            <View style={[s.floatCard, { backgroundColor: C.surface }]}>
              {title ? <Text style={[s.cardTitle, { color: C.ink }]} accessibilityRole="header">{title}</Text> : null}
              {subtitle ? <Text style={[s.cardSub, { color: C.muted }]}>{subtitle}</Text> : null}
              {title || subtitle ? <View style={{ height: 20 }} /> : null}
              {children}
              {footer}
            </View>

            {below ? <View style={s.below}>{below}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: C.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View
          style={[
            s.column,
            wide
              ? [s.card, { backgroundColor: C.surface, borderColor: C.line }]
              : { paddingTop: topPad },
          ]}
        >
          {/* ── Rangée du haut ── */}
          {(!wide || onBack) && (
          <View style={s.topRow}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={[s.backBtn, { backgroundColor: C.surface, borderColor: C.line }]}
                accessibilityRole="button"
                accessibilityLabel="Retour"
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={C.ink} />
              </Pressable>
            ) : (
              <View style={s.backSpacer} />
            )}
            <View style={{ flex: 1 }} />
            {headerRight}
          </View>
          )}

          {/* ── Marque du tenant ── */}
          {wide && !onBack && headerRight ? <View style={s.floatRight}>{headerRight}</View> : null}
          <View style={[s.brand, compact && { marginTop: 10 }, wide && !onBack && { marginTop: 0 }]}>
            <TenantMark size={34} radius={11} background={C.accent} iconColor={C.accentInk} logoScale={0.78} />
            <Text style={[s.brandName, { color: C.ink }]} numberOfLines={1}>{branding.name}</Text>
          </View>

          {/* ── Titre ── */}
          <Text style={[s.title, { color: C.ink }, wide && { fontSize: 30, lineHeight: 36, marginTop: 18 }]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={[s.subtitle, { color: C.muted }]}>{subtitle}</Text> : null}

          <View style={[s.body, wide && { marginTop: 22, flexGrow: 0 }]}>{children}</View>

          <View style={s.trust}>
            <Ionicons name="lock-closed" size={12} color={N.muted} />
            <Text style={s.trustTxt}>Connexion chiffrée · Vos données restent protégées</Text>
          </View>
          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { flexGrow: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: 28 },

  scrollWide: { justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  card: {
    flexGrow: 0, maxWidth: 480, paddingHorizontal: 36, paddingTop: 26, paddingBottom: 26,
    borderRadius: 28, borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 18px 50px rgba(20,20,10,0.08), 0 2px 6px rgba(20,20,10,0.04)' } as any) : {}),
  },

  floatRight: { position: 'absolute', top: -8, right: -14, zIndex: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backSpacer: { width: 44, height: 44 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  brandName: { fontFamily: FONT.display, fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },

  title:    { fontFamily: SERIF, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5, marginTop: 22 },
  subtitle: { fontFamily: FONT.body, fontSize: 16, lineHeight: 23, marginTop: 8 },
  body:     { marginTop: 26, flexGrow: 1 },

  // — Variante hero (carte flottante) —
  heroInner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 20 },
  heroBack:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  heroBrand: { alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 22 },
  ring:      { padding: 7, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  heroBrandName: { fontFamily: FONT.display, fontSize: 17, fontWeight: '800', letterSpacing: -0.2, color: '#FFFFFF', textAlign: 'center' },
  bokeh:     { position: 'absolute', borderRadius: 999 },
  floatCard: { borderRadius: 28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
               shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  cardTitle: { fontFamily: SERIF, fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' },
  cardSub:   { fontFamily: FONT.body, fontSize: 14.5, lineHeight: 21, marginTop: 6, textAlign: 'center' },
  below:     { marginTop: 18, alignItems: 'center' },

  trust:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 26 },
  trustTxt: { fontFamily: FONT.body, fontSize: 11.5, color: N.muted },
});