// apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
// =========================================================
// COMPANY ADMIN DASHBOARD — Direct Transf'air v5.0
// Design: Saphir Premium — fond lavande, cartes blanches ombrées
// Inspiré du design Grand Chef (Cormorant + DM Sans + vert émeraude)
// ✅ Carrousel 5 devises
// ✅ Déclaration virement B2B
// ✅ Auto-alimentation caisse
// ✅ Menu actions grid
// ✅ Section réseau agences
// ✅ Correction bug double-sérialisation + fallback TreasuryOverview
// =========================================================

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");
const CURRENCY_CARD_WIDTH = SW - 48;

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
type CurrencyCode = (typeof CURRENCIES_ORDER)[number];

type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  flag: string;
  color: string;
  bg: string;
  soft: string;
  gradStart: string;
  gradEnd: string;
};

const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  XOF: {
    code: "XOF",
    symbol: "CFA",
    flag: "🌍",
    color: "#D97706",
    bg: "#FFFBEB",
    soft: "#FEF9EE",
    gradStart: "#F59E0B",
    gradEnd: "#D97706",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    flag: "🇪🇺",
    color: "#2563EB",
    bg: "#EFF6FF",
    soft: "#EEF4FF",
    gradStart: "#3B82F6",
    gradEnd: "#1D4ED8",
  },
  USD: {
    code: "USD",
    symbol: "$",
    flag: "🇺🇸",
    color: "#059669",
    bg: "#ECFDF5",
    soft: "#F0FDF9",
    gradStart: "#10B981",
    gradEnd: "#047857",
  },
  GNF: {
    code: "GNF",
    symbol: "FG",
    flag: "🇬🇳",
    color: "#DC2626",
    bg: "#FEF2F2",
    soft: "#FFF5F5",
    gradStart: "#EF4444",
    gradEnd: "#B91C1C",
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    flag: "🇬🇧",
    color: "#7C3AED",
    bg: "#F5F3FF",
    soft: "#F8F7FF",
    gradStart: "#8B5CF6",
    gradEnd: "#6D28D9",
  },
};

// ─── Design Tokens ──────────────────────────────────────────
const T = {
  // Fond page — lavande très doux comme les captures
  pageBg: "#EEF2FF",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  surfaceCard: "#FFFFFF",

  // Bordures
  border: "#E2E8F0",
  borderSoft: "#EDF2F7",

  // Couleurs primaires — émeraude/vert comme le thème Grand Chef
  primary: "#0F766E",
  primaryLight: "#CCFBF1",
  primaryDark: "#0D9488",
  accent: "#14B8A6",
  accentSoft: "#F0FDFA",

  // Couleurs sémantiques
  success: "#16A34A",
  successSoft: "#DCFCE7",
  warning: "#D97706",
  warningSoft: "#FEF3C7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  info: "#2563EB",
  infoSoft: "#EFF6FF",

  // Texte
  text: "#0F172A",
  textSoft: "#475569",
  textMuted: "#94A3B8",
  textLight: "#CBD5E1",

  // Ombres
  shadowColor: "rgba(15,23,42,0.10)",
  shadowCard: "rgba(15,23,42,0.07)",

  currencies: CURRENCIES,

  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 26,
    xxl: 32,
  },

  font: {
    // Cormorant Garamond pour les titres display — comme Grand Chef
    display: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    // DM Sans pour l'UI
    sans: Platform.select({
      ios: "Avenir Next",
      android: "sans-serif-medium",
      default: "sans-serif",
    }),
    // DM Mono pour les chiffres
    mono: Platform.select({
      ios: "Courier New",
      android: "monospace",
      default: "monospace",
    }),
  },
} as const;

// ─── Helpers ────────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  if (v && typeof (v as any).toNumber === "function")
    return (v as any).toNumber();
  return 0;
}

function fmtAmount(n: number, currency: string): string {
  const decimals =
    currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return n.toFixed(decimals);
  }
}

function safeCurrency(cur: string | undefined): CurrencyCode {
  return (CURRENCIES_ORDER as readonly string[]).includes(cur || "")
    ? (cur as CurrencyCode)
    : "XOF";
}

