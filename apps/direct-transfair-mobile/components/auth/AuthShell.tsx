// apps/direct-transfair-mobile/components/auth/AuthShell.tsx
// =========================================================
// CADRE DES ÉCRANS D'AUTHENTIFICATION v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE TOTALE en thème clair (inspirée de « Taptap Send » : grand titre, champs sur fond crème,
//    bouton principal en pilule). Plus de dégradé sombre ni de « feuille » : fond crème, rangée du haut
//    (retour / pastille d'état du serveur), marque (logo + nom du tenant), gros titre, sous-titre, contenu.
//    Mêmes props qu'avant (title, subtitle, onBack, compact, footer, headerRight, children) : tous les
//    écrans qui utilisent ce cadre passent au thème clair sans changement de logique.
// ✅ v1.0 : cadre commun (clavier géré, contenu borné sur tablette / web, logo du tenant).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTenant } from '../../providers/TenantProvider';
import { buildPalette, FONT, MAX_WIDTH, N, type AuthPalette } from './authTheme';
import { buildColors } from '../ui/theme';

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
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 6;

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: C.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={[s.column, { paddingTop: topPad }]}>
          {/* ── Rangée du haut ── */}
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

          {/* ── Marque du tenant ── */}
          <View style={[s.brand, compact && { marginTop: 10 }]}>
            <View style={[s.mark, { backgroundColor: C.accent }]}>
              {branding.logoUrl ? (
                <Image source={{ uri: branding.logoUrl }} style={s.markImg} resizeMode="contain" />
              ) : (
                <Ionicons name="swap-horizontal" size={18} color={C.accentInk} />
              )}
            </View>
            <Text style={[s.brandName, { color: C.ink }]} numberOfLines={1}>{branding.name}</Text>
          </View>

          {/* ── Titre ── */}
          <Text style={[s.title, { color: C.ink }]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={[s.subtitle, { color: C.muted }]}>{subtitle}</Text> : null}

          <View style={s.body}>{children}</View>

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

  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backSpacer: { width: 44, height: 44 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  mark: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  markImg: { width: '78%', height: '78%' },
  brandName: { fontFamily: FONT.display, fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },

  title:    { fontFamily: FONT.display, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, marginTop: 22 },
  subtitle: { fontFamily: FONT.body, fontSize: 16, lineHeight: 23, marginTop: 8 },
  body:     { marginTop: 26, flexGrow: 1 },

  trust:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 26 },
  trustTxt: { fontFamily: FONT.body, fontSize: 11.5, color: N.muted },
});
