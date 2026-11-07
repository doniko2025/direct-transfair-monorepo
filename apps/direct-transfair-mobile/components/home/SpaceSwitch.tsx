// apps/direct-transfair-mobile/components/home/SpaceSwitch.tsx
// =========================================================
// BASCULE DE COMPTE v1.0 — « Compte client | Compte marchand » (deux comptes séparés : solde, opérations et menus propres).
// Affichée seulement quand la personne a les deux comptes. Segments larges (zone de toucher confortable sur mobile).
// =========================================================

import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { useUI } from "../ui";
import { useAccountSpace, type AccountSpace } from "../../hooks/useAccountSpace";

const ITEMS: Array<{ key: AccountSpace; label: string; icon: string }> = [
  { key: "client", label: "Compte client", icon: "person-outline" },
  { key: "merchant", label: "Compte marchand", icon: "storefront-outline" },
];

export function SpaceSwitch({ style }: { style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  const { space, canSwitch, switchTo } = useAccountSpace();
  if (!canSwitch) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: "row", backgroundColor: C.field, borderRadius: 999, padding: 4, gap: 4 }, style]}
    >
      {ITEMS.map((it) => {
        const on = space === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => switchTo(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            style={({ pressed }) => ({
              flex: 1, minWidth: 0, height: 40, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
              paddingHorizontal: 8, backgroundColor: on ? C.surface : "transparent", opacity: pressed ? 0.8 : 1,
              borderWidth: on ? 1 : 0, borderColor: C.line,
            })}
          >
            <Ionicons name={it.icon as any} size={16} color={on ? C.ink : C.muted} />
            <Text numberOfLines={1} allowFontScaling={false} style={{ fontSize: 13, fontWeight: on ? "700" : "600", color: on ? C.ink : C.muted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
