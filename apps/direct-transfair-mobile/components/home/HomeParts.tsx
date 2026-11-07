// apps/direct-transfair-mobile/components/home/HomeParts.tsx
// =========================================================
// ACCUEIL CLIENT / MARCHAND — briques communes (Lot 12)
// Fond blanc pur, solde en grand avec le drapeau de la devise, « Masquer / Afficher le solde » (mémorisé),
// barre du haut (salutation, scan QR, notifications). Police Inter, tailles de la maquette.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { Bone, UText, useUI } from "../ui";
import { countriesList } from "../../data/countries";
import { formatMoney } from "../wallet/walletTheme";

// ─── Solde masqué (mémorisé sur l'appareil) ──────────────
const HIDE_KEY = "dt.balanceHidden";

export function useBalanceHidden(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(HIDE_KEY).then((v) => { if (alive && v === "1") setHidden(true); }).catch(() => { /* sans incidence */ });
    return () => { alive = false; };
  }, []);
  const toggle = useCallback(() => {
    setHidden((h) => {
      const next = !h;
      AsyncStorage.setItem(HIDE_KEY, next ? "1" : "0").catch(() => { /* sans incidence */ });
      return next;
    });
  }, []);
  return [hidden, toggle];
}

// ─── Drapeau de la devise ────────────────────────────────
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

// ─── Barre du haut ───────────────────────────────────────
function RoundButton({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: boolean }) {
  const { C } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon as any} size={21} color={C.ink} />
      {badge ? <View style={{ position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.beige }} /> : null}
    </Pressable>
  );
}

export function HomeTopBar({
  greeting, name, onScan, onBell, unread,
}: { greeting?: string; name: string; onScan: () => void; onBell: () => void; unread?: boolean }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 12, gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 18, color: C.muted, fontWeight: "400" }}>
          {greeting ? `${greeting} ` : ""}<Text style={{ color: C.ink, fontWeight: "700" }}>{name}</Text>
        </Text>
      </View>
      <RoundButton icon="scan-outline" label="Payer avec un QR code" onPress={onScan} />
      <RoundButton icon="notifications-outline" label="Notifications" onPress={onBell} badge={unread} />
    </View>
  );
}

// ─── Solde en grand ──────────────────────────────────────
export function BalanceBlock({
  label, amount, currency, countryName, hidden, onToggle, loading, children,
}: {
  label: string; amount: number; currency: string; countryName?: string | null;
  hidden: boolean; onToggle: () => void; loading?: boolean; children?: React.ReactNode;
}) {
  const { C } = useUI();
  return (
    <View style={{ paddingTop: 56 }}>
      <UText v="body" color={C.muted}>{label}</UText>
      {loading ? (
        <Bone width={230} height={50} radius={12} style={{ marginTop: 10 }} />
      ) : (
        <Text
          accessibilityLabel={hidden ? "Solde masqué" : `Solde ${formatMoney(amount, currency)} ${currency}`}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{ fontSize: 46, lineHeight: 54, fontWeight: "800", letterSpacing: -1.5, color: C.ink, marginTop: 6 }}
        >
          {hidden ? "••••••" : formatMoney(amount, currency)}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
        <CurrencyFlag currency={currency} countryName={countryName} />
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#444444" }}>{currency}</Text>
      </View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={hidden ? "Afficher le solde" : "Masquer le solde"}
        hitSlop={10}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, alignSelf: "flex-start" }}
      >
        <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={22} color="#444444" />
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#444444" }}>{hidden ? "Afficher le solde" : "Masquer le solde"}</Text>
      </Pressable>
      {children}
    </View>
  );
}
