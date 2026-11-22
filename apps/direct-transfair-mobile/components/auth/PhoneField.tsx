// apps/direct-transfair-mobile/components/auth/PhoneField.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// TÉLÉPHONE v2.2 — Direct Transf'air
// ✅ v2.2 : `minWidth: 0` sur le champ de saisie — sur le web il débordait de la carte (largeur intrinsèque d'un <input>). Aucun effet sur mobile.
// ✅ v2.1 : ESPACES AUTOMATIQUES selon le pays (Guinée 622 53 42 17, Sénégal 77 509 99 91, France 07 66 73 62 27…) — voir
//    utils/phone.ts. Le « 0 » national est toléré en France (et pays voisins de règle) : normalizeNationalNumber() le retire
//    toujours avant l'envoi, les espaces aussi.
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
import { tr } from '../../i18n/runtime';
import { useT } from '../../providers/I18nProvider';

import { Text, TextInput } from '../ui/Text';
import { themed } from '../wallet/brand';
import { formatNationalInput } from '../../utils/phone';
/** Garde les chiffres et retire les « 0 » de tête (préfixe national). */
export function normalizeNationalNumber(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/** Message d'erreur ou null. */
export function validatePhone(national: string): string | null {
  const n = normalizeNationalNumber(national);
  if (!n) return tr('phone.required');
  if (n.length < 6 || n.length > 13) return tr('phone.invalid');
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
  /** Version compacte (hauteur et textes réduits) pour les cadres étroits. */
  dense?: boolean;
  onSubmitEditing?: () => void;
  inputRef?: React.Ref<TextInput>;
};

export default function PhoneField({
  country, onCountryChange, value, onChangeText, error, hint, accent, dense = true, onSubmitEditing, inputRef,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  return (
    <View style={[s.wrap, dense && { marginBottom: 12 }]}>
      <Text style={[s.label, dense && { fontSize: 12, marginBottom: 5 }, hasError && { color: N.danger }]}>{t('phone.label')}</Text>
      <View style={[s.box, dense && { minHeight: 46 }, { borderColor: hasError ? N.danger : focused ? N.ink : N.border }]}>
        <TouchableOpacity
          onPress={() => setOpen(true)}
          style={[s.dial, dense && { minHeight: 46, paddingHorizontal: 9, gap: 4, marginRight: 9 }]}
          accessibilityRole="button"
          accessibilityLabel={t('phone.dialA11y', { name: country.name, dial: country.dial })}
        >
          <Text style={[s.flag, dense && { fontSize: 18 }]}>{country.flag}</Text>
          <Text style={[s.code, dense && { fontSize: 14 }]}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={N.muted} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={[s.input, dense && { fontSize: 15, paddingVertical: 8 }, WEB_INPUT_RESET]}
          value={formatNationalInput(value, country.dial)}
          onChangeText={(txt) => onChangeText(formatNationalInput(txt, country.dial))}
          placeholder="6 12 34 56 78"
          placeholderTextColor={N.faint}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          maxLength={22}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={t('phone.label')}
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
        title={t('phone.dialTitle')}
        selected={country.name}
        showDial
        accent={accent}
        onSelect={(c) => { onCountryChange(c); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const s = themed(() => StyleSheet.create({
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
  input: { flex: 1, minWidth: 0, fontFamily: FONT.body, fontSize: 16, fontWeight: '600', color: N.ink, paddingVertical: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  msg:    { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
}));
