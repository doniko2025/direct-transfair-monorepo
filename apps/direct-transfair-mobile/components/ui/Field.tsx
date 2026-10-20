// apps/direct-transfair-mobile/components/ui/Field.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// CHAMPS DE SAISIE v2.2 — Direct Transf'air (thème clair, white-label)
// ✅ v2.2 : (web uniquement) le texte d'exemple (placeholder) s'affichait aussi foncé qu'une vraie
//    saisie : `WebkitTextFillColor` (anti-teinte d'auto-remplissage) écrasait placeholderTextColor.
//    Le remplissage n'est désormais forcé en couleur d'encre que lorsque le champ contient du texte ;
//    vide, il prend la couleur « faint » du thème. Aucun changement sur Android / iOS.
// ✅ v2.1 : `minWidth: 0` sur la zone de saisie — dans une rangée à deux champs (Expiration | CVV),
//    le <input> web gardait sa largeur par défaut et débordait de l'écran. Aucun autre changement.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Champs arrondis à fond sable et contour d'état (focus = noir, erreur = rouge),
// libellé toujours visible, œil pour les mots de passe, téléphone avec
// sélecteur d'indicatif (liste complète des pays), code à usage unique,
// sélecteur (pays, ville…) et gros champ de montant.
// La logique (normalisation du numéro, validation) reste celle de components/auth.
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, StyleSheet, View, type KeyboardTypeOptions, type ReturnKeyTypeOptions, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { Ionicons } from './Icon';
import { useUI, SYSTEM_FONT } from './theme';
import CountryPickerSheet from '../auth/CountryPickerSheet';
import type { AuthCountry } from '../auth/authCountries';

import { Text, TextInput } from './Text';
export { normalizeNationalNumber, validatePhone } from '../auth/PhoneField';

/** Supprime le halo du navigateur et la teinte d'auto-remplissage (web). */
function webReset(bg: string, ink: string, faint?: string, empty?: boolean): any {
  return Platform.OS === 'web'
    ? { outlineStyle: 'none', outlineWidth: 0, WebkitBoxShadow: `0 0 0px 1000px ${bg} inset`, WebkitTextFillColor: empty && faint ? faint : ink }
    : {};
}

function Message({ error, hint }: { error?: string | null; hint?: string }) {
  const { C } = useUI();
  if (error) {
    return (
      <View style={st.msgRow} accessibilityLiveRegion="polite">
        <Ionicons name="alert-circle" size={14} color={C.danger} />
        <Text style={[st.msg, { color: C.danger }]}>{error}</Text>
      </View>
    );
  }
  if (hint) return <Text style={[st.msg, { color: C.muted, marginTop: 6 }]}>{hint}</Text>;
  return null;
}

