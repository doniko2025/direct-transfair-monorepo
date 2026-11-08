// apps/direct-transfair-mobile/components/ui/Segmented.tsx
// =========================================================
// SEGMENTÉ v1.0 — Direct Transf'air (design « Corridor »)
// Petit sélecteur à N choix TOUJOURS sur une seule ligne (périodes : Aujourd'hui · 7 jours · 30 jours · Ce mois).
// Chaque segment prend la même largeur ; le libellé se réduit légèrement si l'écran est étroit (jamais de retour à la ligne).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { SYSTEM_FONT, useUI } from "./theme";
import { Text } from "./Text";

export function Segmented<K extends string>({
  items, value, onChange, style,
}: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { C, R } = useUI();
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: "row", alignItems: "center", backgroundColor: C.field, borderRadius: R.pill, padding: 4, gap: 2 }, style]}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={({ pressed }) => ({
              flex: 1, minWidth: 0, height: 40, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
              paddingHorizontal: 4, backgroundColor: on ? C.dark : "transparent", opacity: pressed && !on ? 0.7 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ fontFamily: SYSTEM_FONT, fontSize: 13.5, fontWeight: on ? "800" : "600", color: on ? C.darkInk : C.dark }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default Segmented;
