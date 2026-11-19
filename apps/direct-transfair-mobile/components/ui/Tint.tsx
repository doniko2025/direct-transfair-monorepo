// apps/direct-transfair-mobile/components/ui/Tint.tsx
// =========================================================
// CARTE « TEINTÉE » (partagée : factures, recharge…) — fond dégradé léger à la couleur voulue, filigrane d'icône, bordure colorée,
// légère ombre et effet de ressort au toucher. + utilitaires de couleur (transparence, assombrissement).
// =========================================================

import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "./Icon";
import { useUI } from "./index";

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Couleur + transparence (« rgba »), valable partout (SVG, vues, dégradés). */
export const alpha = (hex: string, a: number): string => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
/** Assombrit une couleur (0–1) pour le bas des dégradés. */
export const shade = (hex: string, k: number): string => {
  const [r, g, b] = rgb(hex).map((v) => Math.max(0, Math.round(v * (1 - k))));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Carte « teintée » : fond dégradé léger à la couleur de la catégorie, filigrane de l'icône, bordure colorée, légère ombre,
 * et effet de ressort au toucher. Remplace la carte blanche unie.
 */
export function TintCard({ hue, mark, onPress, pad = 16, style, children, dim }: {
  hue: string; mark?: string; onPress?: () => void; pad?: number; style?: object; children?: React.ReactNode; dim?: boolean;
}) {
  const { C } = useUI();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  const body = (
    <View style={{
      borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: alpha(hue, 0.28), backgroundColor: C.surface,
      shadowColor: hue, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
      opacity: dim ? 0.55 : 1,
    }}>
      <LinearGradient colors={[alpha(hue, 0.17), alpha(hue, 0.04)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {mark ? (
        <View pointerEvents="none" style={{ position: "absolute", right: -12, bottom: -16, transform: [{ rotate: "-14deg" }] }}>
          <Ionicons name={mark as any} size={104} color={alpha(hue, 0.1)} />
        </View>
      ) : null}
      <View style={{ padding: pad }}>{children}</View>
    </View>
  );
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)} accessibilityRole="button">{body}</Pressable>
    </Animated.View>
  );
}

/** Nom traduit d'une catégorie ; une catégorie inventée par la société s'affiche lisiblement (« FRAIS_SCOLAIRES » → « Frais scolaires »). */
