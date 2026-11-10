// apps/direct-transfair-mobile/components/auth/PinInput.tsx
// =========================================================
// SAISIE DU CODE SECRET v1.0 — Direct Transf'air (lot 10)
// Six cases MASQUÉES (points) alimentées par UN seul champ réel invisible : le collage et le clavier numérique fonctionnent,
// aucune gestion de focus fragile. Œil pour afficher/masquer, secousse sur erreur.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '../ui/Icon';
import { Text, TextInput } from '../ui/Text';
import { FONT, N, RADIUS, WEB_INPUT_RESET } from './authTheme';
import { PIN_LENGTH, sanitizePin } from './pinRules';
import { useT } from '../../providers/I18nProvider';
import { themed } from '../wallet/brand';

type Props = {
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  accent: string;
  label?: string;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Retire l'œil (confirmation, saisie sensible). */
  noReveal?: boolean;
  /** Version compacte (cases plus basses, textes réduits) pour les cadres étroits. */
  dense?: boolean;
  testID?: string;
  /** Pour donner le focus à ce champ depuis l'écran parent (ex. passer au champ de confirmation). */
  inputRef?: React.MutableRefObject<TextInput | null>;
};

export default function PinInput({
  value, onChange, onComplete, accent, label, error, disabled = false, autoFocus = false, noReveal = false, dense = false, testID, inputRef,
}: Props) {
  const t = useT();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => ref.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [autoFocus]);

  // Secousse à l'apparition d'une erreur.
  useEffect(() => {
    if (!error) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  const handle = (text: string) => {
    const digits = sanitizePin(text);
    onChange(digits);
    if (digits.length === PIN_LENGTH) onComplete?.(digits);
  };

  const active = Math.min(value.length, PIN_LENGTH - 1);
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <View style={[s.wrap, dense && { marginBottom: 8 }]}>
      {label ? (
        <View style={s.labelRow}>
          <Text style={[s.label, dense && { fontSize: 12 }, error ? { color: N.danger } : null]}>{label}</Text>
          {!noReveal ? (
            <Pressable onPress={() => setReveal((r) => !r)} hitSlop={10} accessibilityRole="button" accessibilityLabel={reveal ? t('pin.hide') : t('pin.show')}>
              <Ionicons name={reveal ? 'eye-outline' : 'eye-off-outline'} size={20} color={N.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable onPress={() => ref.current?.focus()} accessibilityRole="none">
        <Animated.View style={[s.row, dense && { gap: 6 }, { transform: [{ translateX }] }]} pointerEvents="none">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const char = value[i] ?? '';
            const isActive = focused && i === active && !disabled;
            return (
              <View
                key={i}
                style={[
                  s.box,
                  dense && { minHeight: 42, maxHeight: 50 },
                  char ? { borderColor: error ? N.danger : accent, backgroundColor: N.surface } : null,
                  isActive && { borderColor: accent, borderWidth: 2 },
                  error && !char ? { borderColor: N.dangerBd } : null,
                ]}
              >
                {char ? (
                  reveal ? <Text style={[s.digit, dense && { fontSize: 20 }, error ? { color: N.danger } : null]}>{char}</Text> : <View style={[s.dot, dense && { width: 10, height: 10, borderRadius: 5 }, { backgroundColor: error ? N.danger : N.ink }]} />
                ) : null}
              </View>
            );
          })}
        </Animated.View>
        <TextInput
          ref={(node) => { ref.current = node; if (inputRef) inputRef.current = node; }}
          testID={testID}
          value={value}
          onChangeText={handle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          editable={!disabled}
          secureTextEntry
          textContentType="oneTimeCode"
          autoComplete="off"
          autoCorrect={false}
          autoCapitalize="none"
          caretHidden
          contextMenuHidden
          style={[s.hidden, WEB_INPUT_RESET]}
          accessibilityLabel={label ?? t('pin.a11y', { length: PIN_LENGTH })}
          underlineColorAndroid="transparent"
        />
      </Pressable>

      {error ? (
        <View style={s.errRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={N.danger} />
          <Text style={s.err}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  wrap:     { width: '100%', marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label:    { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.muted },
  row:      { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1, aspectRatio: 0.82, maxHeight: 60, minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: N.border,
  },
  digit:    { fontFamily: FONT.display, fontSize: 24, fontWeight: '800', color: N.ink },
  dot:      { width: 12, height: 12, borderRadius: 6 },
  hidden:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' },
  errRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  err:      { fontFamily: FONT.body, fontSize: 12.5, color: N.danger, flex: 1 },
}));
