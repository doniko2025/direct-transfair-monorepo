// apps/direct-transfair-mobile/components/auth/AuthCards.tsx
// =========================================================
// CARTES DES ÉCRANS DE CONNEXION v1.0 — Direct Transf'air
//   • <AuthCard />      : carte blanche aux coins arrondis, ombrée (formulaire) ;
//   • <OptionList />    : carte à lignes « icône · titre · sous-titre · flèche » (autres façons de se connecter) ;
//   • <PhoneRecap />    : rappel du numéro saisi (drapeau + numéro) avec « Modifier » — étape « code secret ».
// COULEURS : aucune couleur écrite en dur — surface, encre, accent viennent de useUI() (couleur principale / accent de la société,
// thème clair ou sombre).
// =========================================================

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '../ui/Icon';
import { Text } from '../ui/Text';
import { useUI } from '../ui/theme';
import { FONT, SHADOW } from './authTheme';

export function AuthCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  return <View style={[s.card, SHADOW.card, { backgroundColor: C.surface }, style]}>{children}</View>;
}

export type OptionItem = {
  key: string;
  icon: string;
  title: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export function OptionList({ items }: { items: OptionItem[] }) {
  const { C } = useUI();
  return (
    <View style={[s.list, SHADOW.button, { backgroundColor: C.surface }]}>
      {items.map((it, i) => (
        <React.Fragment key={it.key}>
          {i > 0 ? <View style={[s.sep, { backgroundColor: C.line }]} /> : null}
          <Pressable
            testID={it.testID}
            onPress={it.onPress}
            disabled={it.disabled}
            accessibilityRole="button"
            accessibilityLabel={it.sub ? `${it.title}. ${it.sub}` : it.title}
            style={({ pressed }) => [s.row, it.disabled && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
          >
            <View style={[s.bubble, { backgroundColor: C.accentSoft }]}>
              <Ionicons name={it.icon as any} size={20} color={C.accentDeep} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[s.title, { color: C.ink }]}>{it.title}</Text>
              {it.sub ? <Text numberOfLines={2} style={[s.sub, { color: C.muted }]}>{it.sub}</Text> : null}
            </View>
            <Ionicons name={'chevron-forward' as any} size={18} color={C.faint} />
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

export function PhoneRecap({ flag, text, actionLabel, onPress, disabled, testID }: {
  flag: string; text: string; actionLabel: string; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  const { C } = useUI();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${text}. ${actionLabel}`}
      style={({ pressed }) => [s.recap, SHADOW.button, { backgroundColor: C.surface }, pressed && { opacity: 0.8 }]}
    >
      <Text style={s.flag}>{flag}</Text>
      <Text numberOfLines={1} style={[s.recapTxt, { color: C.ink }]}>{text}</Text>
      <Text style={[s.recapAction, { color: C.accentDeep }]}>{actionLabel}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:   { borderRadius: 24, padding: 16 },
  list:   { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 2 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 2 },
  sep:    { height: StyleSheet.hairlineWidth, marginHorizontal: 2 },
  bubble: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title:  { fontFamily: FONT.medium, fontSize: 14.5, fontWeight: '800' },
  sub:    { fontFamily: FONT.body, fontSize: 12, marginTop: 1 },
  recap:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  flag:   { fontSize: 20 },
  recapTxt:    { flex: 1, fontFamily: FONT.medium, fontSize: 15, fontWeight: '700' },
  recapAction: { fontFamily: FONT.body, fontSize: 13.5, fontWeight: '800' },
});