// ─── Champ texte ─────────────────────────────────────────
type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  icon?: string;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  inputRef?: React.Ref<TextInput>;
  maxLength?: number;
  editable?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
  valid?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Field({
  label, value, onChangeText, icon, placeholder, error, hint, secure, keyboardType, autoCapitalize = 'none',
  autoComplete, textContentType, returnKeyType, onSubmitEditing, onBlur, inputRef, maxLength,
  editable = true, autoFocus, multiline, valid, leftSlot, rightSlot, style, testID,
}: FieldProps) {
  const { C, R } = useUI();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const bad = !!error;
  return (
    <View style={[st.wrap, style]}>
      {!!label && <Text style={[st.label, { color: bad ? C.danger : C.muted }]}>{label}</Text>}
      <View
        style={[
          st.box,
          { backgroundColor: C.field, borderRadius: R.md, borderColor: bad ? C.danger : focused ? C.ink : 'transparent' },
          multiline && { alignItems: 'flex-start', minHeight: 96 },
          !editable && { opacity: 0.6 },
        ]}
      >
        {!!icon && <Ionicons name={icon as any} size={19} color={bad ? C.danger : focused ? C.ink : C.muted} style={{ marginRight: 10 }} />}
        {leftSlot}
        <TextInput
          ref={inputRef}
          testID={testID}
          style={[st.input, { color: C.ink }, multiline && { textAlignVertical: 'top', paddingTop: 14, minHeight: 90 }, webReset(C.field, C.ink, C.faint, !value)]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          secureTextEntry={secure && !reveal}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          maxLength={maxLength}
          editable={editable}
          autoFocus={autoFocus}
          multiline={multiline}
          underlineColorAndroid="transparent"
          accessibilityLabel={label ?? placeholder}
          selectionColor={C.accent}
        />
        {secure ? (
          <Pressable onPress={() => setReveal((v) => !v)} hitSlop={10} accessibilityRole="button"
            accessibilityLabel={reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            <Ionicons name={reveal ? 'eye-outline' : 'eye-off-outline'} size={20} color={C.muted} />
          </Pressable>
        ) : valid && !bad && value.length > 0 ? (
          <Ionicons name="checkmark-circle" size={20} color={C.pos} />
        ) : rightSlot ?? null}
      </View>
      <Message error={error} hint={hint} />
    </View>
  );
}

// ─── Barre de recherche (pilule beige) ───────────────────
export function SearchPill({
  value, onChangeText, placeholder = 'Rechercher', style, autoFocus,
}: { value: string; onChangeText: (t: string) => void; placeholder?: string; style?: StyleProp<ViewStyle>; autoFocus?: boolean }) {
  const { C, R } = useUI();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: R.pill, paddingHorizontal: 18, backgroundColor: C.beige }, style]}>
      <Ionicons name="search" size={18} color={C.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        style={[{ flex: 1, fontFamily: SYSTEM_FONT, fontSize: 16, color: C.ink, paddingVertical: 10 }, webReset(C.beige, C.ink, C.muted, !value)]}
        underlineColorAndroid="transparent"
        accessibilityLabel={placeholder}
        selectionColor={C.accent}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Effacer">
          <Ionicons name="close-circle" size={18} color={C.muted} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Téléphone : indicatif + numéro national ─────────────
export function PhoneInput({
  country, onCountryChange, value, onChangeText, error, hint, onSubmitEditing, inputRef, label = 'Numéro de téléphone',
}: {
  country: AuthCountry; onCountryChange: (c: AuthCountry) => void; value: string; onChangeText: (t: string) => void;
  error?: string | null; hint?: string; onSubmitEditing?: () => void; inputRef?: React.Ref<TextInput>; label?: string;
}) {
  const { C, R } = useUI();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const bad = !!error;
  return (
    <View style={st.wrap}>
      {!!label && <Text style={[st.label, { color: bad ? C.danger : C.muted }]}>{label}</Text>}
      <View style={[st.box, { backgroundColor: C.field, borderRadius: R.md, borderColor: bad ? C.danger : focused ? C.ink : 'transparent', paddingLeft: 6 }]}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Indicatif ${country.name} ${country.dial}. Appuyer pour changer.`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 40, borderRightWidth: 1, borderRightColor: C.lineStrong, marginRight: 12 }}
        >
          <Text style={{ fontSize: 22 }}>{country.flag}</Text>
          <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '700', color: C.ink }}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={C.muted} />
        </Pressable>
        <TextInput
          ref={inputRef}
          style={[st.input, { color: C.ink }, webReset(C.field, C.ink, C.faint, !value)]}
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^\d\s]/g, ''))}
          placeholder="6 12 34 56 78"
          placeholderTextColor={C.faint}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          maxLength={18}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          underlineColorAndroid="transparent"
          selectionColor={C.accent}
        />
      </View>
      <Message error={error} hint={hint} />
      <CountryPickerSheet
        visible={open}
        title="Indicatif du pays"
        selected={country.name}
        showDial
        accent={C.accent}
        onSelect={(c) => { onCountryChange(c); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

// ─── Ligne de sélection (ouvre une liste) ────────────────
export function SelectRow({
  label, value, prefix, placeholder, icon, error, hint, onPress,
}: { label?: string; value?: string; prefix?: string; placeholder: string; icon?: string; error?: string | null; hint?: string; onPress: () => void }) {
  const { C, R } = useUI();
  return (
    <View style={st.wrap}>
      {!!label && <Text style={[st.label, { color: error ? C.danger : C.muted }]}>{label}</Text>}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder} : ${value ?? 'non renseigné'}`}
        style={[st.box, { backgroundColor: C.field, borderRadius: R.md, borderColor: error ? C.danger : 'transparent' }]}
      >
        {!!icon && <Ionicons name={icon as any} size={19} color={C.muted} style={{ marginRight: 10 }} />}
        {!!prefix && <Text style={{ fontSize: 22, marginRight: 10 }}>{prefix}</Text>}
        <Text style={[st.input, { color: value ? C.ink : C.faint, paddingVertical: 0 }]} numberOfLines={1}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={C.muted} />
      </Pressable>
      <Message error={error} hint={hint} />
    </View>
  );
}

