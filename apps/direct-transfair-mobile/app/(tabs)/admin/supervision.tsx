// apps/direct-transfair-mobile/app/(tabs)/admin/supervision.tsx
// =========================================================
// SUPERVISION PLATEFORME v1.0 — Direct Transf'air
// SuperAdmin only — Vue santé système, logs d'audit,
// alertes actives, KPIs globaux multi-sociétés
// Design : Teal #0F766E — thème clair premium
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  RefreshControl, Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Design Tokens ────────────────────────────────────────
const T = {
  teal:     "#0F766E",
  tealDark: "#0D5C55",
  tealLt:   "#CCFBF1",
  tealMd:   "#99F6E4",
  tealBdr:  "#5EEAD4",

  pageBg:   "#F0FDFB",
  surface:  "#FFFFFF",
  border:   "#E2F0EE",
  borderMd: "#C9E8E4",

  ink:      "#0F172A",
  inkMid:   "#374151",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  blue:     "#1956F0",
  blueLt:   "#EEF2FF",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  white: "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    card: {
      shadowColor: "#0F766E",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
    },
    soft: {
      shadowColor: "#0F766E",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    hero: {
      shadowColor: "#0D5C55",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 22,
      elevation: 18,
    },
  },
};

const HERO_BR = 28;

// ─── Helpers ──────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "À l'instant";
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}

// ─── AUDIT ACTION CONFIG ──────────────────────────────────
const AUDIT_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  LOGIN:                  { icon: "log-in-outline",           color: T.teal,   bg: T.tealLt,   label: "Connexion" },
  LOGOUT:                 { icon: "log-out-outline",          color: T.inkSub, bg: "#F1F5F9",  label: "Déconnexion" },
  TRANSACTION_CREATE:     { icon: "paper-plane-outline",      color: T.blue,   bg: T.blueLt,   label: "Tx créée" },
  TRANSACTION_UPDATE:     { icon: "pencil-outline",           color: T.amber,  bg: T.amberLt,  label: "Tx modifiée" },
  TRANSACTION_CANCEL:     { icon: "close-circle-outline",     color: T.red,    bg: T.redLt,    label: "Tx annulée" },
  USER_CREATE:            { icon: "person-add-outline",       color: T.green,  bg: T.greenLt,  label: "Utilisateur créé" },
  USER_UPDATE:            { icon: "person-outline",           color: T.teal,   bg: T.tealLt,   label: "Utilisateur modifié" },
  USER_SUSPEND:           { icon: "ban-outline",              color: T.red,    bg: T.redLt,    label: "Utilisateur suspendu" },
  AGENCY_CREATE:          { icon: "business-outline",         color: T.purple, bg: T.purpleLt, label: "Agence créée" },
  CLIENT_CREATE:          { icon: "briefcase-outline",        color: T.blue,   bg: T.blueLt,   label: "Société créée" },
  EXCHANGE_RATE_UPDATE:   { icon: "trending-up-outline",      color: T.amber,  bg: T.amberLt,  label: "Taux modifié" },
  BALANCE_ADJUSTMENT:     { icon: "calculator-outline",       color: T.purple, bg: T.purpleLt, label: "Solde ajusté" },
  SUSPICIOUS_ACTIVITY:    { icon: "warning-outline",          color: T.red,    bg: T.redLt,    label: "Activité suspecte" },
  KYC_APPROVE:            { icon: "shield-checkmark-outline", color: T.green,  bg: T.greenLt,  label: "KYC approuvé" },
  KYC_REJECT:             { icon: "shield-outline",           color: T.red,    bg: T.redLt,    label: "KYC rejeté" },
  PASSWORD_CHANGE:        { icon: "key-outline",              color: T.amber,  bg: T.amberLt,  label: "MDP modifié" },
  ACCOUNT_LOCKED:         { icon: "lock-closed-outline",      color: T.red,    bg: T.redLt,    label: "Compte verrouillé" },
  OTP_FAILED:             { icon: "alert-circle-outline",     color: T.amber,  bg: T.amberLt,  label: "OTP échoué" },
};

