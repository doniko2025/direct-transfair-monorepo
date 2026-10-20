// apps/direct-transfair-mobile/components/auth/PhoneField.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// TÉLÉPHONE v2.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — contour noir au focus.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Indicatif (drapeau + code, sélecteur de tous les pays) + numéro national.
// normalizeNationalNumber() retire le « 0 » de tête (préfixe national :
// « 06… » en France) que l'ancien écran laissait passer — le serveur
// recevait alors « +33 06… », un numéro faux auquel aucun SMS ne parvient.
// =========================================================

import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '../ui/Icon';

import CountryPickerSheet from './CountryPickerSheet';
import type { AuthCountry } from './authCountries';
import { FONT, N, RADIUS, WEB_INPUT_RESET } from './authTheme';

import { Text, TextInput } from '../ui/Text';
/** Garde les chiffres et retire les « 0 » de tête (préfixe national). */
export function normalizeNationalNumber(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/** Message d'erreur ou null. */
export function validatePhone(national: string): string | null {
  const n = normalizeNationalNumber(national);
  if (!n) return 'Saisissez votre numéro de téléphone.';
  if (n.length < 6 || n.length > 13) return 'Ce numéro ne semble pas valide.';
  return null;
}

type Props = {
  country: AuthCountry;
  onCountryChange: (c: AuthCountry) => void;
  value: string;
  onChangeText: (t: string) => void;
  error?: string | null;
  hint?: string;
  accent: string;
  onSubmitEditing?: () => void;
  inputRef?: React.Ref<TextInput>;
};

export default function PhoneField({
  country, onCountryChange, value, onChangeText, error, hint, accent, onSubmitEditing, inputRef,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  return (
    <View style={s.wrap}>
      <Text style={[s.label, hasError && { color: N.danger }]}>Numéro de téléphone</Text>
      <View style={[s.box, { borderColor: hasError ? N.danger : focused ? N.ink : N.border }]}>
        <TouchableOpacity
          onPress={() => setOpen(true)}
          style={s.dial}
          accessibilityRole="button"
          accessibilityLabel={`Indicatif ${country.name} ${country.dial}. Appuyez pour changer.`}
        >
          <Text style={s.flag}>{country.flag}</Text>
          <Text style={s.code}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={N.muted} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={[s.input, WEB_INPUT_RESET]}
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^\d\s]/g, ''))}
          placeholder="6 12 34 56 78"
          placeholderTextColor={N.faint}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          maxLength={18}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Numéro de téléphone"
          underlineColorAndroid="transparent"
          selectionColor={accent}
        />
      </View>
      {hasError ? (
        <View style={s.msgRow}>
          <Ionicons name="alert-circle" size={14} color={N.danger} />
          <Text style={[s.msg, { color: N.danger }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[s.msg, { color: N.muted, marginTop: 6 }]}>{hint}</Text>
      ) : null}

      <CountryPickerSheet
        visible={open}
        title="Indicatif du pays"
        selected={country.name}
        showDial
        accent={accent}
        onSelect={(c) => { onCountryChange(c); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { marginBottom: 16 },
  label: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.inkSub, marginBottom: 7 },
  box: {
    flexDirection: 'row', alignItems: 'center', minHeight: 54,
    backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5, paddingRight: 14,
  },
  dial: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 54,
    borderRightWidth: 1, borderRightColor: N.border, marginRight: 12,
  },
  flag:  { fontSize: 20 },
  code:  { fontFamily: FONT.body, fontSize: 15, fontWeight: '700', color: N.ink },
  input: { flex: 1, fontFamily: FONT.body, fontSize: 16, fontWeight: '600', color: N.ink, paddingVertical: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  msg:    { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
});