// ─── Code à usage unique ─────────────────────────────────
export function OtpInput({
  value, onChange, onComplete, length = 6, error = false, disabled = false, autoFocus = true,
}: { value: string; onChange: (c: string) => void; onComplete?: (c: string) => void; length?: number; error?: boolean; disabled?: boolean; autoFocus?: boolean }) {
  const { C, R } = useUI();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => ref.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const handle = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };
  const active = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityRole="none" style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }} pointerEvents="none">
        {Array.from({ length }).map((_, i) => {
          const ch = value[i] ?? '';
          const on = focused && i === active && !disabled;
          return (
            <View
              key={i}
              style={{
                flex: 1, maxWidth: 56, height: 64, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.field, borderWidth: 1.5,
                borderColor: error ? C.danger : on ? C.ink : ch ? C.lineStrong : 'transparent',
              }}
            >
              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 26, fontWeight: '800', color: error ? C.danger : C.ink }}>{ch}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        editable={!disabled}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoCorrect={false}
        caretHidden
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' }, webReset('transparent', 'transparent')]}
        accessibilityLabel={`Code à ${length} chiffres`}
        underlineColorAndroid="transparent"
      />
    </Pressable>
  );
}

// ─── Gros champ de montant (écran Envoyer / Recharge) ────
export function AmountInput({
  value, onChangeText, currency, error, autoFocus, label, onCurrencyPress, editable = true,
}: {
  value: string; onChangeText: (t: string) => void; currency: string; error?: string | null; autoFocus?: boolean;
  label?: string; onCurrencyPress?: () => void; editable?: boolean;
}) {
  const { C } = useUI();
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Text style={[st.label, { color: error ? C.danger : C.muted, marginBottom: 0 }]}>{label}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.replace(',', '.').replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.faint}
          autoFocus={autoFocus}
          editable={editable}
          style={[{ flexShrink: 1, minWidth: 60, fontFamily: SYSTEM_FONT, fontSize: 48, fontWeight: '800', letterSpacing: -1.5, color: error ? C.danger : C.ink, padding: 0 }, webReset('transparent', C.ink)]}
          underlineColorAndroid="transparent"
          selectionColor={C.accent}
          accessibilityLabel={label ?? 'Montant'}
        />
        <Pressable disabled={!onCurrencyPress} onPress={onCurrencyPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 20, fontWeight: '800', color: C.muted }}>{currency}</Text>
          {!!onCurrencyPress && <Ionicons name="chevron-down" size={16} color={C.muted} />}
        </Pressable>
      </View>
      <Message error={error} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontFamily: SYSTEM_FONT, fontSize: 12.5, fontWeight: '700', marginBottom: 7, letterSpacing: 0.2 },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: 1.5, paddingHorizontal: 16 },
  input: { flex: 1, minWidth: 0, fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '600', paddingVertical: 14 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  msg: { fontFamily: SYSTEM_FONT, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
});
