// apps/direct-transfair-mobile/components/ui/CurrencyFlag.tsx
// =========================================================
// DRAPEAU DE LA DEVISE v1.0 — brique commune (déplacée de components/home/HomeParts.tsx, qui la ré-exporte : aucun import existant ne casse).
// `flagForCurrency` : drapeau (emoji) du pays de la devise — celui du pays du client si sa devise correspond, sinon le pays « principal » de la devise.
// `CurrencyFlag`    : drapeau rond. `CurrencyTag` : pastille « drapeau + code » pour les champs de montant (couleurs : thème de la société).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { useUI, SYSTEM_FONT } from "./theme";
import { countriesList } from "../../data/countries";

/** Drapeau (emoji) du pays de la devise : celui du pays du client si sa devise correspond, sinon le pays « principal » de la devise. */
export function flagForCurrency(currency: string, countryName?: string | null): string {
  const own = countryName ? countriesList.find((c) => c.name.toLowerCase() === countryName.toLowerCase()) : undefined;
  if (own && own.currency === currency) return own.flag;
  const MAIN: Record<string, string> = { EUR: "FR", XOF: "SN", XAF: "CM", GNF: "GN", USD: "US", GBP: "GB" };
  const code = MAIN[currency];
  const byCode = code ? countriesList.find((c) => c.code === code) : undefined;
  return (byCode ?? countriesList.find((c) => c.currency === currency))?.flag ?? "🌐";
}

export function CurrencyFlag({ currency, countryName, size = 28 }: { currency: string; countryName?: string | null; size?: number }) {
  const { C } = useUI();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: C.field, borderWidth: 1, borderColor: C.line }}>
      <Text allowFontScaling={false} style={{ fontSize: size * 0.92, lineHeight: size * 1.12, includeFontPadding: false, textAlign: "center" }}>
        {flagForCurrency(currency, countryName)}
      </Text>
    </View>
  );
}

/** Pastille « drapeau + code devise » à poser à droite d'un montant saisi ou calculé. */
export function CurrencyTag({ currency, countryName, size = 22, color }: { currency: string; countryName?: string | null; size?: number; color?: string }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.field, borderRadius: 999, paddingLeft: 6, paddingRight: 12, height: size + 12 }}>
      <CurrencyFlag currency={currency} countryName={countryName} size={size} />
      <Text numberOfLines={1} style={{ fontFamily: SYSTEM_FONT, fontSize: 15, fontWeight: "800", color: color ?? C.ink }}>{currency}</Text>
    </View>
  );
}

export default CurrencyFlag;
