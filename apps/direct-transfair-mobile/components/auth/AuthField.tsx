// apps/direct-transfair-mobile/components/auth/AuthField.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// CHAMP DE SAISIE v2.1 — Direct Transf'air
// ✅ v2.1 : prop `dense` — version resserrée (hauteur 48, libellé et marges réduits) pour les cartes compactes (écran de connexion). Sans elle : rendu inchangé.
// ✅ v2.0 : THÈME CLAIR — champ sable arrondi, contour noir au focus.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Libellé toujours visible au-dessus (jamais un placeholder qui disparaît),
// icône, œil pour les mots de passe, message d'erreur ou d'aide dessous,
// contour d'état (focus / erreur / valide), accessibilité complète.
// v1.1 — 🔥 CORRIGÉ : le fond du champ ne change plus au focus (sur le web, un
//        encadré blanc apparaissait à l'intérieur du champ sélectionné).
// =========================================================

import React, { useState } from 'react';
import {
  StyleSheet, TouchableOpacity, View, type KeyboardTypeOptions, type ReturnKeyTypeOptions, type TextInputProps,
} from 'react-native';
import { Ionicons } from '../ui/Icon';

import { FONT, N, RADIUS, WEB_INPUT_RESET } from './authTheme';

import { Text, TextInput } from '../ui/Text';
type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
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
  /** Pastille valide (coche verte) quand le champ est correct. */
  valid?: boolean;
  /** Version resserrée (hauteur 48, marges réduites). */
  dense?: boolean;
  /** Élément à gauche du texte (ex. indicatif téléphonique). */
  leftSlot?: React.ReactNode;
  accent: string;
  testID?: string;
};

export default function AuthField({
  label, value, onChangeText, icon, placeholder, error, hint, secure, keyboardType,
  autoCapitalize = 'none', autoComplete, textContentType, returnKeyType, onSubmitEditing,
  onBlur, inputRef, maxLength, editable = true, autoFocus, valid, dense = false, leftSlot, accent, testID,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const hasError = !!error;
  const borderColor = hasError ? N.danger : focused ? N.ink : N.border;

  return (
    <View style={[s.wrap, dense && s.wrapDense]}>
      <Text style={[s.label, dense && s.labelDense, hasError && { color: N.danger }]}>{label}</Text>
      <View
        style={[
          s.box,
          dense && s.boxDense,
          { borderColor },
          !editable && { opacity: 0.6 },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={19} color={hasError ? N.danger : focused ? N.ink : N.muted} style={s.icon} />
        ) : null}
        {leftSlot}
        <TextInput
          ref={inputRef}
          testID={testID}
          style={[s.input, dense && s.inputDense, WEB_INPUT_RESET]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={N.faint}
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
          underlineColorAndroid="transparent"
          accessibilityLabel={label}
          selectionColor={accent}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setReveal((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <Ionicons name={reveal ? 'eye-outline' : 'eye-off-outline'} size={20} color={N.muted} />
          </TouchableOpacity>
        ) : valid && !hasError && value.length > 0 ? (
          <Ionicons name="checkmark-circle" size={20} color={N.ok} />
        ) : null}
      </View>
      {hasError ? (
        <View style={s.msgRow} accessibilityLiveRegion="polite">
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
  label: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.inkSub, marginBottom: 7, letterSpacing: 0.1 },
  box: {
    flexDirection: 'row', alignItems: 'center', minHeight: 54,
    backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  wrapDense:  { marginBottom: 12 },
  labelDense: { fontSize: 12.5, marginBottom: 5 },
  boxDense:   { minHeight: 48, borderRadius: 14 },
  inputDense: { fontSize: 15.5, paddingVertical: 9 },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontFamily: FONT.body, fontSize: 16, color: N.ink, fontWeight: '600', paddingVertical: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  msg:    { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
});
