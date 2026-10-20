// apps/direct-transfair-mobile/components/auth/OtpCodeInput.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// SAISIE DU CODE À 6 CHIFFRES v2.0 — Direct Transf'air
// ✅ v2.0 : THÈME CLAIR — cases sable, contour noir sur la case active / remplie.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// UN SEUL champ réel (invisible) + six cases d'affichage. Conséquences :
//   • le collage d'un code et la saisie automatique SMS / email du
//     téléphone fonctionnent (impossible avec 6 champs séparés) ;
//   • pas de gestion de focus fragile entre cases ;
//   • la validation se déclenche toute seule au 6ᵉ chiffre.
// =========================================================

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FONT, N, RADIUS, WEB_INPUT_RESET } from './authTheme';

import { Text, TextInput } from '../ui/Text';
type Props = {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  accent: string;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function OtpCodeInput({
  value, onChange, onComplete, accent, length = 6, error = false, disabled = false, autoFocus = true,
}: Props) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = React.useState(false);

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
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityRole="none"
      style={s.wrap}
    >
      <View style={s.row} pointerEvents="none">
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? '';
          const isActive = focused && i === active && !disabled;
          return (
            <View
              key={i}
              style={[
                s.box,
                char ? { borderColor: error ? N.danger : N.ink, backgroundColor: N.surface } : null,
                isActive && { borderColor: N.ink, borderWidth: 2 },
                error && !char && { borderColor: N.dangerBd },
              ]}
            >
              <Text style={[s.digit, error && { color: N.danger }]}>{char}</Text>
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
        style={[s.hidden, WEB_INPUT_RESET]}
        accessibilityLabel={`Code à ${length} chiffres`}
        underlineColorAndroid="transparent"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap:   { width: '100%' },
  row:    { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1, aspectRatio: 0.82, maxHeight: 64, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: N.border,
  },
  digit:  { fontFamily: FONT.display, fontSize: 26, fontWeight: '800', color: N.ink },
  // Le vrai champ couvre toute la zone, invisible mais touchable / collable.
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' },
});
