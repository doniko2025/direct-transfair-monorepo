// apps/direct-transfair-mobile/components/wallet/ScreenHeader.tsx
// =========================================================
// EN-TÊTE D'ÉCRAN WALLET v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Bandeau en dégradé de marque, coins bas arrondis, titre + sous-titre,
// bouton retour optionnel, zone droite et zone enfants (recherche, onglets).
// Gère l'encoche (safe area) et la barre de statut Android.
// =========================================================

import React from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, alpha, useWalletTheme } from './walletTheme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
  /** Réduit la hauteur (écrans secondaires). */
  compact?: boolean;
};

export default function ScreenHeader({ title, subtitle, onBack, right, children, compact }: Props) {
  const { P } = useWalletTheme();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 20) + 10;

  return (
    <LinearGradient
      colors={[P.bg1, P.bg2, P.bg3]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.wrap, { paddingTop: top, paddingBottom: compact ? 18 : 24 }]}
    >
      <StatusBar barStyle="light-content" backgroundColor={P.bg1} />
      <View pointerEvents="none" style={[s.orb, { backgroundColor: alpha('#FFFFFF', 0.06) }]} />
      <View style={s.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={s.back} hitSlop={10} accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.sub} numberOfLines={2}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}
    </LinearGradient>
  );
}

/** Bouton rond « verre » pour la zone droite de l'en-tête. */
export function HeaderIconButton({ icon, onPress, badge, label }: { icon: string; onPress: () => void; badge?: boolean; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.iconBtn} accessibilityLabel={label} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={20} color="#fff" />
      {badge ? <View style={s.badge} /> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  orb: { position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 110 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontFamily: FONT.display, fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  sub: { fontFamily: FONT.body, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  badge: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F79009', borderWidth: 1.5, borderColor: '#0b1f1a' },
});
