// apps/direct-transfair-mobile/components/auth/AuthShell.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// CADRE DES ÉCRANS D'AUTHENTIFICATION v2.2 — Direct Transf'air
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
import { Ionicons } from '../ui/Icon';
import { TenantMark } from '../brand/BrandMark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTenant } from '../../providers/TenantProvider';
import { buildPalette, FONT, MAX_WIDTH, N, type AuthPalette } from './authTheme';
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
  /** Contenu affiché sous le formulaire (liens légaux, aide…). */
  footer?: React.ReactNode;
  /** Élément à droite de la rangée du haut (ex. pastille d'état serveur). */
  headerRight?: React.ReactNode;
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
  title, subtitle, onBack, compact = false, footer, headerRight, children,
}: Props) {
  const { branding } = useTenant();
  const C = React.useMemo(() => buildColors(branding.primaryColor), [branding.primaryColor]);
  const insets = useSafeAreaInsets();
  const winW = useBrowserWidth();
  const wide = Platform.OS === 'web' && winW >= 900;
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 6;

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

  trust:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 26 },
  trustTxt: { fontFamily: FONT.body, fontSize: 11.5, color: N.muted },
});
