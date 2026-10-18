// apps/direct-transfair-mobile/components/auth/PasswordGuide.tsx
// =========================================================
// JAUGE + CONSEILS MOT DE PASSE v2.0 — Direct Transf'air
// ✅ v2.0 : thème clair (jauge sur fond sable).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONT, N } from './authTheme';
import { evaluatePassword, PASSWORD_MAX, PASSWORD_MIN } from './passwordRules';

const LEVEL_COLOR = ['#E3DFD5', N.danger, '#D97706', '#4CAF73', '#2E8B57'];

function Rule({ ok, text, soft = false }: { ok: boolean; text: string; soft?: boolean }) {
  return (
    <View style={s.rule}>
      <Ionicons
        name={ok ? 'checkmark-circle' : soft ? 'ellipse-outline' : 'close-circle-outline'}
        size={15}
        color={ok ? N.ok : N.muted}
      />
      <Text style={[s.ruleTxt, ok && { color: N.ok }]}>{text}</Text>
    </View>
  );
}

export default function PasswordGuide({ password }: { password: string }) {
  const r = evaluatePassword(password);
  const color = LEVEL_COLOR[r.score]!;
  return (
    <View style={s.wrap} accessibilityLiveRegion="polite">
      <View style={s.meterRow}>
        <View style={s.meter}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.seg, { backgroundColor: i <= r.score ? color : '#ECE8DE' }]} />
          ))}
        </View>
        <Text style={[s.level, { color }]}>{r.label}</Text>
      </View>
      <Rule ok={r.lengthOk} text={`${PASSWORD_MIN} à ${PASSWORD_MAX} caractères`} />
      <Rule ok={r.hasLetter && r.hasDigit} text="Lettres et chiffres (conseillé)" soft />
      <Rule ok={r.hasMixCase || r.hasSymbol} text="Majuscules, minuscules ou symbole (conseillé)" soft />
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { marginTop: -4, marginBottom: 16, gap: 7 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  meter:    { flex: 1, flexDirection: 'row', gap: 5 },
  seg:      { flex: 1, height: 5, borderRadius: 99 },
  level:    { fontFamily: FONT.medium, fontSize: 12, fontWeight: '800', minWidth: 70, textAlign: 'right' },
  rule:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ruleTxt:  { fontFamily: FONT.body, fontSize: 12.5, color: N.muted },
});
