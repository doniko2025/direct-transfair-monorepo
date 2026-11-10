// apps/direct-transfair-mobile/components/ui/CurrencyBadge.tsx
// =========================================================
// PASTILLE DE DEVISE v1.0 — Direct Transf'air (design « Corridor »)
// Petit rond beige portant le drapeau du pays de la devise : remplace le texte « EUR » / « XOF » devant les montants.
//  • `country` (nom du pays, facultatif) : si ce pays utilise bien la devise, on affiche SON drapeau (ex. France → 🇫🇷) ;
//  • sinon drapeau « de référence » : EUR → 🇪🇺, USD → 🇺🇸, GBP → 🇬🇧, sinon premier pays de la liste qui l'utilise (XOF → 🇸🇳…).
// Le code de devise reste lu par les lecteurs d'écran (accessibilityLabel).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { View } from "react-native";
import { countriesList } from "../../data/countries";
import { useUI } from "./theme";
import { Text } from "./Text";
import { useT } from "../../providers/I18nProvider";

const REFERENCE_FLAG: Record<string, string> = { EUR: "🇪🇺", USD: "🇺🇸", GBP: "🇬🇧", CAD: "🇨🇦", CHF: "🇨🇭" };

export function flagForCurrency(currency: string, country?: string | null): string {
  const cur = (currency || "").toUpperCase();
  const name = (country ?? "").trim().toLowerCase();
  if (name) {
    const c = countriesList.find((x) => x.name.toLowerCase() === name);
    if (c && (c.currency || "").toUpperCase() === cur) return c.flag;
  }
  if (REFERENCE_FLAG[cur]) return REFERENCE_FLAG[cur];
  return countriesList.find((x) => (x.currency || "").toUpperCase() === cur)?.flag ?? "🌍";
}

export function CurrencyBadge({ currency, country, size = 40 }: { currency: string; country?: string | null; size?: number }) {
  const { C } = useUI();
  const t = useT();
  return (
    <View
      accessible
      accessibilityLabel={t('state.currency', { currency })}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62) }}>{flagForCurrency(currency, country)}</Text>
    </View>
  );
}

export default CurrencyBadge;
