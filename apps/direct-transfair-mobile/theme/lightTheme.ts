// apps/direct-transfair-mobile/theme/lightTheme.ts
// =========================================================
// LIGHT THEME — Direct Transf'air
// Inspiré capture Grand Chef : fond blanc/gris doux,
// cartes blanches, accents colorés, zéro dark/sombre
// =========================================================
import { Platform } from "react-native";

export const LT = {
  // Backgrounds
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  surfaceSub: "#F8FAFC",

  // Borders
  border:   "#E4E9F0",
  borderMd: "#CDD5E0",

  // Text
  ink:      "#0F172A",
  inkMid:   "#1E293B",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",

  // Accents
  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  greenMd:  "#86EFAC",

  red:      "#DC2626",
  redLt:    "#FEE2E2",

  amber:    "#D97706",
  amberLt:  "#FEF3C7",

  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  teal:     "#0F766E",
  tealLt:   "#CCFBF1",

  white:    "#FFFFFF",

  // Currency colors (conservés)
  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", colorDark: "#1240D6", bg: "#EEF2FF", name: "Euro" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", colorDark: "#15803D", bg: "#DCFCE7", name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", colorDark: "#B45309", bg: "#FEF3C7", name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", colorDark: "#B91C1C", bg: "#FEE2E2", name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#EDE9FE", name: "Livre Sterling" },
  },

  statusColors: {
    ACTIVE:    "#16A34A",
    SUSPENDED: "#D97706",
    INACTIVE:  "#DC2626",
    EXPIRED:   "#DC2626",
    TRIAL:     "#6366F1",
  } as Record<string, string>,

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    display:  Platform.select({ ios: "Georgia",      android: "serif",                 default: "serif" }),
    sans:     Platform.select({ ios: "Avenir Next",  android: "sans-serif-medium",     default: "sans-serif" }),
    subtitle: Platform.select({ ios: "Avenir Next",  android: "sans-serif-light",      default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New",  android: "monospace",             default: "monospace" }),
  },

  shadow: {
    card: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 4,
    },
    deep: {
      shadowColor: "#0D33B0",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 10,
    },
    soft: {
      shadowColor: "#64748B",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    hero: {
      shadowColor: "#0A2FA8",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.35,
      shadowRadius: 36,
      elevation: 22,
    },
  },
};

// Role themes — tous light désormais
export const ROLE_THEMES_LIGHT = {
  SUPER_ADMIN:   { pageBg: "#F0F4FF", accent: "#1956F0",  accentLt: "#EEF2FF",  heroG1: "#2461FF", heroG2: "#1340D4", heroG3: "#0D2FA8" },
  COMPANY_ADMIN: { pageBg: "#F0FDF4", accent: "#16A34A",  accentLt: "#DCFCE7",  heroG1: "#22C55E", heroG2: "#16A34A", heroG3: "#15803D" },
  AGENT:         { pageBg: "#FFFBEB", accent: "#D97706",  accentLt: "#FEF3C7",  heroG1: "#F59E0B", heroG2: "#D97706", heroG3: "#B45309" },
  USER:          { pageBg: "#F0FDFA", accent: "#0F766E",  accentLt: "#CCFBF1",  heroG1: "#14B8A6", heroG2: "#0F766E", heroG3: "#0D5C56" },
} as const;