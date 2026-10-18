// apps/direct-transfair-mobile/components/ui/Feedback.tsx
// =========================================================
// ÉTATS v2.0 — Direct Transf'air (thème clair, white-label)
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Vide, erreur (avec « Réessayer »), serveur lent, squelettes de chargement.
// Compatible avec useLoader() (chargement borné) de components/wallet.
// =========================================================

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from './theme';
import { Button, UText } from './Primitives';

export function EmptyView({
  icon = 'file-tray-outline', title, message, actionLabel, onAction,
}: { icon?: string; title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const { C } = useUI();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 12, gap: 8 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.beige, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Ionicons name={icon as any} size={32} color={C.ink} />
      </View>
      <UText v="heading" align="center">{title}</UText>
      {!!message && <UText v="body" tone="muted" align="center" style={{ maxWidth: 300 }}>{message}</UText>}
      {!!actionLabel && !!onAction && <Button label={actionLabel} onPress={onAction} full={false} small style={{ marginTop: 14 }} />}
    </View>
  );
}

export function ErrorView({
  title, message, onRetry, compact,
}: { title: string; message: string; onRetry: () => void; compact?: boolean }) {
  const { C } = useUI();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? 20 : 44, paddingHorizontal: 12, gap: 8 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.warnBg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Ionicons name="cloud-offline-outline" size={32} color={C.warn} />
      </View>
      <UText v="heading" align="center">{title}</UText>
      <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>{message}</UText>
      <Button label="Réessayer" icon="refresh" onPress={onRetry} kind="dark" full={false} small style={{ marginTop: 14 }} />
    </View>
  );
}

/** Bandeau discret quand le serveur met du temps à répondre (démarrage à froid). */
export function SlowNote({ visible }: { visible: boolean }) {
  const { C, R } = useUI();
  if (!visible) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.beige, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12 }}>
      <ActivityIndicator size="small" color={C.ink} />
      <UText v="caption" style={{ flexShrink: 1 }}>Le serveur démarre, quelques secondes de plus…</UText>
    </View>
  );
}

export function Bone({
  width = '100%', height = 14, radius = 8, style,
}: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.5, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: C.beige, opacity: v }, style]} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <Bone width={48} height={48} radius={24} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="55%" height={13} />
            <Bone width="35%" height={10} />
          </View>
          <Bone width={72} height={14} />
        </View>
      ))}
    </View>
  );
}
