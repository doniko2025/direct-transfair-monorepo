// apps/direct-transfair-mobile/components/send/RateLockBadge.tsx
// =========================================================
// Pastille « Taux garanti · encore 9:42 » avec barre qui se vide (lot 16).
// Le décompte vit ICI (un rendu par seconde de ce petit composant seulement, pas de l'écran d'envoi).
// Les 60 dernières secondes passent en orange. Respecte « réduire les animations ».
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Ionicons } from "../ui/Icon";
import { UText, useUI } from "../ui";
import { useT } from "../../providers/I18nProvider";

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function RateLockBadge({ expiresAtMs, totalSeconds = 600 }: { expiresAtMs: number; totalSeconds?: number }) {
  const { C, R } = useUI();
  const t = useT();
  const [left, setLeft] = useState(() => Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000)));
  const bar = useRef(new Animated.Value(Math.min(1, left / totalSeconds))).current;

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    const remaining = Math.max(0, expiresAtMs - Date.now());
    bar.setValue(Math.min(1, remaining / (totalSeconds * 1000)));
    Animated.timing(bar, { toValue: 0, duration: remaining, easing: Easing.linear, useNativeDriver: false }).start();
    return () => { clearInterval(id); bar.stopAnimation(); };
  }, [expiresAtMs, totalSeconds, bar]);

  const urgent = left <= 60;
  const color = urgent ? C.warn : C.pos;
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${t("grw.rate.title")} · ${t("grw.rate.left", { time: formatCountdown(left) })}`}
      style={{ borderRadius: R.md, backgroundColor: urgent ? C.warnBg : C.posBg, borderWidth: 1, borderColor: urgent ? C.warnLine : C.posLine, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 }}>
        <Ionicons name={"lock-closed" as any} size={17} color={color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong" color={color} numberOfLines={1}>{t("grw.rate.title")}</UText>
          <UText v="caption" tone="muted" numberOfLines={2}>{t("grw.rate.hint")}</UText>
        </View>
        <UText v="heading" color={color} style={{ fontVariant: ["tabular-nums"] }}>{formatCountdown(left)}</UText>
      </View>
      <View style={{ height: 4, backgroundColor: "transparent" }}>
        <Animated.View style={{ height: 4, backgroundColor: color, width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      </View>
    </View>
  );
}