// ─── Currency Carousel Card ────────────────────────────────
function CurrencyCard({
  currency,
  balance,
  reserved,
  txCount,
}: {
  currency: CurrencyCode;
  balance: number;
  reserved: number;
  txCount?: number;
}) {
  const cfg = T.currencies[currency];
  const available = balance - reserved;
  const pct =
    balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scaleAnim, {
          toValue: 0.975,
          useNativeDriver: true,
          speed: 60,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 40,
        }).start()
      }
    >
      <Animated.View
        style={[
          ccS.card,
          { width: CURRENCY_CARD_WIDTH, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Bande supérieure colorée */}
        <View style={[ccS.topStripe, { backgroundColor: cfg.color }]} />

        {/* Halo décoratif en arrière-plan */}
        <View
          style={[
            ccS.bgHalo,
            { backgroundColor: cfg.bg },
          ]}
        />

        {/* En-tête */}
        <View style={ccS.headerRow}>
          <View
            style={[
              ccS.flagBox,
              {
                backgroundColor: cfg.bg,
                borderColor: `${cfg.color}28`,
              },
            ]}
          >
            <Text style={{ fontSize: 24 }}>{cfg.flag}</Text>
          </View>

          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text
              style={[
                ccS.currencyCode,
                { color: cfg.color, fontFamily: T.font.mono },
              ]}
            >
              {cfg.code}
            </Text>
            <Text
              style={[
                ccS.currencyName,
                { fontFamily: T.font.sans },
              ]}
            >
              {cfg.code === "XOF"
                ? "Franc CFA"
                : cfg.code === "EUR"
                ? "Euro"
                : cfg.code === "USD"
                ? "Dollar US"
                : cfg.code === "GNF"
                ? "Franc Guinéen"
                : "Livre Sterling"}
            </Text>
          </View>

          {txCount !== undefined && (
            <View
              style={[
                ccS.txBadge,
                {
                  backgroundColor: `${cfg.color}12`,
                  borderColor: `${cfg.color}28`,
                },
              ]}
            >
              <View
                style={[
                  ccS.txDot,
                  { backgroundColor: cfg.color },
                ]}
              />
              <Text
                style={[
                  ccS.txBadgeTxt,
                  { color: cfg.color, fontFamily: T.font.sans },
                ]}
              >
                {txCount} TX
              </Text>
            </View>
          )}
        </View>

        {/* Montant principal */}
        <View style={ccS.amountSection}>
          <Text
            style={[ccS.amountLabel, { fontFamily: T.font.sans }]}
          >
            SOLDE TOTAL
          </Text>
          <Text
            style={[
              ccS.amountValue,
              { fontFamily: T.font.display, color: T.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmtAmount(balance, cfg.code)}
          </Text>
          <Text
            style={[
              ccS.amountSuffix,
              { color: cfg.color, fontFamily: T.font.sans },
            ]}
          >
            {cfg.symbol} · {cfg.code}
          </Text>
        </View>

        {/* Séparateur */}
        <View style={ccS.divider} />

        {/* Disponible / Réservé */}
        <View style={ccS.footRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[ccS.footLabel, { fontFamily: T.font.sans }]}
            >
              DISPONIBLE
            </Text>
            <Text
              style={[
                ccS.footValue,
                { color: T.text, fontFamily: T.font.mono },
              ]}
            >
              {fmtAmount(available, cfg.code)}{" "}
              <Text style={{ color: cfg.color, fontSize: 10 }}>
                {cfg.symbol}
              </Text>
            </Text>
          </View>
          <View
            style={[ccS.footDivider, { backgroundColor: T.border }]}
          />
          <View style={{ flex: 1, paddingLeft: 16 }}>
            <Text
              style={[ccS.footLabel, { fontFamily: T.font.sans }]}
            >
              RÉSERVÉ
            </Text>
            <Text
              style={[
                ccS.footValue,
                { color: T.textMuted, fontFamily: T.font.mono },
              ]}
            >
              {fmtAmount(reserved, cfg.code)}{" "}
              <Text style={{ fontSize: 10 }}>{cfg.symbol}</Text>
            </Text>
          </View>
        </View>

        {/* Barre de progression */}
        <View style={ccS.progContainer}>
          <View style={ccS.progBg}>
            <Animated.View
              style={[
                ccS.progFill,
                {
                  width: `${pct}%` as any,
                  backgroundColor: cfg.color,
                },
              ]}
            />
          </View>
          <Text
            style={[
              ccS.progPct,
              { color: cfg.color, fontFamily: T.font.mono },
            ]}
          >
            {Math.round(pct)}%
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const ccS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.xl,
    marginRight: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
    paddingBottom: 20,
    // Ombre card premium
    shadowColor: "#1E3A5F",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  topStripe: {
    height: 5,
    width: "100%",
  },
  bgHalo: {
    position: "absolute",
    top: 0,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 999,
    opacity: 0.35,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  flagBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  currencyCode: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  currencyName: {
    fontSize: 12,
    color: T.textMuted,
    fontWeight: "500",
  },
  txBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  txDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  txBadgeTxt: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  amountSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  amountLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1,
    marginBottom: 4,
    lineHeight: 44,
  },
  amountSuffix: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: T.borderSoft,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  footRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  footDivider: {
    width: 1,
    height: "100%",
  },
  footLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  footValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  progContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 10,
  },
  progBg: {
    flex: 1,
    height: 5,
    backgroundColor: T.borderSoft,
    borderRadius: 99,
    overflow: "hidden",
  },
  progFill: {
    height: 5,
    borderRadius: 99,
  },
  progPct: {
    fontSize: 10,
    fontWeight: "900",
  },
});

// ─── Pagination dots ───────────────────────────────────────
function Dots({ active }: { active: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {CURRENCIES_ORDER.map((cur, i) => {
        const cfg = T.currencies[cur];
        const isActive = i === active;
        return (
          <View
            key={cur}
            style={{
              width: isActive ? 22 : 6,
              height: 6,
              borderRadius: 99,
              backgroundColor: isActive ? cfg.color : T.border,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Section Header ────────────────────────────────────────
function SectionHeader({
  label,
  color,
  action,
  onAction,
}: {
  label: string;
  color?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={shS.row}>
      <View
        style={[
          shS.dot,
          { backgroundColor: color || T.primary },
        ]}
      />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>
        {label}
      </Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text
            style={[
              shS.action,
              { color: color || T.primary, fontFamily: T.font.sans },
            ]}
          >
            {action}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const shS = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  label: {
    flex: 1,
    fontSize: 10,
    fontWeight: "900",
    color: T.textSoft,
    letterSpacing: 1.8,
  },
  action: {
    fontSize: 11,
    fontWeight: "800",
  },
});

// ─── Stat Mini Card (solde antenne style) ─────────────────
function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
  bg,
}: {
  icon: string;
  label: string;
  value: string | number;
  suffix?: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={stS.card}>
      <View style={[stS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text
        style={[stS.value, { color: T.text, fontFamily: T.font.display }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
        {suffix && (
          <Text style={[stS.suffix, { color, fontFamily: T.font.mono }]}>
            {" "}
            {suffix}
          </Text>
        )}
      </Text>
      <Text style={[stS.label, { fontFamily: T.font.sans }]}>
        {label}
      </Text>
    </View>
  );
}

const stS = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    shadowColor: "#1E3A5F",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  suffix: {
    fontSize: 11,
    fontWeight: "800",
  },
  label: {
    fontSize: 9,
    fontWeight: "900",
    color: T.textMuted,
    letterSpacing: 1.2,
    textAlign: "center",
  },
});

// ─── Action Card (menu 2×2) ────────────────────────────────
function ActionCard({
  title,
  subtitle,
  icon,
  color,
  bg,
  onPress,
  badge,
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  onPress: () => void;
  badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View
      style={{ width: "48%", marginBottom: 14, transform: [{ scale }] }}
    >
      <TouchableOpacity
        style={acS.card}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 30,
          }).start()
        }
        activeOpacity={1}
      >
        {/* Halo décoratif */}
        <View
          style={[
            acS.halo,
            { backgroundColor: bg },
          ]}
        />

        <View style={acS.topRow}>
          <View style={[acS.iconBox, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={20} color={color} />
          </View>
          {badge && (
            <View
              style={[
                acS.badge,
                {
                  backgroundColor: `${color}10`,
                  borderColor: `${color}22`,
                },
              ]}
            >
              <Text
                style={[
                  acS.badgeTxt,
                  { color, fontFamily: T.font.sans },
                ]}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[acS.title, { fontFamily: T.font.sans }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[acS.subtitle, { fontFamily: T.font.sans }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>

        {/* Arrow */}
        <View style={[acS.arrow, { backgroundColor: bg }]}>
          <Ionicons name="arrow-forward" size={10} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const acS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
    shadowColor: "#1E3A5F",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  halo: {
    position: "absolute",
    bottom: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 99,
    opacity: 0.5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeTxt: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: T.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: T.textSoft,
    fontWeight: "500",
    lineHeight: 15,
    paddingBottom: 14,
  },
  arrow: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 22,
    height: 22,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Agency Mini Card ──────────────────────────────────────
function AgencyMiniCard({
  agency,
  onRefill,
}: {
  agency: any;
  onRefill: () => void;
}) {
  const isActive = agency.isActive !== false;
  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const primary =
    wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance = toNum(primary?.balance ?? agency.balance ?? 0);
  const currency = primary?.currency ?? agency.primaryCurrency ?? "XOF";
  const cfg =
    T.currencies[currency as CurrencyCode] ?? T.currencies.XOF;

  const flagMap: Record<string, string> = {
    GN: "🇬🇳",
    SN: "🇸🇳",
    ML: "🇲🇱",
    CI: "🇨🇮",
    FR: "🇫🇷",
    GB: "🇬🇧",
    US: "🇺🇸",
    BF: "🇧🇫",
    NE: "🇳🇪",
    TG: "🇹🇬",
  };
  const flag = agency.country
    ? (flagMap[agency.country.toUpperCase().substring(0, 2)] ?? "🌍")
    : "🌍";

  return (
    <View style={agS.card}>
      {/* Barre latérale colorée */}
      <View
        style={[
          agS.sideBar,
          { backgroundColor: isActive ? T.success : T.danger },
        ]}
      />

      <View style={agS.inner}>
        <View style={agS.topRow}>
          {/* Flag */}
          <View style={agS.flagBox}>
            <Text style={{ fontSize: 26 }}>{flag}</Text>
          </View>

          {/* Infos */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[agS.name, { fontFamily: T.font.display }]}
              numberOfLines={1}
            >
              {agency.name}
            </Text>
            <Text
              style={[agS.city, { fontFamily: T.font.sans }]}
            >
              {agency.city || "—"} · {agency.country || "—"}
            </Text>
          </View>

          {/* Solde */}
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={[agS.balLabel, { fontFamily: T.font.sans }]}
            >
              SOLDE
            </Text>
            <Text
              style={[
                agS.balValue,
                { color: cfg.color, fontFamily: T.font.display },
              ]}
            >
              {fmtAmount(balance, currency)}
            </Text>
            <Text
              style={[
                agS.balCur,
                { color: cfg.color, fontFamily: T.font.mono },
              ]}
            >
              {cfg.symbol}
            </Text>
          </View>
        </View>

        <View style={agS.divider} />

        {/* Pied */}
        <View style={agS.foot}>
          <View
            style={[
              agS.statusPill,
              {
                backgroundColor: isActive
                  ? T.successSoft
                  : T.dangerSoft,
                borderColor: isActive
                  ? `${T.success}30`
                  : `${T.danger}30`,
              },
            ]}
          >
            <View
              style={[
                agS.statusDot,
                {
                  backgroundColor: isActive ? T.success : T.danger,
                },
              ]}
            />
            <Text
              style={[
                agS.statusTxt,
                {
                  color: isActive ? T.success : T.danger,
                  fontFamily: T.font.sans,
                },
              ]}
            >
              {isActive ? "Opérationnelle" : "Suspendue"}
            </Text>
          </View>

          <TouchableOpacity
            style={agS.refillBtn}
            onPress={onRefill}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[T.primary, T.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={agS.refillGrad}
            >
              <Ionicons
                name="paper-plane-outline"
                size={13}
                color="#fff"
              />
              <Text
                style={[agS.refillTxt, { fontFamily: T.font.sans }]}
              >
                Recharger
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const agS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#1E3A5F",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  sideBar: { width: 4 },
  inner: { flex: 1, padding: 16 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  flagBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: T.pageBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
  },
  name: {
    color: T.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  city: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  balLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: T.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  balValue: { fontSize: 16, fontWeight: "700" },
  balCur: { fontSize: 10, fontWeight: "800", marginTop: 1 },
  divider: {
    height: 1,
    backgroundColor: T.borderSoft,
    marginBottom: 12,
  },
  foot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 99 },
  statusTxt: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  refillBtn: { borderRadius: 10, overflow: "hidden" },
  refillGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  refillTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
});

// ─── Virement Banner ───────────────────────────────────────
function VirementBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={vbS.wrap}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={[T.primary, T.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={vbS.grad}
      >
        {/* Cercles décoratifs */}
        <View style={vbS.deco1} />
        <View style={vbS.deco2} />

        <View
          style={[
            vbS.iconBox,
            { backgroundColor: "rgba(255,255,255,0.18)" },
          ]}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={20}
            color="#fff"
          />
        </View>
        <View style={{ flex: 1, paddingLeft: 14 }}>
          <Text style={[vbS.title, { fontFamily: T.font.display }]}>
            Déclarer un Virement B2B
          </Text>
          <Text style={[vbS.sub, { fontFamily: T.font.sans }]}>
            En attente de validation Super Admin
          </Text>
        </View>
        <View
          style={[
            vbS.arrow,
            { backgroundColor: "rgba(255,255,255,0.18)" },
          ]}
        >
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const vbS = StyleSheet.create({
  wrap: {
    borderRadius: T.radius.lg,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: T.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  grad: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    overflow: "hidden",
  },
  deco1: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -40,
    right: 80,
  },
  deco2: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -20,
    right: 20,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  sub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Main Component ────────────────────────────────────────
export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [activeCurrency, setActiveCurrency] = useState(0);

  // Modal virement B2B
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  // Modal auto-alimentation caisse
  const [autoFillVisible, setAutoFillVisible] = useState(false);
  const [autoFillCurrency, setAutoFillCurrency] =
    useState<CurrencyCode>("XOF");
  const [autoFillAmount, setAutoFillAmount] = useState("");
  const [autoFillProcessing, setAutoFillProcessing] = useState(false);

  // Modal recharge agence
  const [refillAgencyVisible, setRefillAgencyVisible] = useState(false);
  const [targetAgency, setTargetAgency] = useState<any>(null);
  const [refillAmount, setRefillAmount] = useState("");
  const [refillProcessing, setRefillProcessing] = useState(false);

  const contentAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const clientName = useMemo(
    () => user?.client?.name || "Mon Entreprise",
    [user?.client?.name],
  );

  const getWalletBalance = useCallback(
    (currency: string) => {
      const w = wallets.find((x) => x.currency === currency);
      return {
        balance: toNum(w?.balance),
        reserved: toNum(w?.reservedBalance),
      };
    },
    [wallets],
  );

  // ── loadData avec fallback TreasuryOverview ──────────────
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();

      // Wallets
      let wals: any[] = [];
      if (api.getMyWallets) {
        wals = await api.getMyWallets().catch(() => []);
      }

      // Fallback si tous à zéro
      const allZero =
        wals.length === 0 ||
        wals.every((w) => toNum(w?.balance) === 0);
      if (allZero && api.getTreasuryOverview) {
        const overview = await api
          .getTreasuryOverview()
          .catch(() => []);
        if (Array.isArray(overview) && overview.length > 0) {
          wals = overview;
        }
      }
      setWallets(Array.isArray(wals) ? wals : []);

      // Agences
      if (api.getAgencies) {
        const ags = await api.getAgencies().catch(() => []);
        setAgencies(Array.isArray(ags) ? ags : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      // Animations d'entrée
      Animated.parallel([
        Animated.spring(contentAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 8,
          bounciness: 4,
        }),
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, [loadData]),
  );

  useEffect(() => {
    setAutoFillCurrency(CURRENCIES_ORDER[activeCurrency]);
  }, [activeCurrency]);

  // ── Handlers modals ─────────────────────────────────────
  const closeModal = () => {
    setModalVisible(false);
    setAmount("");
    setRefBancaire("");
  };

  const closeAutoFill = () => {
    setAutoFillVisible(false);
    setAutoFillAmount("");
  };

  const closeRefillAgency = () => {
    setRefillAgencyVisible(false);
    setRefillAmount("");
    setTargetAgency(null);
  };

  const openAutoFill = (currency: CurrencyCode) => {
    setAutoFillCurrency(currency);
    setAutoFillAmount("");
    setAutoFillVisible(true);
  };

  // ── Auto-alimentation ────────────────────────────────────
  const handleAutoFill = async () => {
    const n = Number(autoFillAmount);
    if (!autoFillAmount || isNaN(n) || n <= 0) {
      Alert.alert("Erreur", "Saisissez un montant valide.");
      return;
    }
    setAutoFillProcessing(true);
    try {
      // ✅ Fix : utiliser api.adminFundSelf — pas de double-sérialisation
      await api.adminFundSelf(n, autoFillCurrency);
      closeAutoFill();
      const msg = `${fmtAmount(n, autoFillCurrency)} ${autoFillCurrency} ajouté à votre caisse.`;
      if (Platform.OS === "web") {
        alert(`✅ Caisse alimentée\n\n${msg}`);
      } else {
        Alert.alert("✅ Caisse alimentée", msg);
      }
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur technique";
      if (Platform.OS === "web") alert(`Erreur\n\n${msg}`);
      else Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setAutoFillProcessing(false);
    }
  };

  // ── Virement B2B ─────────────────────────────────────────
  const handlePay = async () => {
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) {
      Alert.alert("Erreur", "Saisissez un montant valide.");
      return;
    }
    setProcessing(true);
    try {
      await api.declareBankTransfer(n, refBancaire);
      closeModal();
      Alert.alert(
        "✅ Déclaration envoyée",
        "En attente de validation par le Super Admin.",
      );
      await loadData();
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.response?.data?.message || "Erreur technique",
      );
    } finally {
      setProcessing(false);
    }
  };

  // ── Recharge agence ──────────────────────────────────────
  const handleRefillAgency = async () => {
    const n = Number(refillAmount);
    if (!refillAmount || isNaN(n) || n <= 0) {
      Alert.alert("Erreur", "Saisissez un montant valide.");
      return;
    }
    setRefillProcessing(true);
    try {
      await api.adminRefillAgency(targetAgency.id, n);
      closeRefillAgency();
      Alert.alert(
        "✅ Rechargé",
        `L'agence ${targetAgency.name} a été créditée de ${fmtAmount(n, "XOF")} CFA.`,
      );
      await loadData();
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.response?.data?.message || "Erreur technique",
      );
    } finally {
      setRefillProcessing(false);
    }
  };

  // ── Stats rapides ────────────────────────────────────────
  const totalAgencies = agencies.length;
  const activeAgencies = agencies.filter((a) => a.isActive !== false).length;
  const primaryWallet = getWalletBalance("XOF");

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.pageBg} />

      {/* ══════════════════════════════════════
          HEADER — style Grand Chef
      ══════════════════════════════════════ */}
      <Animated.View
        style={[
          s.header,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={["#FFFFFF", "#F8FCFA"]}
          style={s.headerGrad}
        >
          <View style={s.headerContent}>
            {/* Avatar */}
            <View style={s.avatarWrap}>
              <LinearGradient
                colors={[T.primary, T.accent]}
                style={s.avatar}
              >
                <Text
                  style={[s.avatarTxt, { fontFamily: T.font.display }]}
                >
                  {(clientName[0] ?? "E").toUpperCase()}
                </Text>
              </LinearGradient>
              {/* Indicateur actif */}
              <View style={s.avatarDot} />
            </View>

            {/* Titre */}
            <View style={{ flex: 1, paddingLeft: 12 }}>
              <View style={s.headerBadge}>
                <View
                  style={[
                    s.headerBadgeDot,
                    { backgroundColor: T.success },
                  ]}
                />
                <Text
                  style={[
                    s.headerBadgeTxt,
                    { fontFamily: T.font.sans },
                  ]}
                >
                  PILOTAGE SOCIÉTÉ
                </Text>
              </View>
              <Text
                style={[s.headerTitle, { fontFamily: T.font.display }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {clientName}
              </Text>
              <Text
                style={[s.headerSub, { fontFamily: T.font.sans }]}
                numberOfLines={1}
              >
                Trésorerie multi-devises
              </Text>
            </View>

            {/* Actions */}
            <View style={s.headerActions}>
              <TouchableOpacity
                style={s.headerBtn}
                onPress={loadData}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={17} color={T.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.headerBtn}
                onPress={() =>
                  router.push("/(tabs)/admin/notifications")
                }
                activeOpacity={0.8}
              >
                <Ionicons
                  name="notifications-outline"
                  size={17}
                  color={T.text}
                />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Ligne de bienvenue */}
          <View style={s.welcomeStrip}>
            <Text
              style={[s.welcomeTxt, { fontFamily: T.font.sans }]}
            >
              Bonjour,{" "}
              <Text style={{ fontWeight: "800", color: T.text }}>
                {user?.firstName || "Admin"}
              </Text>{" "}
              👋
            </Text>
            <View style={s.datePill}>
              <Text
                style={[s.dateTxt, { fontFamily: T.font.sans }]}
              >
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ══════════════════════════════════════
          SCROLL CONTENT
      ══════════════════════════════════════ */}
      <Animated.ScrollView
        style={[
          s.scroll,
          {
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={T.primary}
            colors={[T.primary]}
          />
        }
      >
        {/* ── Stats rapides ── */}
        <View style={s.statsRow}>
          <StatCard
            icon="storefront-outline"
            label="AGENCES"
            value={totalAgencies}
            color={T.info}
            bg={T.infoSoft}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="ACTIVES"
            value={activeAgencies}
            color={T.success}
            bg={T.successSoft}
          />
          <StatCard
            icon="cash-outline"
            label="DEVISES"
            value={5}
            color={T.warning}
            bg={T.warningSoft}
          />
        </View>

        {/* ── Section Trésorerie ── */}
        <SectionHeader
          label="TRÉSORERIE · 5 DEVISES"
          color={T.warning}
        />

        {/* Carrousel */}
        <ScrollView
          horizontal
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CURRENCY_CARD_WIDTH + 16}
          decelerationRate="fast"
          onScroll={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x /
                (CURRENCY_CARD_WIDTH + 16),
            );
            setActiveCurrency(
              Math.max(
                0,
                Math.min(idx, CURRENCIES_ORDER.length - 1),
              ),
            );
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingRight: 4 }}
        >
          {CURRENCIES_ORDER.map((cur) => {
            const d = getWalletBalance(cur);
            return (
              <CurrencyCard
                key={cur}
                currency={cur}
                balance={d.balance}
                reserved={d.reserved}
              />
            );
          })}
        </ScrollView>

        <Dots active={activeCurrency} />

        {/* ── Sélecteur devise + bouton alimentation ── */}
        <View style={s.feedSection}>
          <Text
            style={[s.feedLabel, { fontFamily: T.font.sans }]}
          >
            ALIMENTER MA CAISSE
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRow}
          >
            {CURRENCIES_ORDER.map((cur) => {
              const cfg = T.currencies[cur];
              const selected = autoFillCurrency === cur;
              return (
                <TouchableOpacity
                  key={cur}
                  onPress={() => setAutoFillCurrency(cur)}
                  activeOpacity={0.8}
                  style={[
                    s.chip,
                    {
                      backgroundColor: selected
                        ? cfg.soft
                        : T.surface,
                      borderColor: selected
                        ? cfg.color
                        : T.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>{cfg.flag}</Text>
                  <Text
                    style={[
                      s.chipTxt,
                      {
                        color: selected ? T.text : T.textSoft,
                        fontFamily: T.font.sans,
                      },
                    ]}
                  >
                    {cfg.code}
                  </Text>
                  {selected && (
                    <View
                      style={[
                        s.chipDot,
                        { backgroundColor: cfg.color },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={s.feedBtn}
            onPress={() => setAutoFillVisible(true)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[T.success, "#22C55E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.feedBtnGrad}
            >
              <View
                style={[
                  s.feedBtnIcon,
                  { backgroundColor: "rgba(255,255,255,0.2)" },
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color="#fff"
                />
              </View>
              <Text
                style={[s.feedBtnTxt, { fontFamily: T.font.sans }]}
              >
                Alimenter en {autoFillCurrency}
              </Text>
              <View
                style={[
                  s.feedBtnArrow,
                  { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Virement B2B Banner ── */}
        <VirementBanner onPress={() => setModalVisible(true)} />

        {/* ── Actions rapides ── */}
        <SectionHeader label="ACTIONS RAPIDES" color={T.info} />

        <View style={s.actionsGrid}>
          <ActionCard
            title="Transactions"
            subtitle="Historique & suivi"
            icon="list-outline"
            color={T.info}
            bg={T.infoSoft}
            onPress={() => router.push("/(tabs)/admin/transactions")}
          />
          <ActionCard
            title="Agences"
            subtitle="Réseau & gestion"
            icon="storefront-outline"
            color={T.success}
            bg={T.successSoft}
            onPress={() => router.push("/(tabs)/admin/agencies")}
            badge="Réseau"
          />
          <ActionCard
            title="Trésorerie"
            subtitle="Vue détaillée"
            icon="wallet-outline"
            color={T.warning}
            bg={T.warningSoft}
            onPress={() => router.push("/(tabs)/admin/treasury")}
          />
          <ActionCard
            title="Paramètres"
            subtitle="Compte & société"
            icon="settings-outline"
            color="#7C3AED"
            bg="#F5F3FF"
            onPress={() => router.push("/(tabs)/admin/settings")}
          />
        </View>

        {/* ── Agences ── */}
        {agencies.length > 0 && (
          <>
            <SectionHeader
              label={`AGENCES DU RÉSEAU · ${totalAgencies}`}
              color={T.success}
              action="Voir tout"
              onAction={() => router.push("/(tabs)/admin/agencies")}
            />

            {agencies.slice(0, 5).map((agency) => (
              <AgencyMiniCard
                key={agency.id}
                agency={agency}
                onRefill={() => {
                  setTargetAgency(agency);
                  setRefillAmount("");
                  setRefillAgencyVisible(true);
                }}
              />
            ))}

            {agencies.length > 5 && (
              <TouchableOpacity
                style={s.seeMoreBtn}
                onPress={() => router.push("/(tabs)/admin/agencies")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.seeMoreTxt,
                    { fontFamily: T.font.sans },
                  ]}
                >
                  Voir les {agencies.length - 5} autres agences
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={T.primary}
                />
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* ══════════════════════════════════════
          MODAL — AUTO-ALIMENTATION CAISSE
      ══════════════════════════════════════ */}
      <Modal
        visible={autoFillVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAutoFill}
      >
        <View style={ms.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={ms.sheet}>
              <View style={ms.handle} />

              <LinearGradient
                colors={[T.success, "#22C55E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ms.sheetHeader}
              >
                <View style={ms.sheetIconBox}>
                  <Ionicons name="wallet" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1, paddingLeft: 14 }}>
                  <Text
                    style={[
                      ms.sheetTitle,
                      { fontFamily: T.font.display },
                    ]}
                  >
                    Alimenter ma Caisse
                  </Text>
                  <Text
                    style={[
                      ms.sheetSub,
                      { fontFamily: T.font.sans },
                    ]}
                  >
                    Injection directe · {autoFillCurrency}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeAutoFill}
                  style={ms.closeBtn}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>

              <View style={ms.body}>
                {/* Info box */}
                <View
                  style={[
                    ms.infoBox,
                    {
                      backgroundColor: T.successSoft,
                      borderColor: `${T.success}25`,
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={T.success}
                  />
                  <Text
                    style={[
                      ms.infoTxt,
                      {
                        color: T.success,
                        fontFamily: T.font.sans,
                      },
                    ]}
                  >
                    Ce montant sera ajouté à votre portefeuille{" "}
                    {autoFillCurrency}. Disponible immédiatement.
                  </Text>
                </View>

                {/* Input montant */}
                <Text
                  style={[ms.inputLabel, { fontFamily: T.font.sans }]}
                >
                  MONTANT À INJECTER
                </Text>
                <View style={ms.inputRow}>
                  <TextInput
                    style={[ms.input, { fontFamily: T.font.display }]}
                    value={autoFillAmount}
                    onChangeText={setAutoFillAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={T.textLight}
                    autoFocus
                  />
                  <View
                    style={[
                      ms.inputSuffix,
                      { backgroundColor: T.successSoft },
                    ]}
                  >
                    <Text
                      style={[
                        ms.suffixTxt,
                        {
                          color: T.success,
                          fontFamily: T.font.mono,
                        },
                      ]}
                    >
                      {autoFillCurrency}
                    </Text>
                  </View>
                </View>

                {/* Montants rapides */}
                <View style={ms.quickRow}>
                  {[100000, 500000, 1000000, 5000000].map((v) => {
                    const sel = autoFillAmount === String(v);
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[
                          ms.quickBtn,
                          {
                            backgroundColor: sel
                              ? T.successSoft
                              : T.surfaceAlt,
                            borderColor: sel
                              ? `${T.success}40`
                              : T.border,
                          },
                        ]}
                        onPress={() =>
                          setAutoFillAmount(String(v))
                        }
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            ms.quickTxt,
                            {
                              color: sel ? T.success : T.textSoft,
                              fontFamily: T.font.mono,
                            },
                          ]}
                        >
                          {fmtAmount(v, autoFillCurrency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Bouton confirmer */}
                <TouchableOpacity
                  style={[
                    ms.confirmBtn,
                    autoFillProcessing && { opacity: 0.7 },
                  ]}
                  onPress={handleAutoFill}
                  disabled={autoFillProcessing}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={[T.success, "#22C55E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={ms.confirmGrad}
                  >
                    {autoFillProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="add-circle-outline"
                          size={18}
                          color="#fff"
                        />
                        <Text
                          style={[
                            ms.confirmTxt,
                            { fontFamily: T.font.sans },
                          ]}
                        >
                          INJECTER{" "}
                          {autoFillAmount
                            ? fmtAmount(
                                Number(autoFillAmount),
                                autoFillCurrency,
                              )
                            : "—"}{" "}
                          {autoFillCurrency}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeAutoFill}
                  style={ms.cancelBtn}
                  disabled={autoFillProcessing}
                >
                  <Text
                    style={[
                      ms.cancelTxt,
                      { fontFamily: T.font.sans },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════
          MODAL — VIREMENT B2B
      ══════════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={ms.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={ms.sheet}>
              <View style={ms.handle} />

              <LinearGradient
                colors={[T.primary, T.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ms.sheetHeader}
              >
                <View style={ms.sheetIconBox}>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={22}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1, paddingLeft: 14 }}>
                  <Text
                    style={[
                      ms.sheetTitle,
                      { fontFamily: T.font.display },
                    ]}
                  >
                    Déclarer un Virement
                  </Text>
                  <Text
                    style={[
                      ms.sheetSub,
                      { fontFamily: T.font.sans },
                    ]}
                  >
                    Alimentation B2B · en attente validation
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeModal}
                  style={ms.closeBtn}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>

              <View style={ms.body}>
                {/* Montant */}
                <Text
                  style={[ms.inputLabel, { fontFamily: T.font.sans }]}
                >
                  MONTANT
                </Text>
                <View style={ms.inputRow}>
                  <TextInput
                    style={[ms.input, { fontFamily: T.font.display }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={T.textLight}
                    autoFocus
                  />
                  <View
                    style={[
                      ms.inputSuffix,
                      { backgroundColor: T.infoSoft },
                    ]}
                  >
                    <Text
                      style={[
                        ms.suffixTxt,
                        {
                          color: T.info,
                          fontFamily: T.font.mono,
                        },
                      ]}
                    >
                      XOF
                    </Text>
                  </View>
                </View>

                {/* Référence bancaire */}
                <Text
                  style={[
                    ms.inputLabel,
                    { fontFamily: T.font.sans, marginTop: 16 },
                  ]}
                >
                  RÉFÉRENCE BANCAIRE
                </Text>
                <TextInput
                  style={[
                    ms.inputSingle,
                    { fontFamily: T.font.mono },
                  ]}
                  value={refBancaire}
                  onChangeText={setRefBancaire}
                  placeholder="REF-VIREMENT-XXXX"
                  placeholderTextColor={T.textLight}
                  autoCapitalize="characters"
                />

                {/* Bouton confirmer */}
                <TouchableOpacity
                  style={[
                    ms.confirmBtn,
                    processing && { opacity: 0.7 },
                  ]}
                  onPress={handlePay}
                  disabled={processing}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={[T.primary, T.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={ms.confirmGrad}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text
                          style={[
                            ms.confirmTxt,
                            { fontFamily: T.font.sans },
                          ]}
                        >
                          ENVOYER POUR VALIDATION
                        </Text>
                        <Ionicons name="send" size={16} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeModal}
                  style={ms.cancelBtn}
                  disabled={processing}
                >
                  <Text
                    style={[
                      ms.cancelTxt,
                      { fontFamily: T.font.sans },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════
          MODAL — RECHARGE AGENCE
      ══════════════════════════════════════ */}
      <Modal
        visible={refillAgencyVisible}
        transparent
        animationType="slide"
        onRequestClose={closeRefillAgency}
      >
        <View style={ms.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={ms.sheet}>
              <View style={ms.handle} />

              <LinearGradient
                colors={["#7C3AED", "#6D28D9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ms.sheetHeader}
              >
                <View style={ms.sheetIconBox}>
                  <Ionicons
                    name="paper-plane-outline"
                    size={22}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1, paddingLeft: 14 }}>
                  <Text
                    style={[
                      ms.sheetTitle,
                      { fontFamily: T.font.display },
                    ]}
                  >
                    Recharger l'Agence
                  </Text>
                  <Text
                    style={[
                      ms.sheetSub,
                      { fontFamily: T.font.sans },
                    ]}
                  >
                    {targetAgency?.name || "—"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeRefillAgency}
                  style={ms.closeBtn}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>

              <View style={ms.body}>
                <Text
                  style={[ms.inputLabel, { fontFamily: T.font.sans }]}
                >
                  MONTANT À TRANSFÉRER (XOF)
                </Text>
                <View style={ms.inputRow}>
                  <TextInput
                    style={[ms.input, { fontFamily: T.font.display }]}
                    value={refillAmount}
                    onChangeText={setRefillAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={T.textLight}
                    autoFocus
                  />
                  <View
                    style={[
                      ms.inputSuffix,
                      { backgroundColor: "#F5F3FF" },
                    ]}
                  >
                    <Text
                      style={[
                        ms.suffixTxt,
                        { color: "#7C3AED", fontFamily: T.font.mono },
                      ]}
                    >
                      CFA
                    </Text>
                  </View>
                </View>

                {/* Montants rapides */}
                <View style={ms.quickRow}>
                  {[50000, 100000, 500000, 1000000].map((v) => {
                    const sel = refillAmount === String(v);
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[
                          ms.quickBtn,
                          {
                            backgroundColor: sel
                              ? "#F5F3FF"
                              : T.surfaceAlt,
                            borderColor: sel
                              ? "#7C3AED40"
                              : T.border,
                          },
                        ]}
                        onPress={() => setRefillAmount(String(v))}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            ms.quickTxt,
                            {
                              color: sel ? "#7C3AED" : T.textSoft,
                              fontFamily: T.font.mono,
                            },
                          ]}
                        >
                          {fmtAmount(v, "XOF")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[
                    ms.confirmBtn,
                    refillProcessing && { opacity: 0.7 },
                  ]}
                  onPress={handleRefillAgency}
                  disabled={refillProcessing}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={["#7C3AED", "#6D28D9"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={ms.confirmGrad}
                  >
                    {refillProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="paper-plane"
                          size={16}
                          color="#fff"
                        />
                        <Text
                          style={[
                            ms.confirmTxt,
                            { fontFamily: T.font.sans },
                          ]}
                        >
                          TRANSFÉRER{" "}
                          {refillAmount
                            ? fmtAmount(Number(refillAmount), "XOF")
                            : "—"}{" "}
                          CFA
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeRefillAgency}
                  style={ms.cancelBtn}
                  disabled={refillProcessing}
                >
                  <Text
                    style={[
                      ms.cancelTxt,
                      { fontFamily: T.font.sans },
                    ]}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles globaux ────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  // Header
  header: {
    zIndex: 10,
    shadowColor: "#1E3A5F",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  headerGrad: {
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 12,
    gap: 0,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTxt: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  avatarDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: T.success,
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.accentSoft,
    borderWidth: 1,
    borderColor: `${T.primary}20`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  headerBadgeTxt: {
    color: T.primary,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: T.text,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  headerSub: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  headerActions: { flexDirection: "row", gap: 8, marginLeft: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: T.danger,
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  // Bande de bienvenue
  welcomeStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 2,
  },
  welcomeTxt: {
    color: T.textSoft,
    fontSize: 13,
    fontWeight: "600",
  },
  datePill: {
    backgroundColor: T.primaryLight,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${T.primary}20`,
  },
  dateTxt: {
    color: T.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },

  // Section d'alimentation
  feedSection: {
    marginBottom: 20,
    marginTop: 4,
  },
  feedLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTxt: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  feedBtn: {
    borderRadius: T.radius.md,
    overflow: "hidden",
    shadowColor: T.success,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  feedBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  feedBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  feedBtnTxt: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  feedBtnArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  // Actions grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  // See more
  seeMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  seeMoreTxt: {
    color: T.primary,
    fontSize: 12,
    fontWeight: "800",
  },
});

// ─── Modal styles ──────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: T.radius.lg,
  },
  sheetIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  sheetSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  body: { padding: 20 },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoTxt: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },

  inputLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.pageBg,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: T.radius.md,
    overflow: "hidden",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    color: T.text,
    fontWeight: "700",
  },
  inputSingle: {
    backgroundColor: T.pageBg,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: T.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: T.text,
    fontWeight: "600",
    marginBottom: 16,
  },
  inputSuffix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderLeftWidth: 1,
    borderLeftColor: T.border,
  },
  suffixTxt: {
    fontSize: 12,
    fontWeight: "900",
  },

  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickTxt: {
    fontSize: 11,
    fontWeight: "800",
  },

  confirmBtn: {
    borderRadius: T.radius.md,
    overflow: "hidden",
    marginBottom: 4,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  confirmGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 8,
  },
  confirmTxt: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.8,
  },

  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelTxt: {
    color: T.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
});