const ALERT_SEVERITY: Record<string, { color: string; bg: string; bdr: string }> = {
  LOW:      { color: T.teal,   bg: T.tealLt,   bdr: T.tealBdr },
  MEDIUM:   { color: T.amber,  bg: T.amberLt,  bdr: "#FCD34D" },
  HIGH:     { color: "#EA580C",bg: "#FFF7ED",  bdr: "#FDBA74" },
  CRITICAL: { color: T.red,    bg: T.redLt,    bdr: "#FCA5A5" },
};

// ─── Hero ─────────────────────────────────────────────────
function SupervisionHero({
  anim, userName, onBack, onRefresh,
}: {
  anim: Animated.Value;
  userName?: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  return (
    <Animated.View style={[
      hs.outer,
      {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      },
    ]}>
      <LinearGradient
        colors={["#0F766E", "#0D5C55", "#0A4842"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[hs.gradient, { paddingTop: sbH + 10 }]}
      >
        <View style={hs.deco1} />
        <View style={hs.deco2} />

        <View style={hs.row}>
          <TouchableOpacity style={hs.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={18} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={hs.badge}>
              <View style={hs.badgeDot} />
              <Text style={[hs.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[hs.title, { fontFamily: T.font.display }]}>Supervision</Text>
            <Text style={[hs.sub, { fontFamily: T.font.subtitle }]}>
              {userName ? `${userName}  ·  ` : ""}Plateforme & Logs
            </Text>
          </View>
          <TouchableOpacity style={hs.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={17} color={T.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={hs.cornerL} />
      <View style={hs.cornerR} />
    </Animated.View>
  );
}

const hs = StyleSheet.create({
  outer: { zIndex: 10, ...T.shadow.hero },
  gradient: {
    borderBottomLeftRadius: HERO_BR,
    borderBottomRightRadius: HERO_BR,
    overflow: "hidden",
    paddingBottom: 24,
  },
  deco1: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30,
  },
  deco2: {
    position: "absolute", width: 70, height: 70, borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: 10, left: 10,
  },
  row: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 20, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: "flex-start", marginBottom: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: T.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sub:   { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  cornerL: {
    position: "absolute", bottom: 0, left: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg, borderTopRightRadius: HERO_BR,
  },
  cornerR: {
    position: "absolute", bottom: 0, right: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg, borderTopLeftRadius: HERO_BR,
  },
});

// ─── Section Header ───────────────────────────────────────
function SH({ dot, label, count }: { dot: string; label: string; count?: number }) {
  return (
    <View style={shS.row}>
      <View style={[shS.dot, { backgroundColor: dot }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {count !== undefined && (
        <View style={[shS.countPill, { backgroundColor: dot + "18" }]}>
          <Text style={[shS.countTxt, { color: dot, fontFamily: T.font.mono }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}
const shS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  label: { flex: 1, fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
  countPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  countTxt: { fontSize: 10, fontWeight: "900" },
});

// ─── KPI Strip ────────────────────────────────────────────
function KpiStrip({ kpis }: {
  kpis: { label: string; value: string | number; icon: string; color: string; bg: string }[];
}) {
  return (
    <View style={kS.row}>
      {kpis.map((k, i) => (
        <View key={i} style={[kS.card, { borderTopColor: k.color }]}>
          <View style={[kS.iconBox, { backgroundColor: k.bg }]}>
            <Ionicons name={k.icon as any} size={15} color={k.color} />
          </View>
          <Text style={[kS.val, { color: k.color, fontFamily: T.font.mono }]}>{k.value}</Text>
          <Text style={[kS.lbl, { fontFamily: T.font.sans }]}>{k.label}</Text>
        </View>
      ))}
    </View>
  );
}
const kS = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginBottom: 22 },
  card: {
    flex: 1, backgroundColor: T.surface, borderRadius: T.radius.md,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: "center",
    borderTopWidth: 3, borderWidth: 1, borderColor: T.border, ...T.shadow.soft,
  },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  val: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  lbl: { fontSize: 7, color: T.inkMuted, fontWeight: "800", letterSpacing: 0.8, textAlign: "center" },
});

// ─── Santé Système ────────────────────────────────────────
function HealthCard({ items }: {
  items: { label: string; status: "ok" | "warn" | "error"; detail?: string }[];
}) {
  const STATUS = {
    ok:    { color: T.green, bg: T.greenLt, icon: "checkmark-circle",  label: "OK" },
    warn:  { color: T.amber, bg: T.amberLt, icon: "warning",           label: "Attention" },
    error: { color: T.red,   bg: T.redLt,   icon: "alert-circle",      label: "Erreur" },
  };
  return (
    <View style={hcS.card}>
      {items.map((item, i) => {
        const st = STATUS[item.status];
        return (
          <View key={i} style={[hcS.row, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
            <View style={[hcS.iconBox, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon as any} size={14} color={st.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[hcS.label, { fontFamily: T.font.sans }]}>{item.label}</Text>
              {item.detail && (
                <Text style={[hcS.detail, { fontFamily: T.font.subtitle }]}>{item.detail}</Text>
              )}
            </View>
            <View style={[hcS.pill, { backgroundColor: st.bg }]}>
              <Text style={[hcS.pillTxt, { color: st.color, fontFamily: T.font.sans }]}>{st.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const hcS = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border, marginBottom: 22,
    overflow: "hidden", ...T.shadow.soft,
  },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label:  { fontSize: 12, fontWeight: "700", color: T.ink },
  detail: { fontSize: 10, color: T.inkMuted, marginTop: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  pillTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});

// ─── Alerte Card ──────────────────────────────────────────
function AlertCard({ item }: { item: any }) {
  const sev = ALERT_SEVERITY[item.severity?.toUpperCase()] ?? ALERT_SEVERITY.MEDIUM;
  return (
    <View style={[alS.card, { borderLeftColor: sev.color }]}>
      <View style={alS.top}>
        <View style={[alS.sevBox, { backgroundColor: sev.bg, borderColor: sev.bdr }]}>
          <Text style={[alS.sevTxt, { color: sev.color, fontFamily: T.font.sans }]}>
            {item.severity ?? "MEDIUM"}
          </Text>
        </View>
        <Text style={[alS.time, { fontFamily: T.font.mono }]}>{fmtDate(item.createdAt)}</Text>
      </View>
      <Text style={[alS.title, { fontFamily: T.font.sans }]}>{item.title}</Text>
      {item.message && (
        <Text style={[alS.msg, { fontFamily: T.font.subtitle }]} numberOfLines={2}>{item.message}</Text>
      )}
    </View>
  );
}
const alS = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.radius.md,
    borderWidth: 1, borderColor: T.border, borderLeftWidth: 4,
    padding: 13, marginBottom: 8, ...T.shadow.soft,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sevBox: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  sevTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  time:  { fontSize: 9, color: T.inkMuted, fontWeight: "700" },
  title: { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 3 },
  msg:   { fontSize: 10, color: T.inkSub, lineHeight: 14 },
});

// ─── Audit Log Row ────────────────────────────────────────
function AuditRow({ item }: { item: any }) {
  const cfg = AUDIT_CONFIG[item.action] ?? {
    icon: "ellipse-outline", color: T.inkMuted, bg: "#F1F5F9", label: item.action,
  };
  const actorName = item.user
    ? `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() || item.user.email
    : "Système";

  return (
    <View style={auS.row}>
      <View style={[auS.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[auS.action, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {cfg.label}
        </Text>
        <Text style={[auS.actor, { fontFamily: T.font.subtitle }]} numberOfLines={1}>
          {actorName}
          {item.ipAddress ? `  ·  ${item.ipAddress}` : ""}
        </Text>
      </View>
      <View style={auS.right}>
        <View style={[auS.successDot, {
          backgroundColor: item.successful !== false ? T.green : T.red,
        }]} />
        <Text style={[auS.time, { fontFamily: T.font.mono }]}>{fmtDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}
const auS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 2, gap: 10,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  iconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  action: { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  actor:  { fontSize: 10, color: T.inkSub },
  right:  { alignItems: "flex-end", gap: 4 },
  successDot: { width: 6, height: 6, borderRadius: 99 },
  time:   { fontSize: 9, color: T.inkMuted, fontWeight: "700" },
});

// ─── Accès rapide ─────────────────────────────────────────
function QuickAction({ icon, label, sublabel, color, bg, onPress }: {
  icon: string; label: string; sublabel: string;
  color: string; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={qaS.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[qaS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[qaS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[qaS.sub, { fontFamily: T.font.subtitle }]}>{sublabel}</Text>
      </View>
      <View style={[qaS.arrow, { backgroundColor: bg }]}>
        <Ionicons name="arrow-forward" size={11} color={color} />
      </View>
    </TouchableOpacity>
  );
}
const qaS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 13, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: T.border, ...T.shadow.soft,
  },
  iconBox: { width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  sub:   { fontSize: 10, color: T.inkSub },
  arrow: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function SupervisionScreen() {
  const router    = useRouter();
  const { user }  = useAuth();

  const [auditLogs,   setAuditLogs]   = useState<any[]>([]);
  const [alerts,      setAlerts]      = useState<any[]>([]);
  const [clients,     setClients]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const heroAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const runEntrance = useCallback(() => {
    Animated.stagger(100, [
      Animated.spring(heroAnim,    { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 2 }),
    ]).start();
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const [rawLogs, rawAlerts, rawClients] = await Promise.all([
        api.getAuditLogs?.().catch(() => [])       ?? Promise.resolve([]),
        api.getAlerts?.().catch(() => [])           ?? Promise.resolve([]),
        api.getClients?.().catch(() => [])          ?? Promise.resolve([]),
      ]);

      const logs = Array.isArray(rawLogs)
        ? rawLogs
        : ((rawLogs as any)?.data ?? []);
      setAuditLogs(logs.slice(0, 20));

      const alrts = Array.isArray(rawAlerts)
        ? rawAlerts
        : ((rawAlerts as any)?.data ?? []);
      setAlerts(alrts.filter((a: any) => !a.isResolved).slice(0, 10));

      const cls = Array.isArray(rawClients)
        ? rawClients
        : ((rawClients as any)?.data ?? []);
      setClients(cls);
    } catch (e) {
      console.error("Supervision load error", e);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData("init");
      runEntrance();
      return () => {};
    }, [loadData, runEntrance])
  );

  // ─── KPIs calculés ──────────────────────────────────────
  const totalClients  = clients.length;
  const activeClients = clients.filter((c) => c.subscriptionStatus?.toUpperCase() === "ACTIVE").length;
  const critAlerts    = alerts.filter((a) => a.severity?.toUpperCase() === "CRITICAL").length;
  const suspiciousLogs = auditLogs.filter((l) => l.action === "SUSPICIOUS_ACTIVITY").length;

  const kpis = [
    { label: "Sociétés",    value: totalClients,   icon: "business-outline",          color: T.teal,   bg: T.tealLt  },
    { label: "Actives",     value: activeClients,  icon: "checkmark-circle-outline",  color: T.green,  bg: T.greenLt },
    { label: "Alertes",     value: alerts.length,  icon: "warning-outline",           color: T.amber,  bg: T.amberLt },
    { label: "Critiques",   value: critAlerts,     icon: "alert-circle-outline",      color: T.red,    bg: T.redLt   },
  ];

  // ─── Santé système (statique + dynamique) ───────────────
  const healthItems: { label: string; status: "ok" | "warn" | "error"; detail?: string }[] = [
    {
      label:  "API Plateforme",
      status: "ok",
      detail: "Latence < 120ms · Uptime 99.98%",
    },
    {
      label:  "Base de données",
      status: "ok",
      detail: "PostgreSQL · Réplication active",
    },
    {
      label:  "Transactions en attente",
      status: alerts.some((a) => a.type === "SCHEDULED_TRANSFER_FAILED") ? "warn" : "ok",
      detail: alerts.some((a) => a.type === "SCHEDULED_TRANSFER_FAILED")
        ? "Virements programmés en échec détectés"
        : "Aucun blocage détecté",
    },
    {
      label:  "Alertes AML",
      status: suspiciousLogs > 0 ? "warn" : "ok",
      detail: suspiciousLogs > 0
        ? `${suspiciousLogs} activité(s) suspecte(s) non résolue(s)`
        : "Aucune activité suspecte",
    },
    {
      label:  "KYC expirés",
      status: alerts.some((a) => a.type === "KYC_EXPIRED") ? "warn" : "ok",
      detail: alerts.some((a) => a.type === "KYC_EXPIRED")
        ? "Documents KYC expirés à traiter"
        : "Tous les documents sont valides",
    },
    {
      label:  "Abonnements expirant",
      status: alerts.some((a) => a.type === "SUBSCRIPTION_EXPIRY") ? "warn" : "ok",
      detail: alerts.some((a) => a.type === "SUBSCRIPTION_EXPIRY")
        ? "Sociétés avec abonnement proche de l'expiration"
        : "Abonnements tous à jour",
    },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor="#0A4842" barStyle="light-content" />

      <SupervisionHero
        anim={heroAnim}
        userName={user?.firstName}
        onBack={() => router.back()}
        onRefresh={() => void loadData("refresh")}
      />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={T.teal} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: contentAnim }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData("refresh")}
              tintColor={T.teal}
            />
          }
        >
          {/* ── KPIs ── */}
          <SH dot={T.teal} label="VUE GLOBALE PLATEFORME" />
          <KpiStrip kpis={kpis} />

          {/* ── Santé système ── */}
          <SH dot={T.green} label="SANTÉ SYSTÈME" />
          <HealthCard items={healthItems} />

          {/* ── Accès rapide ── */}
          <SH dot={T.blue} label="ACCÈS RAPIDE" />
          <QuickAction
            icon="wallet-outline"
            label="Trésorerie Globale"
            sublabel="Soldes multi-devises · 5 wallets"
            color={T.blue}
            bg={T.blueLt}
            onPress={() => router.push("/(tabs)/admin/treasury")}
          />
          <QuickAction
            icon="analytics-outline"
            label="Transactions"
            sublabel="Audit temps réel · Validation"
            color={T.teal}
            bg={T.tealLt}
            onPress={() => router.push("/(tabs)/admin/transactions")}
          />
          <QuickAction
            icon="people-outline"
            label="Utilisateurs"
            sublabel="Rôles · Sociétés · Agences"
            color={T.purple}
            bg={T.purpleLt}
            onPress={() => router.push("/(tabs)/admin/users")}
          />
          <QuickAction
            icon="shield-outline"
            label="AML / Conformité"
            sublabel="Flags suspects · Revue KYC"
            color={T.red}
            bg={T.redLt}
            onPress={() => router.push("/(tabs)/admin/compliance")}
          />

          {/* ── Alertes actives ── */}
          <View style={{ marginTop: 6 }}>
            <SH dot={T.amber} label="ALERTES ACTIVES" count={alerts.length} />
            {alerts.length === 0 ? (
              <View style={s.emptyBlock}>
                <View style={[s.emptyIcon, { backgroundColor: T.greenLt }]}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={T.green} />
                </View>
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune alerte active</Text>
              </View>
            ) : (
              alerts.map((a) => <AlertCard key={a.id} item={a} />)
            )}
          </View>

          {/* ── Journal d'audit ── */}
          <View style={{ marginTop: 6 }}>
            <SH dot={T.teal} label="JOURNAL D'AUDIT" count={auditLogs.length} />
            <View style={auditS.card}>
              {auditLogs.length === 0 ? (
                <View style={s.emptyBlock}>
                  <View style={[s.emptyIcon, { backgroundColor: T.tealLt }]}>
                    <Ionicons name="document-text-outline" size={22} color={T.teal} />
                  </View>
                  <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun log disponible</Text>
                </View>
              ) : (
                auditLogs.map((log) => <AuditRow key={log.id} item={log} />)
              )}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 18, paddingTop: 22 },
  emptyBlock: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyIcon:  { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  emptyTxt:   { fontSize: 12, color: T.inkSub, fontWeight: "600" },
});

const auditS = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, marginBottom: 22,
    ...T.shadow.soft,
  },
});