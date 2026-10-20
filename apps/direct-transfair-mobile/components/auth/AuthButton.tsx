// apps/direct-transfair-mobile/components/auth/AuthButton.tsx
// =========================================================
// BOUTON v3.0 — Direct Transf'air
// ✅ v3.0 : DESIGN « CORRIDOR » — principal = jaune soleil, texte vert forêt, coins 20 (comme « Envoyer » de l'accueil) ;
//    secondaire = vert pâle ; contour = filet vert, texte forêt ; lien souligné forêt.
// ✅ v2.0 : THÈME CLAIR — pilule pleine à la couleur d'accent EXACTE de la société (texte noir ou blanc
//    calculé automatiquement selon la luminosité), variante secondaire beige, contour noir, lien.
//    La prop `accent` est conservée pour compatibilité mais ne sert plus qu'au lien / contour.
// ✅ v1.0 : quatre variantes, état de chargement qui bloque le double appui, retour tactile, ≥ 52 px.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '../ui/Icon';

import { FONT, N } from './authTheme';
import { useUI } from '../ui/theme';

import { Text } from '../ui/Text';
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
  const fg = variant === 'primary' ? C.sunInk : C.dark;

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
        variant === 'primary' && { backgroundColor: C.sun },
        variant === 'secondary' && { backgroundColor: C.accentSoft },
        variant === 'outline' && { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface },
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
  base: { minHeight: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  link: { minHeight: 44, paddingHorizontal: 8 },
  row:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  label:     { fontFamily: FONT.medium, fontSize: 17, fontWeight: '800', letterSpacing: -0.1 },
  labelLink: { fontSize: 14.5, fontWeight: '700', textDecorationLine: 'underline', color: N.inkSub },
});
