// apps/direct-transfair-mobile/components/home/HomeParts.tsx
// =========================================================
// ACCUEIL CLIENT / MARCHAND — briques communes (Lot 12)
// ✅ v2.0 : design « carte de solde » — polices réduites (solde 34, salutation 15, boutons 15), barre du haut sur UNE ligne
//    (photo · salutation + prénom · scan · notifications), prénom sur UNE ligne qui rétrécit pour tenir (jamais coupé tant qu'il reste lisible), solde dans une carte
//    à la couleur de marque (trame de points, drapeau, « Masquer / Afficher »), bouton compact HomeButton.
//    Mêmes propriétés et mêmes comportements qu'avant (solde masqué mémorisé, badge de notifications, navigation).
// Fond blanc pur, solde en grand ; la devise (drapeau) et « Masquer / Afficher » sont en face du montant (mémorisé),
// barre du haut (salutation, scan QR, notifications). Police Inter, tailles de la maquette.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "../ui/Icon";
import { Text } from "../ui/Text";
import { Avatar, Bone, alpha, useUI } from "../ui";
import { DotGrid } from "../ui/Corridor";
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
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: C.beige, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon as any} size={19} color={C.ink} />
      {typeof badge === "number" && badge > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.danger, borderWidth: 2, borderColor: C.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize: 10, lineHeight: 13, fontWeight: "800", color: "#FFFFFF", includeFontPadding: false }}>{badge > 99 ? "99+" : String(badge)}</Text>
        </View>
      ) : badge === true ? (
        <View style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.beige }} />
      ) : null}
    </Pressable>
  );
}

/** Photo de profil de la personne (initiales à défaut) ; touche → onglet Profil. Même photo en espace client et marchand. */
function ProfileHero({ size = 36 }: { size?: number }) {
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
      style={({ pressed }) => ({ width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, borderWidth: 1.5, borderColor: C.line, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 })}
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
  // « Bonsoir, » → « Bonsoir » : la salutation tient sur sa propre ligne, au-dessus du prénom.
  const hello = (greeting ?? "").replace(/[\s,]+$/, "");
  return (
    <View style={{ paddingTop: 12 }}>
      {/* Une seule ligne : photo · salutation + prénom (sur une ligne, la police rétrécit si le prénom est long) · scan · notifications. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ProfileHero />
        <View style={{ flex: 1, minWidth: 0 }}>
          {!!hello && <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: C.muted, fontWeight: "400" }}>{hello}</Text>}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: 15, lineHeight: 20, color: C.ink, fontWeight: "700" }}>{name}</Text>
        </View>
        <RoundButton icon={scanIcon} label={scanLabel ?? t("home.scanPay")} onPress={onScan} />
        <RoundButton icon="notifications-outline" label={t("home.notifications")} onPress={onBell} badge={unread ?? unreadCount} />
      </View>
    </View>
  );
}

// ─── Solde : carte à la couleur de marque ────────────────
/**
 * Carte de solde : drapeau + libellé et « Masquer / Afficher » en haut, montant en grand (34), code de la devise à côté.
 * Le montant rétrécit tout seul (adjustsFontSizeToFit) pour rester visible quelle que soit la largeur ou la taille du solde.
 * `overlap` : réserve de la place en bas pour qu'une carte (ex. « Envoyer de l'argent ») vienne chevaucher celle-ci.
 * Les `children` s'affichent sous la carte (ex. ligne « Aujourd'hui » de l'accueil marchand).
 */
export function BalanceBlock({
  label, amount, currency, countryName, hidden, onToggle, loading, overlap, children,
}: {
  label: string; amount: number; currency: string; countryName?: string | null;
  hidden: boolean; onToggle: () => void; loading?: boolean; overlap?: boolean; children?: React.ReactNode;
}) {
  const { C } = useUI();
  const t = useT();
  const ink = C.sunInk;
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ borderRadius: 24, backgroundColor: C.sun, paddingHorizontal: 18, paddingTop: 16, paddingBottom: overlap ? 46 : 16, overflow: "hidden" }}>
        <DotGrid color={ink} opacity={0.14} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 }}>
            <CurrencyFlag currency={currency} countryName={countryName} size={20} />
            <Text numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 16, fontWeight: "500", color: ink, opacity: 0.88, flexShrink: 1 }}>{label}</Text>
          </View>
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("home.showBalance") : t("home.hideBalance")}
            hitSlop={10}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 13,
              backgroundColor: alpha(ink, 0.18), opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={14} color={ink} />
            <Text allowFontScaling={false} style={{ fontSize: 11.5, fontWeight: "600", color: ink }}>{hidden ? t("home.show") : t("home.hide")}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          {loading ? (
            <Bone width={170} height={40} radius={10} style={{ backgroundColor: alpha(ink, 0.2) }} />
          ) : (
            <>
              <Text
                accessibilityLabel={hidden ? t("home.balanceHidden") : t("home.balanceA11y", { amount: formatMoney(amount, currency), currency })}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                numberOfLines={1}
                style={{ fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1, color: ink, flexShrink: 1 }}
              >
                {hidden ? "••••••" : formatMoney(amount, currency)}
              </Text>
              <Text allowFontScaling={false} style={{ fontSize: 14, fontWeight: "700", color: ink, opacity: 0.9 }}>{currency}</Text>
            </>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

// ─── Bouton compact de l'accueil ─────────────────────────
/** Bouton pilule de 48 px (texte 15) : même rôle que Button, en plus discret. `kind` : primary (couleur de marque) · outline · soft. */
export function HomeButton({
  label, onPress, kind = "primary", icon, disabled, testID,
}: { label: string; onPress?: () => void; kind?: "primary" | "outline" | "soft"; icon?: string; disabled?: boolean; testID?: string }) {
  const { C } = useUI();
  const p = kind === "primary"
    ? { bg: C.sun, fg: C.sunInk, bd: undefined as string | undefined }
    : kind === "soft"
      ? { bg: C.accentSoft, fg: C.accentDeep, bd: undefined as string | undefined }
      : { bg: C.surface, fg: C.dark, bd: C.line };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        height: 48, borderRadius: 24, backgroundColor: p.bg, borderWidth: p.bd ? 1.5 : 0, borderColor: p.bd,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20,
        opacity: disabled ? 0.45 : pressed ? 0.88 : 1, transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
      })}
    >
      {!!icon && <Ionicons name={icon as any} size={17} color={p.fg} />}
      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: p.fg }}>{label}</Text>
    </Pressable>
  );
}
