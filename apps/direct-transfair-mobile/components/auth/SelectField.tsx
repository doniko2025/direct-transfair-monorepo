// apps/direct-transfair-mobile/components/auth/SelectField.tsx
// =========================================================
// CHAMP À CHOIX v2.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR (placeholder et neutres chauds).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Ressemble à un champ de saisie mais ouvre un sélecteur (pays,
// nationalité). Même libellé / erreur / accessibilité que AuthField.
// =========================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONT, N, RADIUS } from './authTheme';

type Props = {
  label: string;
  value?: string;
  /** Texte à gauche de la valeur (drapeau). */
  prefix?: string;
  placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  hint?: string;
  onPress: () => void;
};

export default function SelectField({ label, value, prefix, placeholder, icon, error, hint, onPress }: Props) {
  const hasError = !!error;
  return (
    <View style={s.wrap}>
      <Text style={[s.label, hasError && { color: N.danger }]}>{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[s.box, { borderColor: hasError ? N.danger : N.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value ?? 'non renseigné'}. Appuyez pour choisir.`}
      >
        {icon ? <Ionicons name={icon} size={19} color={hasError ? N.danger : N.muted} style={{ marginRight: 10 }} /> : null}
        {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
        <Text style={[s.value, !value && { color: '#B9B6AD', fontWeight: '500' }]} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={N.muted} />
      </TouchableOpacity>
      {hasError ? (
        <View style={s.msgRow}>
          <Ionicons name="alert-circle" size={14} color={N.danger} />
          <Text style={[s.msg, { color: N.danger }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[s.msg, { color: N.muted, marginTop: 6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { marginBottom: 16 },
  label: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.inkSub, marginBottom: 7 },
  box: {
    flexDirection: 'row', alignItems: 'center', minHeight: 54,
    backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5, paddingHorizontal: 14,
  },
  prefix: { fontSize: 22, marginRight: 10 },
  value:  { flex: 1, fontFamily: FONT.body, fontSize: 16, fontWeight: '600', color: N.ink },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  msg:    { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
});
