// apps/direct-transfair-mobile/components/auth/AuthButton.tsx
// =========================================================
// BOUTON v2.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — pilule pleine à la couleur d'accent EXACTE de la société (texte noir ou blanc
//    calculé automatiquement selon la luminosité), variante secondaire beige, contour noir, lien.
//    La prop `accent` est conservée pour compatibilité mais ne sert plus qu'au lien / contour.
// ✅ v1.0 : quatre variantes, état de chargement qui bloque le double appui, retour tactile, ≥ 52 px.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONT, N } from './authTheme';
import { useUI } from '../ui/theme';

type Props = {
  label: string;
  onPress: () => void;
  accent?: string;                // conservé pour compatibilité
  variant?: 'primary' | 'secondary' | 'outline' | 'link';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: boolean;
  testID?: string;
};

export default function AuthButton({
  label, onPress, variant = 'primary', loading = false, disabled = false,
  icon, iconRight = false, testID,
}: Props) {
  const { C } = useUI();
  const off = disabled || loading;
  const fg = variant === 'primary' ? C.accentInk : variant === 'link' ? C.ink : C.ink;

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
        variant === 'primary' && { backgroundColor: C.accent },
        variant === 'secondary' && { backgroundColor: C.beige },
        variant === 'outline' && { borderWidth: 1.5, borderColor: C.ink, backgroundColor: 'transparent' },
        variant === 'link' && s.link,
        off && !loading && { opacity: 0.45 },
        pressed && !off && { transform: [{ scale: 0.985 }], opacity: 0.9 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: { minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  link: { minHeight: 44, paddingHorizontal: 8 },
  row:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  label:     { fontFamily: FONT.medium, fontSize: 16, fontWeight: '800', letterSpacing: -0.1 },
  labelLink: { fontSize: 14.5, fontWeight: '700', textDecorationLine: 'underline', color: N.ink },
});
