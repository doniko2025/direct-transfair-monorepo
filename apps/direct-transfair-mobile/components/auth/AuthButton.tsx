// apps/direct-transfair-mobile/components/auth/AuthButton.tsx
// =========================================================
// BOUTON v3.3 — Direct Transf'air
// ✅ v3.3 : `iconOnly` — bouton rond 56×56 avec la seule icône (le libellé reste lu par les lecteurs d'écran) ; `stacked` — icône AU-DESSUS d'un libellé
//    centré sur 2 lignes (pour deux boutons côte à côte sans troncature). Sans ces props : rendu inchangé.
// ✅ v3.2 : prop `dense` — bouton resserré (hauteur 50, texte 16 ; lien 36) pour les cartes compactes. Sans elle : rendu inchangé.
// ✅ v3.1 : forme en PILULE (hauteur 56, coins entièrement arrondis) pour l'ensemble des écrans d'authentification.
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
import { themed } from '../wallet/brand';
type Props = {
  label: string;
  onPress: () => void;
  accent?: string;                // conservé pour compatibilité
  variant?: 'primary' | 'secondary' | 'outline' | 'link';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: boolean;
  /** Version resserrée (hauteur 50 ; lien 36). */
  dense?: boolean;
  /** Icône seule (rond 56×56). Exige `icon`. */
  iconOnly?: boolean;
  /** Icône au-dessus d'un libellé centré sur 2 lignes. */
  stacked?: boolean;
  testID?: string;
};

export default function AuthButton({
  label, onPress, variant = 'primary', loading = false, disabled = false,
  icon, iconRight = false, dense = false, iconOnly = false, stacked = false, testID,
}: Props) {
  const { C } = useUI();
  const off = disabled || loading;
  const fg = variant === 'primary' ? C.sunInk : C.dark;

  const square = iconOnly && !!icon;
  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : square ? (
    <Ionicons name={icon!} size={26} color={fg} />
  ) : stacked ? (
    <View style={s.col}>
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text numberOfLines={2} style={[s.label, s.labelStacked, { color: fg }]}>{label}</Text>
    </View>
  ) : (
    <View style={s.row}>
      {icon && !iconRight ? <Ionicons name={icon} size={19} color={fg} /> : null}
      <Text style={[s.label, dense && variant !== 'link' && s.labelDense, variant === 'link' && s.labelLink, { color: fg }]}>{label}</Text>
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
        dense && (variant === 'link' ? s.linkDense : s.baseDense),
        square && s.square,
        stacked && !square && s.baseStacked,
        off && !loading && { opacity: 0.45 },
        pressed && !off && { transform: [{ scale: 0.985 }], opacity: 0.9 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const s = themed(() => StyleSheet.create({
  base: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  link: { minHeight: 44, paddingHorizontal: 8 },
  baseDense:  { minHeight: 50, borderRadius: 25 },
  linkDense:  { minHeight: 36 },
  labelDense: { fontSize: 16 },
  square: { width: 56, height: 56, minHeight: 56, paddingHorizontal: 0, borderRadius: 28 },
  baseStacked: { minHeight: 84, borderRadius: 24, paddingHorizontal: 10, paddingVertical: 10 },
  col: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  labelStacked: { fontSize: 13.5, lineHeight: 17, textAlign: 'center', fontWeight: '700' },
  row:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  label:     { fontFamily: FONT.medium, fontSize: 17, fontWeight: '800', letterSpacing: -0.1 },
  labelLink: { fontSize: 14.5, fontWeight: '700', textDecorationLine: 'underline', color: N.inkSub },
}));