// apps/direct-transfair-mobile/components/home/SpaceSwitch.tsx
// =========================================================
// BASCULE DE COMPTE v1.2 (plus compacte : 36 px, texte 13) · v1.1 (très visible : segment actif plein + ombre, piste contrastée, texte foncé sur l'inactif) — « Compte client | Compte marchand » (deux comptes séparés : solde, opérations et menus propres).
// Un point signale des notifications non lues dans l'AUTRE compte (chaque compte a sa propre boîte de réception).
// Affichée seulement quand la personne a les deux comptes. Segments larges (zone de toucher confortable sur mobile).
// =========================================================

import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { useUI } from "../ui";
import { useAccountSpace, type AccountSpace } from "../../hooks/useAccountSpace";
import { useUnreadOtherSpace } from "../../hooks/useUnreadNotifications";
import { useT } from "../../providers/I18nProvider";
import type { MessageKey } from "../../i18n/catalog";

const ITEMS: Array<{ key: AccountSpace; label: MessageKey; icon: string }> = [
  { key: "client", label: "space.client", icon: "person-outline" },
  { key: "merchant", label: "space.merchant", icon: "storefront-outline" },
];

export function SpaceSwitch({ style }: { style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  const t = useT();
  const { space, canSwitch, switchTo } = useAccountSpace();
  const otherUnread = useUnreadOtherSpace();
  if (!canSwitch) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: "row", backgroundColor: C.lineStrong, borderWidth: 1, borderColor: C.line, borderRadius: 999, padding: 3, gap: 3 }, style]}
    >
      {ITEMS.map((it) => {
        const on = space === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => switchTo(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={!on && otherUnread > 0 ? t("space.unread", { label: t(it.label), count: otherUnread }) : t(it.label)}
            style={({ pressed }) => ({
              flex: 1, minWidth: 0, height: 36, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
              paddingHorizontal: 8, backgroundColor: on ? C.ink : "transparent", opacity: pressed ? 0.85 : 1,
              ...(on ? { shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 } : null),
            })}
          >
            <Ionicons name={it.icon as any} size={16} color={on ? C.bg : C.text} />
            <Text numberOfLines={1} allowFontScaling={false} style={{ fontSize: 13, fontWeight: "700", color: on ? C.bg : C.text }}>{t(it.label)}</Text>
            {!on && otherUnread > 0 ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.danger }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
