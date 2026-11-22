// apps/direct-transfair-mobile/components/transfer/TrackingStrip.tsx
// =========================================================
// FRISE DU SUIVI (lot 19) — une seule ligne de pastilles reliées (Enregistré → Validé → À retirer → Payé) et une phrase d'état dessous.
// Compacte : ~70 pt de haut. L'étape en cours pulse doucement ; un échec passe en rouge. L'écran qui l'affiche se rafraîchit seul.
// =========================================================

import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Text } from "../ui/Text";
import { UText, useUI } from "../ui";
import { Ionicons } from "../ui/Icon";
import { buildTracking, type TrackingTx } from "../../utils/trackingSteps";

function Dot({ state }: { state: "done" | "current" | "todo" | "failed" }) {
  const { C } = useUI();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== "current") return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const bg = state === "done" ? C.pos : state === "failed" ? C.danger : state === "current" ? C.accent : C.line;
  return (
    <View style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
      {state === "current" && (
        <Animated.View style={{ position: "absolute", width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.4] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.12] }) }] }} />
      )}
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        {state === "done" && <Ionicons name={"checkmark" as any} size={12} color="#FFFFFF" />}
        {state === "failed" && <Ionicons name={"close" as any} size={12} color="#FFFFFF" />}
        {state === "current" && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accentInk }} />}
      </View>
    </View>
  );
}

export default function TrackingStrip({ tx, recipientFirstName }: { tx: TrackingTx; recipientFirstName: string }) {
  const { C } = useUI();
  const tracking = buildTracking(tx, recipientFirstName);
  if (!tracking) return null;
  const { steps, hint } = tracking;
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 10 }} accessible accessibilityLabel={`${steps.map((s) => s.label).join(", ")}. ${hint}`}>
      <View style={{ flexDirection: "row" }}>
        {steps.map((s, i) => (
          <View key={s.key} style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch" }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? "transparent" : steps[i - 1]!.state === "done" ? C.pos : C.line }} />
              <Dot state={s.state} />
              <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? "transparent" : s.state === "done" ? C.pos : C.line }} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 4, fontSize: 11, lineHeight: 14, fontWeight: s.state === "current" || s.state === "failed" ? "800" : "600", color: s.state === "failed" ? C.danger : s.state === "todo" ? C.faint : C.ink, maxWidth: "96%" }}>{s.label}</Text>
          </View>
        ))}
      </View>
      <UText v="caption" tone="muted" align="center" style={{ marginTop: 8, fontSize: 12, lineHeight: 16 }}>{hint}</UText>
    </View>
  );
}
