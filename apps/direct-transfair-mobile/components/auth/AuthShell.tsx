// apps/direct-transfair-mobile/components/auth/AuthShell.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// CADRE DES ÉCRANS D'AUTHENTIFICATION v2.9 — Direct Transf'air
// ✅ v2.9 : variante `sea` (téléphone) — fond de MER claire et transparente avec de petits poissons bleus/verts (<SeaBackdrop />), emblème de la marque en bulle,
//    puis UNE carte blanche centrée, plus étroite (≈ 76 % de la largeur), qui contient TOUT : pastille d'état, marque, titre, formulaire, pied de carte et
//    contenu `below` (inscription, liens légaux). Désactivée par défaut : les autres écrans sont inchangés. Ordinateur et variante `hero` inchangés.
// ✅ v2.8 : LOGO DE LA SOCIÉTÉ — quand la société (ou la plateforme) a un logo, il est affiché en grand, centré, sans tuile ni nom (comme une
//    maquette « logo + retour ») ; sans logo ou si l'image ne charge pas : ancienne marque (tuile + nom). Nouvelle prop `trust` (défaut vrai) :
//    `trust={false}` masque la ligne « Connexion chiffrée · Vos données restent protégées » (écran de connexion).
// ✅ v2.7 : CARTE PLUS COMPACTE + FOND ANIMÉ (téléphone). Carte blanche resserrée (marges, titre 22, espace sous le titre), logo un peu plus petit,
//    slogan de la société sous son nom, fond vivant (<AuthBackdrop /> : halos qui dérivent + corridor en pointillés avec étincelles), onde douce qui
//    pulse autour du logo, entrée en cascade (marque → carte → pied de page). Tout en pilote natif ; « Réduire les animations » = rendu statique.
//    Mêmes props, même logique ; ordinateur et ancien cadre clair inchangés.
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

import { LanguagePill } from '../i18n/LanguageSwitcher';
import { ThemePill } from '../theme/ThemeSwitcher';
import { useT } from '../../providers/I18nProvider';
import { useTheme } from '../../providers/ThemeProvider';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '../ui/Icon';
import { TenantMark } from '../brand/BrandMark';
import AuthBackdrop, { useReduceMotion } from './AuthBackdrop';
import SeaBackdrop from './SeaBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTenant } from '../../providers/TenantProvider';
import { buildPalette, darken, FONT, MAX_WIDTH, N, type AuthPalette } from './authTheme';
import { SERIF } from '../ui/fonts';
import { buildColors } from '../ui/theme';

import { Text } from '../ui/Text';
import { themed } from '../wallet/brand';
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
  /** Bandeau sombre avec la marque + carte flottante (ancien style). Lot 12 : désactivé par défaut — fond blanc pur. */
  hero?: boolean;
  /** Variante « mer » : fond marin transparent + carte blanche étroite qui contient tout (y compris `below`). Téléphone seulement. */
  sea?: boolean;
  /** Ligne rassurante « Connexion chiffrée · Vos données restent protégées » sous le formulaire (défaut : affichée). */
  trust?: boolean;
  /** Pastille de langue FR/EN/PT en haut à droite (défaut : affichée sur la variante `sea`, masquée ailleurs). */
  showLang?: boolean;
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
  const { scheme } = useTheme();   // se redessine au changement de thème
  return React.useMemo(() => buildPalette(branding.primaryColor, branding.secondaryColor, scheme), [branding.primaryColor, branding.secondaryColor, scheme]);
}

