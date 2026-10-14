// apps/direct-transfair-mobile/components/wallet/Skeleton.tsx
// =========================================================
// SQUELETTES DE CHARGEMENT v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Blocs gris qui « respirent » à la place des spinners : l'écran garde sa
// forme pendant le chargement et paraît plus rapide.
// =========================================================

import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import { RADIUS } from './walletTheme';

export function Skeleton({
  width = '100%', height = 14, radius = 8, style,
}: { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E3EAE7', opacity: v }, style]}
    />
  );
}

export function SkeletonTxRow() {
  return (
    <View style={s.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={10} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Skeleton width={70} height={13} />
        <Skeleton width={46} height={10} />
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: 4 }}>
      {Array.from({ length: rows }).map((_, i) => <SkeletonTxRow key={i} />)}
    </View>
  );
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return <Skeleton height={height} radius={RADIUS.xl} />;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
