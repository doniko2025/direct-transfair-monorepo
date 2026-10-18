// apps/direct-transfair-mobile/components/auth/DateOfBirthField.tsx
// =========================================================
// DATE DE NAISSANCE v2.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — contour noir au focus.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Trois cases (jour / mois / année) avec passage automatique à la case
// suivante, retour arrière intelligent, clavier numérique. Un seul message
// d'erreur pour l'ensemble. La validation (date réelle, âge minimal) est
// dans validateBirthDate(), testable seule.
// v1.1 — 🔥 CORRIGÉ : la case « mois » débordait de l'écran sur petits mobiles
//        (largeur minimale implicite des champs) → minWidth: 0.
// =========================================================

import React, { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONT, N, RADIUS, WEB_INPUT_RESET } from './authTheme';

export type Dob = { day: string; month: string; year: string };

/** Retourne un message d'erreur, ou null si la date est valide et l'âge suffisant. */
export function validateBirthDate(d: Dob, minAge: number, today: Date = new Date()): string | null {
  if (!d.day || !d.month || d.year.length < 4) return 'Saisissez votre date de naissance complète.';
  const day = Number(d.day), month = Number(d.month), year = Number(d.year);
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!real || year < 1900) return 'Cette date n’existe pas.';
  if (date.getTime() > today.getTime()) return 'La date de naissance ne peut pas être dans le futur.';
  let age = today.getFullYear() - year;
  const hadBirthday =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < minAge) return `Vous devez avoir au moins ${minAge} ans pour ouvrir un compte.`;
  return null;
}

/** Format attendu par le serveur : JJ/MM/AAAA. */
export function formatBirthDate(d: Dob): string {
  return `${d.day.padStart(2, '0')}/${d.month.padStart(2, '0')}/${d.year}`;
}

type Props = {
  value: Dob;
  onChange: (d: Dob) => void;
  error?: string | null;
  accent: string;
  onDone?: () => void;
};

export default function DateOfBirthField({ value, onChange, error, accent, onDone }: Props) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);
  const [focus, setFocus] = React.useState<'day' | 'month' | 'year' | null>(null);
  const hasError = !!error;

  const box = (key: 'day' | 'month' | 'year') => [
    s.box,
    { borderColor: hasError ? N.danger : focus === key ? N.ink : N.border },
    key === 'year' && { flex: 1.6 },
  ];

  const digits = (t: string, max: number) => t.replace(/\D/g, '').slice(0, max);

  return (
    <View style={s.wrap}>
      <Text style={[s.label, hasError && { color: N.danger }]}>Date de naissance</Text>
      <View style={s.row}>
        <TextInput
          ref={dayRef}
          style={[box('day'), s.input, WEB_INPUT_RESET]}
          value={value.day}
          placeholder="JJ"
          placeholderTextColor="#B9B6AD"
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
          onFocus={() => setFocus('day')}
          onBlur={() => setFocus(null)}
          onChangeText={(t) => {
            const day = digits(t, 2);
            onChange({ ...value, day });
            if (day.length === 2) monthRef.current?.focus();
          }}
          accessibilityLabel="Jour de naissance"
          underlineColorAndroid="transparent"
        />
        <Text style={s.sep}>/</Text>
        <TextInput
          ref={monthRef}
          style={[box('month'), s.input, WEB_INPUT_RESET]}
          value={value.month}
          placeholder="MM"
          placeholderTextColor="#B9B6AD"
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
          onFocus={() => setFocus('month')}
          onBlur={() => setFocus(null)}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !value.month) dayRef.current?.focus(); }}
          onChangeText={(t) => {
            const month = digits(t, 2);
            onChange({ ...value, month });
            if (month.length === 2) yearRef.current?.focus();
          }}
          accessibilityLabel="Mois de naissance"
          underlineColorAndroid="transparent"
        />
        <Text style={s.sep}>/</Text>
        <TextInput
          ref={yearRef}
          style={[box('year'), s.input, WEB_INPUT_RESET]}
          value={value.year}
          placeholder="AAAA"
          placeholderTextColor="#B9B6AD"
          keyboardType="number-pad"
          maxLength={4}
          textAlign="center"
          onFocus={() => setFocus('year')}
          onBlur={() => setFocus(null)}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !value.year) monthRef.current?.focus(); }}
          onChangeText={(t) => onChange({ ...value, year: digits(t, 4) })}
          onSubmitEditing={onDone}
          returnKeyType="next"
          accessibilityLabel="Année de naissance"
          underlineColorAndroid="transparent"
        />
      </View>
      {hasError ? (
        <View style={s.msgRow}>
          <Ionicons name="alert-circle" size={14} color={N.danger} />
          <Text style={s.msg}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { marginBottom: 16 },
  label: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.inkSub, marginBottom: 7 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: {
    flex: 1, minWidth: 0, minHeight: 54, backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5,
  },
  input: { fontFamily: FONT.body, fontSize: 17, fontWeight: '700', color: N.ink, paddingVertical: 12 },
  sep:   { fontSize: 20, color: N.muted, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  msg:    { fontFamily: FONT.body, fontSize: 12.5, color: N.danger, flexShrink: 1 },
});