export default function AuthShell({
  title, subtitle, onBack, compact = false, footer, below, headerRight, hero = false, sea = false, trust = true, showLang, children,
}: Props) {
  const { branding } = useTenant();
  const t = useT();
  // Logo de la société : si l'image ne charge pas, on retombe sur la marque (tuile + nom) tant que l'adresse ne change pas.
  const [logoFailed, setLogoFailed] = useState<string | null>(null);
  const logo = branding.logoUrl && /^https?:\/\//i.test(branding.logoUrl) && branding.logoUrl !== logoFailed ? branding.logoUrl : null;
  const { isDark, scheme } = useTheme();   // thème clair / sombre : l'écran se redessine au changement
  const C = React.useMemo(() => buildColors(branding.primaryColor, branding.secondaryColor, scheme), [branding.primaryColor, branding.secondaryColor, scheme]);
  const insets = useSafeAreaInsets();
  const winW = useBrowserWidth();
  const wide = Platform.OS === 'web' && winW >= 900;
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 6;

  // ── Animations de la variante « carte flottante » (hooks toujours appelés, démarrés seulement si la variante est affichée) ──
  const heroOn = hero && !wide;
  const seaOn = sea && !wide && !heroOn;
  const animOn = heroOn || seaOn;
  const reduce = useReduceMotion();
  const enter = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animOn) return;
    if (reduce) { enter.forEach((v) => v.setValue(1)); pulse.setValue(0); return; }
    enter.forEach((v) => v.setValue(0));
    const delays = [60, 220, 520];
    const durations = [520, 640, 480];
    const intro = Animated.parallel(enter.map((v, i) => Animated.sequence([
      Animated.delay(delays[i]),
      Animated.timing(v, { toValue: 1, duration: durations[i], easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ])));
    intro.start();
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => { intro.stop(); loop.stop(); };
  }, [animOn, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Variante « carte flottante sur dégradé » (téléphone) ──
  if (heroOn) {
    const top = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 8;
    const dark = darken('#111111', 0.72);   // en-tête toujours très sombre (texte blanc dessus), quel que soit le thème
    const mid = darken('#111111', 0.45);
    const tile = compact ? 64 : 80;
    const ringSize = tile + 16;                       // tuile + 2 × 7 de marge + 2 × 1 de liseré
    const ringRadius = Math.round(tile * 0.34) + 8;
    const centerY = 44 + (compact ? 0 : 4) + ringSize / 2;   // rangée du haut (44) + marge + moitié de l'anneau

    return (
      <KeyboardAvoidingView style={[s.root, { backgroundColor: dark }]} behavior="padding">
        <StatusBar barStyle="light-content" backgroundColor={dark} />
        <LinearGradient colors={[mid, dark]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {/* Fond vivant : halos qui dérivent + corridor d'étincelles */}
        <AuthBackdrop top={top} centerY={centerY} drop={compact ? 24 : 32} leaf={C.leaf} sun={C.sun} />

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
                <Pressable onPress={onBack} style={s.heroBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </Pressable>
              ) : <View style={s.backSpacer} />}
              <View style={{ flex: 1 }} />
              {headerRight}
              {showLang ? <ThemePill style={{ marginLeft: 8 }} /> : null}
              {showLang ? <LanguagePill style={{ marginLeft: 8 }} /> : null}
            </View>

            <Animated.View
              style={[
                s.heroBrand, compact && { marginTop: 0, gap: 8, marginBottom: 14 },
                { opacity: enter[0], transform: [
                  { translateY: enter[0].interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
                  { scale: enter[0].interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                ] },
              ]}
            >
              <View style={{ width: ringSize, height: ringSize }}>
                {/* Onde douce qui s'étend autour du logo */}
                {!reduce ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill, s.pulse, { borderRadius: ringRadius },
                      { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] },
                    ]}
                  />
                ) : null}
                <View style={[s.ring, { borderRadius: ringRadius }]}>
                  <TenantMark size={tile} radius={Math.round(tile * 0.29)} background="#FFFFFF" iconColor="#111111" logoScale={0.78} animated />
                </View>
              </View>
              <View style={s.nameBlock}>
                <Text style={s.heroBrandName} numberOfLines={1}>{branding.name}</Text>
                {!compact && branding.tagline ? <Text style={s.heroTagline} numberOfLines={1}>{branding.tagline}</Text> : null}
              </View>
            </Animated.View>

            {/* Carte flottante */}
            <Animated.View
              style={[
                s.floatCard, { backgroundColor: C.surface },
                { opacity: enter[1], transform: [{ translateY: enter[1].interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) }] },
              ]}
            >
              {title ? <Text style={[s.cardTitle, { color: C.ink }]} accessibilityRole="header">{title}</Text> : null}
              {subtitle ? <Text style={[s.cardSub, { color: C.muted }]}>{subtitle}</Text> : null}
              {title || subtitle ? <View style={{ height: 14 }} /> : null}
              {children}
              {footer}
            </Animated.View>

            {below ? (
              <Animated.View
                style={[s.below, { opacity: enter[2], transform: [{ translateY: enter[2].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
              >
                {below}
              </Animated.View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Variante « mer » (téléphone) : eau transparente, poissons bleus/verts, carte blanche étroite qui contient tout ──
  if (seaOn) {
    const tile = 60;
    const ringSize = tile + 24;
    const markBg = darken('#111111', 0.72);       // tuile de la marque : sombre dans les deux thèmes
    const ink = isDark ? C.ink : markBg;          // texte posé sur la carte
    return (
      <KeyboardAvoidingView style={[s.root, { backgroundColor: isDark ? '#0A2231' : '#D3ECF4' }]} behavior="padding">
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#071722' : '#EEF9FB'} />
        <SeaBackdrop />
        {showLang !== false ? <View style={[s.seaLang, { top: topPad - 4 }]} pointerEvents="box-none"><ThemePill /><LanguagePill /></View> : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, s.seaScroll, { paddingTop: topPad, paddingBottom: Math.max(insets.bottom, 14) + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {onBack ? (
            <Pressable onPress={onBack} style={[s.seaBack, isDark && { backgroundColor: 'rgba(22,25,30,0.8)' }]} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={ink} />
            </Pressable>
          ) : null}

          {/* Emblème de la marque dans une bulle claire */}
          <Animated.View
            style={[
              s.seaEmblem,
              { opacity: enter[0], transform: [
                { translateY: enter[0].interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
                { scale: enter[0].interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ] },
            ]}
          >
            <View style={[s.seaHalo, { width: ringSize + 22, height: ringSize + 22, borderRadius: (ringSize + 22) / 2 }, isDark && { backgroundColor: 'rgba(160,210,235,0.10)' }]}>
              <View style={[s.seaRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, isDark && { backgroundColor: 'rgba(160,210,235,0.22)' }]}>
                <TenantMark size={tile} radius={Math.round(tile * 0.3)} background={markBg} iconColor="#FFFFFF" logoScale={0.78} animated />
              </View>
            </View>
          </Animated.View>

          {/* Carte blanche centrée et étroite : TOUT le contenu y est */}
          <Animated.View
            style={[
              s.seaCard,
              { backgroundColor: C.surface, opacity: enter[1], transform: [{ translateY: enter[1].interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] },
            ]}
          >
            {headerRight ? <View style={s.seaPill}>{headerRight}</View> : null}
            <View style={s.seaBrand}>
              <TenantMark size={24} radius={8} background={C.accent} iconColor={C.accentInk} logoScale={0.78} />
              <Text style={[s.seaBrandName, { color: ink }]} numberOfLines={1}>{branding.name}</Text>
            </View>
            {title ? <Text style={[s.seaTitle, { color: ink }]} accessibilityRole="header">{title}</Text> : null}
            {subtitle ? <Text style={[s.cardSub, { color: C.muted }]}>{subtitle}</Text> : null}
            <View style={{ height: 12 }} />
            {children}
            {footer}
            {below ? (
              <View style={[s.seaBelow, { borderTopColor: C.line }]}>{below}</View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: C.bg }]} behavior="padding">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

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
                accessibilityLabel={t('common.back')}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={C.ink} />
              </Pressable>
            ) : (
              <View style={s.backSpacer} />
            )}
            <View style={{ flex: 1 }} />
            {headerRight}
            {showLang ? <ThemePill style={{ marginLeft: 8 }} /> : null}
              {showLang ? <LanguagePill style={{ marginLeft: 8 }} /> : null}
          </View>
          )}

          {/* ── Marque du tenant ── */}
          {wide && !onBack && headerRight ? <View style={s.floatRight}>{headerRight}</View> : null}
          {logo ? (
            <View style={[s.logoWrap, compact && { marginTop: 6 }, wide && !onBack && { marginTop: 0 }]}>
              <Image
                source={{ uri: logo }}
                onError={() => setLogoFailed(logo)}
                style={{ width: '100%', maxWidth: 240, height: compact ? 44 : 58 }}
                resizeMode="contain"
                accessibilityLabel={branding.name}
              />
            </View>
          ) : (
            <View style={[s.brand, compact && { marginTop: 10 }, wide && !onBack && { marginTop: 0 }]}>
              <TenantMark size={34} radius={11} background={C.accent} iconColor={C.accentInk} logoScale={0.78} />
              <Text style={[s.brandName, { color: C.ink }]} numberOfLines={1}>{branding.name}</Text>
            </View>
          )}

          {/* ── Titre ── */}
          <Text style={[s.title, { color: C.ink }, wide && { fontSize: 30, lineHeight: 36, marginTop: 18 }]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={[s.subtitle, { color: C.muted }]}>{subtitle}</Text> : null}

          <View style={[s.body, wide && { marginTop: 22, flexGrow: 0 }]}>{children}</View>

          {trust ? (
            <View style={s.trust}>
              <Ionicons name="lock-closed" size={12} color={N.muted} />
              <Text style={s.trustTxt}>{t('shell.trust')}</Text>
            </View>
          ) : null}
          {footer}
          {below ? <View style={s.below}>{below}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = themed(() => StyleSheet.create({
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

  logoWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  brandName: { fontFamily: FONT.display, fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },

  title:    { fontFamily: SERIF, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5, marginTop: 22 },
  subtitle: { fontFamily: FONT.body, fontSize: 16, lineHeight: 23, marginTop: 8 },
  body:     { marginTop: 26, flexGrow: 1 },

  // — Variante hero (carte flottante) —
  heroInner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 20 },
  heroBack:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  heroBrand: { alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 16 },
  ring:      { padding: 7, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  pulse:     { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  nameBlock: { alignItems: 'center', gap: 2, maxWidth: '100%' },
  heroBrandName: { fontFamily: FONT.display, fontSize: 17, fontWeight: '800', letterSpacing: -0.2, color: '#FFFFFF', textAlign: 'center' },
  heroTagline: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.74)', textAlign: 'center' },
  floatCard: { borderRadius: 26, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12,
               borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
               shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  cardTitle: { fontFamily: SERIF, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  cardSub:   { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19, marginTop: 4, textAlign: 'center' },
  below:     { marginTop: 14, alignItems: 'center' },


  // — Variante mer —
  seaScroll: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  seaBack:   { position: 'absolute', top: 0, left: 16, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
               backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 3 },
  seaEmblem: { alignItems: 'center', marginBottom: -14, zIndex: 2 },
  seaHalo:   { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.28)' },
  seaRing:   { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)',
               shadowColor: '#0F3A4D', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  seaCard:   { width: '76%', minWidth: 286, maxWidth: 360, borderRadius: 28, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12,
               shadowColor: '#14466A', shadowOpacity: 0.26, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  seaPill:   { alignItems: 'center', marginBottom: 8 },
  seaLang:   { position: 'absolute', right: 16, zIndex: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  seaBrand:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  seaBrandName: { fontFamily: FONT.display, fontSize: 14, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  seaTitle:  { fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center', marginTop: 6 },
  seaBelow:  { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },

  trust:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 26 },
  trustTxt: { fontFamily: FONT.body, fontSize: 11.5, color: N.muted },
}));