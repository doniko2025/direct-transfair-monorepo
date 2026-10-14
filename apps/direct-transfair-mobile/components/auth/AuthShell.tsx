// apps/direct-transfair-mobile/components/auth/AuthShell.tsx
// =========================================================
// CADRE DES ÉCRANS D'AUTHENTIFICATION v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Structure commune à tous les écrans : dégradé de marque, en-tête avec
// logo, « feuille » blanche arrondie qui occupe toute la hauteur
// (plus de grand vide en bas), clavier géré, contenu centré et borné
// sur tablette / web. Le logo et la couleur viennent du tenant.
// =========================================================

import React from 'react';
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTenant } from '../../providers/TenantProvider';
import { alpha, buildPalette, FONT, MAX_WIDTH, N, RADIUS, SHADOW, type AuthPalette } from './authTheme';

type Props = {
  title: string;
  subtitle?: string;
  /** Affiche la flèche de retour. */
  onBack?: () => void;
  /** En-tête réduit (écrans secondaires) : le logo devient une simple pastille. */
  compact?: boolean;
  /** Contenu affiché sous la feuille (liens légaux, aide…). */
  footer?: React.ReactNode;
  /** Élément à droite du titre de l'en-tête (ex. pastille d'état serveur). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

export function useAuthPalette(): AuthPalette {
  const { branding } = useTenant();
  return React.useMemo(() => buildPalette(branding.primaryColor), [branding.primaryColor]);
}

export default function AuthShell({
  title, subtitle, onBack, compact = false, footer, headerRight, children,
}: Props) {
  const { branding } = useTenant();
  const P = useAuthPalette();
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 20) + 8;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: P.bg2 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={P.bg1} />

      <LinearGradient
        colors={[P.bg1, P.bg2, P.bg3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[s.orb, s.orbA, { backgroundColor: alpha('#FFFFFF', 0.06) }]} />
      <View pointerEvents="none" style={[s.orb, s.orbB, { backgroundColor: alpha('#FFFFFF', 0.05) }]} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={s.column}>
          {/* ── En-tête ── */}
          <View style={[s.header, { paddingTop: topPad }, compact && s.headerCompact]}>
            <View style={s.headerRow}>
              {onBack ? (
                <TouchableOpacity
                  onPress={onBack}
                  style={s.backBtn}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Retour"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="arrow-back" size={20} color={N.white} />
                </TouchableOpacity>
              ) : (
                <View style={s.backSpacer} />
              )}
              <View style={{ flex: 1 }} />
              {headerRight}
            </View>

            <View style={[s.brand, compact && s.brandCompact]}>
              <View style={[s.mark, compact && s.markCompact]}>
                {branding.logoUrl ? (
                  <Image source={{ uri: branding.logoUrl }} style={s.markImg} resizeMode="contain" />
                ) : (
                  <Ionicons name="swap-horizontal" size={compact ? 22 : 30} color={P.action} />
                )}
              </View>
              <View style={compact ? { flex: 1 } : { alignItems: 'center' }}>
                <Text style={[s.brandName, compact && s.brandNameCompact]} numberOfLines={1}>
                  {branding.name}
                </Text>
                {!compact && (
                  <Text style={s.brandTag} numberOfLines={2}>
                    {branding.tagline ?? 'Transferts internationaux sécurisés'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* ── Feuille blanche ── */}
          <View style={[s.sheet, SHADOW.card]}>
            <View style={[s.sheetAccent, { backgroundColor: P.accent }]} />
            <Text style={s.title} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            <View style={s.body}>{children}</View>

            <View style={s.trust}>
              <Ionicons name="lock-closed" size={12} color={N.muted} />
              <Text style={s.trustTxt}>Connexion chiffrée · Vos données restent protégées</Text>
            </View>
            {footer}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { flexGrow: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },

  orb:  { position: 'absolute', borderRadius: 999 },
  orbA: { width: 340, height: 340, top: -110, right: -120 },
  orbB: { width: 220, height: 220, top: 160, left: -90 },

  header:        { paddingHorizontal: 24, paddingBottom: 26 },
  headerCompact: { paddingBottom: 18 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  backSpacer: { width: 40, height: 40 },

  brand:        { alignItems: 'center', marginTop: 14, gap: 12 },
  brandCompact: { flexDirection: 'row', marginTop: 12, gap: 12 },
  mark: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: N.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  markCompact: { width: 46, height: 46, borderRadius: 14 },
  markImg:     { width: '78%', height: '78%' },
  brandName:        { fontFamily: FONT.display, fontSize: 30, fontWeight: '800', color: N.white, letterSpacing: -0.4, textAlign: 'center' },
  brandNameCompact: { fontSize: 20, textAlign: 'left' },
  brandTag:         { fontFamily: FONT.body, fontSize: 14, color: 'rgba(255,255,255,0.78)', textAlign: 'center', marginTop: 2 },

  sheet: {
    flexGrow: 1,
    backgroundColor: N.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 24, paddingTop: 30, paddingBottom: 28,
    overflow: 'hidden',
  },
  sheetAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  title:    { fontFamily: FONT.display, fontSize: 27, fontWeight: '800', color: N.ink, letterSpacing: -0.3 },
  subtitle: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22, color: N.inkSub, marginTop: 6 },
  body:     { marginTop: 22, flexGrow: 1 },

  trust:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 26 },
  trustTxt: { fontFamily: FONT.body, fontSize: 11.5, color: N.muted },
});
