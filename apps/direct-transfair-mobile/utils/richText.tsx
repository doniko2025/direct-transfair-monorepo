// apps/direct-transfair-mobile/utils/richText.tsx
// Rend un texte traduit où les passages entre **doubles astérisques** sont en gras (utilisé par les pages juridiques).
import React from "react";
import { Text } from "../components/ui/Text";

export function rich(text: string, color = "#111111"): React.ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <Text key={i} style={{ fontWeight: "700", color }}>{part}</Text> : part,
  );
}
