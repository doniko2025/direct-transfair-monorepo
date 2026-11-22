// apps/direct-transfair-mobile/components/transfer/WhatsAppPill.tsx
// Pastille « WhatsApp » compacte (couleur de marque de WhatsApp, comme sur l'écran Parrainage). Se glisse à côté d'un autre bouton.
import React from "react";
import { Pressable } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useT } from "../../providers/I18nProvider";

const WHATSAPP_GREEN = "#25D366";

export default function WhatsAppPill({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("wa.a11y")}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingHorizontal: 16, borderRadius: 20,
        backgroundColor: WHATSAPP_GREEN, opacity: pressed ? 0.85 : 1,
        shadowColor: WHATSAPP_GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
      })}
    >
      <FontAwesome name="whatsapp" size={19} color="#FFFFFF" />
      <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{t("wa.button")}</Text>
    </Pressable>
  );
}
