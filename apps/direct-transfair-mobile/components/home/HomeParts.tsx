// apps/direct-transfair-mobile/components/home/HomeParts.tsx
// =========================================================
// ACCUEIL CLIENT / MARCHAND — briques communes (Lot 12)
// Fond blanc pur, solde en grand ; la devise (drapeau) et « Masquer / Afficher » sont en face du montant (mémorisé),
// barre du haut (salutation, scan QR, notifications). Police Inter, tailles de la maquette.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { Avatar, Bone, UText, useUI } from "../ui";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { useProfilePhoto } from "../../hooks/useProfilePhoto";
import { countriesList } from "../../data/countries";
import { formatMoney } from "../wallet/walletTheme";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { useT } from "../../providers/I18nProvider";

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
/** `badge` : nombre (pastille avec le chiffre, « 99+ » au-delà) ou `true` (simple point). 0 / faux : rien. */
function RoundButton({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: boolean | number }) {
  const { C } = useUI();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={typeof badge === "number" && badge > 0 ? t("home.notifUnread", { label, count: badge }) : label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon as any} size={21} color={C.ink} />
      {typeof badge === "number" && badge > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.danger, borderWidth: 2, borderColor: C.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, fontWeight: "800", color: "#FFFFFF", includeFontPadding: false }}>{badge > 99 ? "99+" : String(badge)}</Text>
        </View>
      ) : badge === true ? (
        <View style={{ position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.beige }} />
      ) : null}
    </Pressable>
  );
}

/** Photo de profil de la personne (initiales à défaut) ; touche → onglet Profil. Même photo en espace client et marchand. */
function ProfileHero({ size = 46 }: { size?: number }) {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const photo = useProfilePhoto();
  const full = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/profile" as any)}
      accessibilityRole="button"
      accessibilityLabel={t("home.myProfile")}
      hitSlop={6}
      style={({ pressed }) => ({ width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 })}
    >
      <Avatar name={full || user?.firstName || "?"} size={size} uri={photo} />
    </Pressable>
  );
}

export function HomeTopBar({
  greeting, name, onScan, onBell, unread, scanIcon = "scan-outline", scanLabel,
}: { greeting?: string; name: string; onScan: () => void; onBell: () => void; unread?: boolean | number; scanIcon?: string; scanLabel?: string }) {
  const { C } = useUI();
  const t = useT();
  // Nombre de notifications non lues, lu auprès du serveur (une valeur passée en `unread` reste prioritaire).
  const unreadCount = useUnreadNotifications();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 12, gap: 10 }}>
      <ProfileHero />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 18, color: C.muted, fontWeight: "400" }}>
          {greeting ? `${greeting} ` : ""}<Text style={{ color: C.ink, fontWeight: "700" }}>{name}</Text>
        </Text>
      </View>
      <RoundButton icon={scanIcon} label={scanLabel ?? t("home.scanPay")} onPress={onScan} />
      <RoundButton icon="notifications-outline" label={t("home.notifications")} onPress={onBell} badge={unread ?? unreadCount} />
    </View>
  );
}

// ─── Solde en grand ──────────────────────────────────────
/**
 * Montant à gauche ; à droite, EN FACE du montant : la devise (drapeau + code) et le bouton « Masquer / Afficher ».
 * Le montant rétrécit tout seul (adjustsFontSizeToFit) pour que la colonne de droite reste toujours visible,
 * quelle que soit la largeur de l'écran ou la taille du solde.
 */
export function BalanceBlock({
  label, amount, currency, countryName, hidden, onToggle, loading, children,
}: {
  label: string; amount: number; currency: string; countryName?: string | null;
  hidden: boolean; onToggle: () => void; loading?: boolean; children?: React.ReactNode;
}) {
  const { C } = useUI();
  const t = useT();
  return (
    <View style={{ paddingTop: 56 }}>
      <UText v="body" color={C.muted}>{label}</UText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <Bone width={200} height={50} radius={12} />
          ) : (
            <Text
              accessibilityLabel={hidden ? t("home.balanceHidden") : t("home.balanceA11y", { amount: formatMoney(amount, currency), currency })}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              numberOfLines={1}
              style={{ fontSize: 44, lineHeight: 54, fontWeight: "800", letterSpacing: -1.5, color: C.ink }}
            >
              {hidden ? "••••••" : formatMoney(amount, currency)}
            </Text>
          )}
        </View>

        <View style={{ alignItems: "center", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CurrencyFlag currency={currency} countryName={countryName} size={26} />
            <Text allowFontScaling={false} style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{currency}</Text>
          </View>
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("home.showBalance") : t("home.hideBalance")}
            hitSlop={10}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17,
              backgroundColor: C.beige, opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={C.text} />
            <Text allowFontScaling={false} style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{hidden ? t("home.show") : t("home.hide")}</Text>
          </Pressable>
        </View>
      </View>
      {children}
    </View>
  );
}
