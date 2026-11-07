// apps/direct-transfair-mobile/components/auth/PinGuide.tsx
// =========================================================
// JAUGE + CONSEILS DU CODE SECRET v1.0 — Direct Transf'air (lot 10)
// Remplace PasswordGuide pour les clients du portefeuille : dit tout de suite POURQUOI un code est refusé (suite, date de
// naissance, répétition…), avant l'envoi. Le serveur reste le juge final (même règle).
// =========================================================

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Ionicons } from '../ui/Icon';
import { Text } from '../ui/Text';
import { FONT, N } from './authTheme';
import { pinStrength, type PinContext } from './pinRules';

const COLORS = [N.border, N.danger, '#D97706', '#2E8B57'];

export default function PinGuide({ pin, context }: { pin: string; context?: PinContext }) {
  const r = pinStrength(pin, context);
  const color = COLORS[r.level]!;
  return (
    <View style={s.wrap} accessibilityLiveRegion="polite">
      <View style={s.meterRow}>
        <View style={s.meter}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[s.seg, { backgroundColor: i <= r.level ? color : N.border }]} />
          ))}
        </View>
        <Text style={[s.level, { color }]}>{r.label}</Text>
      </View>
      {r.problem ? (
        <View style={s.rule}>
          <Ionicons name="close-circle-outline" size={15} color={N.danger} />
          <Text style={[s.txt, { color: N.danger }]}>{r.problem}</Text>
        </View>
      ) : (
        <Text style={s.hint}>6 chiffres. Évitez les suites (123456), les répétitions (121212), les dates de naissance et votre numéro de téléphone.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { marginTop: -4, marginBottom: 16, gap: 8 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter:    { flex: 1, flexDirection: 'row', gap: 5 },
  seg:      { flex: 1, height: 5, borderRadius: 99 },
  level:    { fontFamily: FONT.medium, fontSize: 12, fontWeight: '800', minWidth: 96, textAlign: 'right' },
  rule:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  txt:      { fontFamily: FONT.body, fontSize: 12.5, flex: 1 },
  hint:     { fontFamily: FONT.body, fontSize: 12.5, color: N.muted },
});
