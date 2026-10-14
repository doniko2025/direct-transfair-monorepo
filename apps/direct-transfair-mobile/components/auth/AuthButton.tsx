// apps/direct-transfair-mobile/components/auth/AuthButton.tsx
// =========================================================
// BOUTON v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Quatre variantes (principal, secondaire, contour, lien), état de
// chargement qui bloque le double appui, retour tactile, zone de toucher
// d'au moins 52 px.
// =========================================================

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { alpha, FONT, N, RADIUS, SHADOW } from './authTheme';

type Props = {
  label: string;
  onPress: () => void;
  accent: string;                 // couleur d'action de la marque
  variant?: 'primary' | 'secondary' | 'outline' | 'link';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: boolean;
  testID?: string;
};

export default function AuthButton({
  label, onPress, accent, variant = 'primary', loading = false, disabled = false,
  icon, iconRight = false, testID,
}: Props) {
  const off = disabled || loading;
  const isPrimary = variant === 'primary';
  const fg = isPrimary ? N.white : accent;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={s.row}>
      {icon && !iconRight ? <Ionicons name={icon} size={19} color={fg} /> : null}
      <Text style={[s.label, variant === 'link' && s.labelLink, { color: fg }]}>{label}</Text>
      {icon && iconRight ? <Ionicons name={icon} size={19} color={fg} /> : null}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [
        s.base,
        variant === 'primary' && [{ backgroundColor: accent }, !off && SHADOW.button],
        variant === 'secondary' && { backgroundColor: alpha(accent, 0.1) },
        variant === 'outline' && { borderWidth: 1.5, borderColor: alpha(accent, 0.45), backgroundColor: N.surface },
        variant === 'link' && s.link,
        off && !loading && { opacity: 0.45 },
        pressed && !off && { transform: [{ scale: 0.98 }], opacity: 0.92 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: { minHeight: 54, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  link: { minHeight: 44, paddingHorizontal: 8 },
  row:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  label:     { fontFamily: FONT.medium, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  labelLink: { fontSize: 14.5, fontWeight: '700' },
});
