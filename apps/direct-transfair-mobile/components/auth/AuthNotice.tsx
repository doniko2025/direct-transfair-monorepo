// apps/direct-transfair-mobile/components/auth/AuthNotice.tsx
// =========================================================
// BANDEAU DE MESSAGE v2.0 — Direct Transf'air
// ✅ v2.0 : thème clair (teintes chaudes, coins plus ronds) ; API inchangée.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Remplace les pop-ups d'alerte : le message reste visible dans le
// formulaire, annoncé aux lecteurs d'écran, avec une action optionnelle
// (« Réessayer »). Fonctionne identiquement sur mobile et web.
// =========================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONT, N, RADIUS } from './authTheme';

type Kind = 'error' | 'info' | 'success' | 'warning';

const LOOK: Record<Kind, { bg: string; bd: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error:   { bg: N.dangerBg, bd: N.dangerBd, fg: N.danger, icon: 'alert-circle' },
  info:    { bg: '#E8F0FE',  bd: '#C3D6FA',  fg: '#1D5FD1', icon: 'information-circle' },
  success: { bg: N.okBg,     bd: N.okBd,     fg: N.ok,     icon: 'checkmark-circle' },
  warning: { bg: N.warnBg,   bd: N.warnBd,   fg: N.warn,   icon: 'time' },
};

type Props = {
  kind?: Kind;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function AuthNotice({ kind = 'error', title, message, actionLabel, onAction }: Props) {
  const l = LOOK[kind];
  return (
    <View
      style={[s.box, { backgroundColor: l.bg, borderColor: l.bd }]}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={l.icon} size={20} color={l.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[s.title, { color: l.fg }]}>{title}</Text> : null}
        <Text style={[s.msg, { color: l.fg }]}>{message}</Text>
        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction} style={s.action} accessibilityRole="button">
            <Text style={[s.actionTxt, { color: l.fg }]}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box:   { flexDirection: 'row', gap: 10, padding: 13, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: 16 },
  title: { fontFamily: FONT.medium, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  msg:   { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19 },
  action:    { marginTop: 8, alignSelf: 'flex-start' },
  actionTxt: { fontFamily: FONT.medium, fontSize: 13.5, fontWeight: '800', textDecorationLine: 'underline' },
});
