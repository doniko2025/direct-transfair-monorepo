// apps/direct-transfair-mobile/components/wallet/StateViews.tsx
// =========================================================
// ÉTATS VIDE / ERREUR v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// EmptyState : rien à afficher (avec action). ErrorState : échec de
// chargement avec « Réessayer ». SlowHint : « le serveur démarre… ».
// =========================================================

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, N, RADIUS, useWalletTheme } from './walletTheme';

export function EmptyState({
  icon = 'file-tray-outline', title, message, actionLabel, onAction,
}: { icon?: string; title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const { P } = useWalletTheme();
  return (
    <View style={s.box}>
      <View style={[s.iconWrap, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
        <Ionicons name={icon as any} size={30} color={P.accent} />
      </View>
      <Text style={s.title}>{title}</Text>
      {!!message && <Text style={s.msg}>{message}</Text>}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity style={[s.btn, { backgroundColor: P.action }]} onPress={onAction} activeOpacity={0.85}>
          <Text style={s.btnTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ErrorState({
  title, message, onRetry, compact = false,
}: { title: string; message: string; onRetry: () => void; compact?: boolean }) {
  const { P } = useWalletTheme();
  return (
    <View style={[s.box, compact && { paddingVertical: 18 }]}>
      <View style={[s.iconWrap, { backgroundColor: N.warnBg, borderColor: N.warnBd }]}>
        <Ionicons name="cloud-offline-outline" size={30} color={N.warn} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.msg}>{message}</Text>
      <TouchableOpacity style={[s.btn, { backgroundColor: P.action }]} onPress={onRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={s.btnTxt}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Bandeau discret affiché quand le chargement dure (serveur qui se réveille). */
export function SlowHint({ visible }: { visible: boolean }) {
  const { P } = useWalletTheme();
  if (!visible) return null;
  return (
    <View style={[s.hint, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
      <ActivityIndicator size="small" color={P.accent} />
      <Text style={[s.hintTxt, { color: P.action }]}>Le serveur démarre, quelques secondes de plus…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 8 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: FONT.display, fontSize: 18, fontWeight: '700', color: N.ink, textAlign: 'center' },
  msg: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19, color: N.inkSub, textAlign: 'center', maxWidth: 300 },
  btn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, height: 46, borderRadius: RADIUS.md, justifyContent: 'center',
  },
  btnTxt: { fontFamily: FONT.medium, fontSize: 14.5, fontWeight: '700', color: '#fff' },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  hintTxt: { fontFamily: FONT.medium, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
});
