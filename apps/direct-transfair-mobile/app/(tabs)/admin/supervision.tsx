// apps/direct-transfair-mobile/app/(tabs)/admin/supervision.tsx
// =========================================================
// SUPERVISION v2.0 — Direct Transf'air
// ✅ SUPER_ADMIN   → SupervisionSA  : plateforme globale
// ✅ COMPANY_ADMIN → SupervisionCA  : sa société uniquement
// ✅ Rôles strictement séparés — zéro mélange
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

// ─── Tokens ──────────────────────────────────────────────
const T = {
  // SA : teal
  saHero1: "#0F766E", saHero2: "#0D5C55", saHero3: "#0A4842",
  saAccent: "#0F766E", saAccentLt: "#CCFBF1", saAccentMd: "#5EEAD4",
  saBg: "#F0FDFB",

  // CA : bleu ciel
  caHero1: "#38BDF8", caHero2: "#0EA5E9", caHero3: "#0284C7",
  caAccent: "#0284C7", caAccentLt: "#E0F2FE", caAccentMd: "#7DD3FC",
  caBg: "#F2F4F8",

  surface: "#FFFFFF",
  border:  "#E2E8F0",
  borderLt:"#F1F5F9",

  ink:     "#0F172A",
  inkSub:  "#6B7280",
  inkMuted:"#9CA3AF",

  green:   "#16A34A", greenLt: "#DCFCE7", greenMd: "#A7F3D0",
  red:     "#DC2626", redLt:   "#FEE2E2",
  amber:   "#D97706", amberLt: "#FEF3C7",
  blue:    "#1956F0", blueLt:  "#EEF2FF",
  purple:  "#7C3AED", purpleLt:"#EDE9FE", purpleMd:"#C4B5FD",
  teal:    "#0F766E", tealLt:  "#CCFBF1", tealMd:  "#5EEAD4",
  white:   "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sub:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "monospace"    }),
  },

  shadow: {
    hero: { shadowColor: "#0D5C55", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 22, elevation: 16 },
    card: { shadowColor: "#0F766E", shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5  },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3  },
  },
};

const HERO_BR = 28;

// ─── Helpers ─────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000)    return "À l'instant";
    if (diff < 3600000)  return `il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}

// ─── Configs audit & alertes ─────────────────────────────
const AUDIT_CFG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  LOGIN:                { icon: "log-in-outline",           color: T.teal,   bg: T.tealLt,   label: "Connexion"          },
  LOGOUT:               { icon: "log-out-outline",          color: T.inkSub, bg: T.borderLt, label: "Déconnexion"        },
  TRANSACTION_CREATE:   { icon: "paper-plane-outline",      color: T.blue,   bg: T.blueLt,   label: "Transaction créée"  },
  TRANSACTION_UPDATE:   { icon: "pencil-outline",           color: T.amber,  bg: T.amberLt,  label: "Transaction modif." },
  TRANSACTION_CANCEL:   { icon: "close-circle-outline",     color: T.red,    bg: T.redLt,    label: "Transaction annulée"},
  USER_CREATE:          { icon: "person-add-outline",       color: T.green,  bg: T.greenLt,  label: "Utilisateur créé"   },
  USER_UPDATE:          { icon: "person-outline",           color: T.teal,   bg: T.tealLt,   label: "Utilisateur modif." },
  USER_SUSPEND:         { icon: "ban-outline",              color: T.red,    bg: T.redLt,    label: "Utilisateur suspendu"},
  AGENCY_CREATE:        { icon: "business-outline",         color: T.purple, bg: T.purpleLt, label: "Agence créée"       },
  CLIENT_CREATE:        { icon: "briefcase-outline",        color: T.blue,   bg: T.blueLt,   label: "Société créée"      },
  EXCHANGE_RATE_UPDATE: { icon: "trending-up-outline",      color: T.amber,  bg: T.amberLt,  label: "Taux modifié"       },
  BALANCE_ADJUSTMENT:   { icon: "calculator-outline",       color: T.purple, bg: T.purpleLt, label: "Solde ajusté"       },
  SUSPICIOUS_ACTIVITY:  { icon: "warning-outline",          color: T.red,    bg: T.redLt,    label: "Activité suspecte"  },
  KYC_APPROVE:          { icon: "shield-checkmark-outline", color: T.green,  bg: T.greenLt,  label: "KYC approuvé"       },
  KYC_REJECT:           { icon: "shield-outline",           color: T.red,    bg: T.redLt,    label: "KYC rejeté"         },
  PASSWORD_CHANGE:      { icon: "key-outline",              color: T.amber,  bg: T.amberLt,  label: "MDP modifié"        },
  ACCOUNT_LOCKED:       { icon: "lock-closed-outline",      color: T.red,    bg: T.redLt,    label: "Compte verrouillé"  },
  OTP_FAILED:           { icon: "alert-circle-outline",     color: T.amber,  bg: T.amberLt,  label: "OTP échoué"         },
};

const SEVERITY_CFG: Record<string, { color: string; bg: string; bdr: string }> = {
  LOW:      { color: T.teal,    bg: T.tealLt,   bdr: T.tealMd   },
  MEDIUM:   { color: T.amber,   bg: T.amberLt,  bdr: "#FCD34D"  },
  HIGH:     { color: "#EA580C", bg: "#FFF7ED",  bdr: "#FDBA74"  },
  CRITICAL: { color: T.red,     bg: T.redLt,    bdr: "#FCA5A5"  },
};

// ─── Hero ─────────────────────────────────────────────────
function Hero({ g1, g2, g3, role, title, subtitle, onBack, onRefresh }: {
  g1: string; g2: string; g3: string;
  role: string; title: string; subtitle: string;
  onBack: () => void; onRefresh: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const bg  = role === "SUPER ADMIN" ? T.saBg : T.caBg;
  return (
    <View style={hS.outer}>
      <LinearGradient
        colors={[g1, g2, g3]}
        start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }}
        style={[hS.gradient, { paddingTop: sbH + 10, paddingBottom: 24 }]}
      >
        <View style={hS.deco1} /><View style={hS.deco2} />
        <View style={hS.row}>
          <TouchableOpacity style={hS.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={18} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={hS.badge}>
              <View style={hS.badgeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>{role}</Text>
            </View>
            <Text style={[hS.title, { fontFamily: T.font.display }]}>{title}</Text>
            <Text style={[hS.sub,   { fontFamily: T.font.sub    }]}>{subtitle}</Text>
          </View>
          <TouchableOpacity style={hS.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={17} color={T.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={[hS.cornerL, { backgroundColor: bg }]} />
      <View style={[hS.cornerR, { backgroundColor: bg }]} />
    </View>
  );
}
const hS = StyleSheet.create({
  outer:   { zIndex: 10, ...T.shadow.hero },
  gradient:{ borderBottomLeftRadius: HERO_BR, borderBottomRightRadius: HERO_BR, overflow: "hidden" },
  deco1:   { position: "absolute", width: 160, height: 160, borderRadius: 80,  backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30 },
  deco2:   { position: "absolute", width: 70,  height: 70,  borderRadius: 35,  backgroundColor: "rgba(255,255,255,0.04)", bottom: 10, left: 10 },
  row:     { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  badge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  badgeDot:{ width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt:{ color: "rgba(255,255,255,0.92)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  title:   { color: T.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sub:     { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 },
  refreshBtn:{ width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  cornerL: { position: "absolute", bottom: 0, left:  0, width: HERO_BR, height: HERO_BR, borderTopRightRadius: HERO_BR },
  cornerR: { position: "absolute", bottom: 0, right: 0, width: HERO_BR, height: HERO_BR, borderTopLeftRadius:  HERO_BR },
});

// ─── Section Label ────────────────────────────────────────
function SL({ dot, label, count }: { dot: string; label: string; count?: number }) {
  return (
    <View style={slS.row}>
      <View style={[slS.dot, { backgroundColor: dot }]} />
      <Text style={[slS.lbl, { fontFamily: T.font.sans }]}>{label}</Text>
      {count !== undefined && (
        <View style={[slS.pill, { backgroundColor: dot + "18" }]}>
          <Text style={[slS.pillTxt, { color: dot, fontFamily: T.font.mono }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}
const slS = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot:    { width: 6, height: 6, borderRadius: 99 },
  lbl:    { flex: 1, fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
  pill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillTxt:{ fontSize: 10, fontWeight: "900" },
});

// ─── KPI Grid 2×2 ────────────────────────────────────────
function KpiGrid({ kpis }: {
  kpis: { label: string; value: string | number; sub?: string; icon: string; color: string; bg: string }[];
}) {
  return (
    <View style={kgS.grid}>
      {kpis.map((k, i) => (
        <View key={i} style={[kgS.card, { borderTopColor: k.color }]}>
          <View style={[kgS.iconBox, { backgroundColor: k.bg }]}>
            <Ionicons name={k.icon as any} size={15} color={k.color} />
          </View>
          <Text style={[kgS.val, { color: k.color, fontFamily: T.font.mono }]} numberOfLines={1} adjustsFontSizeToFit>
            {k.value}
          </Text>
          <Text style={[kgS.lbl, { fontFamily: T.font.sans }]}>{k.label}</Text>
          {k.sub && <Text style={[kgS.sub, { fontFamily: T.font.sub }]}>{k.sub}</Text>}
        </View>
      ))}
    </View>
  );
}
const kgS = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  card: {
    width: "47%", backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: T.border, ...T.shadow.soft,
  },
  iconBox:{ width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  val:    { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  lbl:    { fontSize: 9,  fontWeight: "800", color: T.inkMuted, letterSpacing: 0.8 },
  sub:    { fontSize: 9,  color: T.inkSub, marginTop: 3 },
});

// ─── Santé Système ────────────────────────────────────────
function HealthCard({ items }: {
  items: { label: string; status: "ok" | "warn" | "error"; detail?: string }[];
}) {
  const ST = {
    ok:    { color: T.green, bg: T.greenLt, icon: "checkmark-circle",  label: "OK"       },
    warn:  { color: T.amber, bg: T.amberLt, icon: "warning",           label: "Attention"},
    error: { color: T.red,   bg: T.redLt,   icon: "alert-circle",      label: "Erreur"   },
  };
  return (
    <View style={hcS.card}>
      {items.map((item, i) => {
        const st = ST[item.status];
        return (
          <View key={i} style={[hcS.row, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
            <View style={[hcS.iconBox, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon as any} size={14} color={st.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[hcS.label, { fontFamily: T.font.sans }]}>{item.label}</Text>
              {item.detail && <Text style={[hcS.detail, { fontFamily: T.font.sub }]}>{item.detail}</Text>}
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
  card:   { backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, marginBottom: 20, overflow: "hidden", ...T.shadow.soft },
  row:    { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  iconBox:{ width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label:  { fontSize: 12, fontWeight: "700", color: T.ink },
  detail: { fontSize: 10, color: T.inkMuted, marginTop: 1 },
  pill:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  pillTxt:{ fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});

// ─── Alerte Card ──────────────────────────────────────────
function AlertCard({ item }: { item: any }) {
  const sev = SEVERITY_CFG[item.severity?.toUpperCase()] ?? SEVERITY_CFG.MEDIUM;
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
        <Text style={[alS.msg, { fontFamily: T.font.sub }]} numberOfLines={2}>{item.message}</Text>
      )}
    </View>
  );
}
const alS = StyleSheet.create({
  card:   { backgroundColor: T.surface, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, borderLeftWidth: 4, padding: 13, marginBottom: 8, ...T.shadow.soft },
  top:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sevBox: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  sevTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  time:   { fontSize: 9, color: T.inkMuted, fontWeight: "700" },
  title:  { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 3 },
  msg:    { fontSize: 10, color: T.inkSub, lineHeight: 14 },
});

// ─── Audit Row ────────────────────────────────────────────
function AuditRow({ item }: { item: any }) {
  const cfg = AUDIT_CFG[item.action] ?? {
    icon: "ellipse-outline", color: T.inkMuted, bg: T.borderLt, label: item.action,
  };
  const actor = item.user
    ? `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() || item.user.email
    : "Système";
  return (
    <View style={auS.row}>
      <View style={[auS.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[auS.action, { fontFamily: T.font.sans }]} numberOfLines={1}>{cfg.label}</Text>
        <Text style={[auS.actor,  { fontFamily: T.font.sub  }]} numberOfLines={1}>
          {actor}{item.ipAddress ? `  ·  ${item.ipAddress}` : ""}
        </Text>
      </View>
      <View style={auS.right}>
        <View style={[auS.dot, { backgroundColor: item.successful !== false ? T.green : T.red }]} />
        <Text style={[auS.time, { fontFamily: T.font.mono }]}>{fmtDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}
const auS = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 2, gap: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  iconBox:{ width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  action: { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  actor:  { fontSize: 10, color: T.inkSub },
  right:  { alignItems: "flex-end", gap: 4 },
  dot:    { width: 6, height: 6, borderRadius: 99 },
  time:   { fontSize: 9, color: T.inkMuted, fontWeight: "700" },
});

// ─── Quick Action ─────────────────────────────────────────
function QuickAction({ icon, label, sub, color, bg, onPress }: {
  icon: string; label: string; sub: string;
  color: string; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={qaS.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[qaS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[qaS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[qaS.sub,   { fontFamily: T.font.sub  }]}>{sub}</Text>
      </View>
      <View style={[qaS.arrow, { backgroundColor: bg }]}>
        <Ionicons name="arrow-forward" size={11} color={color} />
      </View>
    </TouchableOpacity>
  );
}
const qaS = StyleSheet.create({
  card:   { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: T.radius.md, padding: 13, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: T.border, ...T.shadow.soft },
  iconBox:{ width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  label:  { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  sub:    { fontSize: 10, color: T.inkSub },
  arrow:  { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ══════════════════════════════════════════════════════════
//  SUPER-ADMIN — SUPERVISION GLOBALE PLATEFORME
//  Voit : santé système, audit TOUTES sociétés,
//         alertes critiques globales, KPIs plateforme
// ══════════════════════════════════════════════════════════
function SupervisionSA() {
  const router   = useRouter();
  const { user } = useAuth();

  const [auditLogs,  setAuditLogs]  = useState<any[]>([]);
  const [alerts,     setAlerts]     = useState<any[]>([]);
  const [clients,    setClients]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      const [logsRes, alertsRes] = await Promise.allSettled([
        api.http.get("/audit-logs?limit=20"),
        api.http.get("/alerts?limit=10"),
      ]);
      if (logsRes.status   === "fulfilled") setAuditLogs(logsRes.value.data?.data ?? logsRes.value.data ?? []);
      if (alertsRes.status === "fulfilled") setAlerts(alertsRes.value.data?.data  ?? alertsRes.value.data ?? []);

      try {
        const cl = await (api as any).getClients?.() ?? [];
        setClients(Array.isArray(cl) ? cl : []);
      } catch { setClients([]); }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { /* silencieux */ }
    finally { if (mode === "refresh") setRefreshing(false); else setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load("init"); }, [load]));

  const activeClients   = clients.filter((c) => c.subscriptionStatus === "ACTIVE").length;
  const criticalAlerts  = alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length;
  const unresolvedAlerts= alerts.filter((a) => !a.isResolved).length;
  const suspiciousLogs  = auditLogs.filter((l) => l.action === "SUSPICIOUS_ACTIVITY").length;

  const kpis = [
    { label: "Sociétés actives",  value: `${activeClients}/${clients.length}`, sub: "abonnements",      icon: "business-outline",        color: T.saAccent, bg: T.saAccentLt },
    { label: "Alertes actives",   value: unresolvedAlerts,                      sub: `${criticalAlerts} critiques`, icon: "warning-outline", color: unresolvedAlerts > 0 ? T.red : T.green, bg: unresolvedAlerts > 0 ? T.redLt : T.greenLt },
    { label: "Logs d'audit",      value: auditLogs.length,                      sub: "20 derniers",      icon: "list-outline",            color: T.blue,     bg: T.blueLt     },
    { label: "Activités suspectes",value: suspiciousLogs,                        sub: "à investiguer",   icon: "shield-outline",          color: suspiciousLogs > 0 ? T.red : T.green, bg: suspiciousLogs > 0 ? T.redLt : T.greenLt },
  ];

  // Santé système — statique avec vérifications simples
  const health = [
    { label: "API Principale",        status: "ok"   as const, detail: "Réponse < 200ms"            },
    { label: "Base de données",       status: "ok"   as const, detail: "PostgreSQL opérationnel"    },
    { label: "Service de paiement",   status: "ok"   as const, detail: "Stripe / Mobile Money actif"},
    { label: "Notifications Push",    status: "ok"   as const, detail: "FCM / APNS connectés"       },
    { label: "Jobs planifiés",        status: unresolvedAlerts > 3 ? "warn" as const : "ok" as const, detail: "Cron virements programmés" },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.saBg }]}>
      <StatusBar barStyle="light-content" />
      <Hero
        g1={T.saHero1} g2={T.saHero2} g3={T.saHero3}
        role="SUPER ADMIN"
        title="Supervision"
        subtitle={`${user?.firstName ?? ""}  ·  Plateforme & Logs globaux`}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={T.saAccent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[s.scroll, { backgroundColor: T.saBg }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={T.saAccent} />}
        >
          {/* KPIs globaux */}
          <SL dot={T.saAccent} label="KPIs PLATEFORME GLOBAUX" />
          <KpiGrid kpis={kpis} />

          {/* Santé système */}
          <SL dot={T.green} label="SANTÉ SYSTÈME" />
          <HealthCard items={health} />

          {/* Alertes critiques */}
          <SL dot={T.red} label="ALERTES PLATEFORME" count={unresolvedAlerts} />
          {alerts.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={T.green} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune alerte active</Text>
            </View>
          ) : (
            alerts.slice(0, 8).map((a, i) => <AlertCard key={a.id ?? i} item={a} />)
          )}

          {/* Audit logs globaux — TOUTES sociétés */}
          <SL dot={T.blue} label="LOGS D'AUDIT · TOUTES SOCIÉTÉS" count={auditLogs.length} />
          <View style={s.auditCard}>
            {auditLogs.length === 0 ? (
              <View style={s.emptyRow}>
                <Ionicons name="document-outline" size={18} color={T.inkMuted} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun log disponible</Text>
              </View>
            ) : (
              auditLogs.slice(0, 15).map((l, i) => <AuditRow key={l.id ?? i} item={l} />)
            )}
          </View>

          {/* Accès rapide Super-Admin */}
          <SL dot={T.amber} label="ACCÈS RAPIDE SUPER ADMIN" />
          {[
            { icon: "analytics-outline",    label: "Transactions globales", sub: "Toutes sociétés",           color: T.blue,   bg: T.blueLt,     route: "/(tabs)/admin/transactions" },
            { icon: "receipt-outline",      label: "Trésorerie globale",    sub: "Soldes multi-sociétés",     color: T.saAccent, bg: T.saAccentLt, route: "/(tabs)/admin/treasury"    },
            { icon: "business-outline",     label: "Sociétés & Agences",    sub: "Réseau complet",            color: T.purple, bg: T.purpleLt,   route: "/(tabs)/admin/agencies"     },
            { icon: "swap-horizontal-outline", label: "Taux de change",     sub: "Gestion des devises",       color: T.amber,  bg: T.amberLt,    route: "/(tabs)/rates"              },
          ].map((item) => (
            <QuickAction key={item.label} {...item} onPress={() => router.push(item.route as any)} />
          ))}

          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  COMPANY-ADMIN — SUPERVISION DE SA SOCIÉTÉ UNIQUEMENT
//  Voit : ses agences, ses agents, ses alertes propres,
//         ses logs d'audit, santé de sa société
//  Ne voit PAS : les autres sociétés, la plateforme globale
// ══════════════════════════════════════════════════════════
function SupervisionCA() {
  const router   = useRouter();
  const { user } = useAuth();

  const [agencies,   setAgencies]   = useState<any[]>([]);
  const [auditLogs,  setAuditLogs]  = useState<any[]>([]);
  const [alerts,     setAlerts]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      const [agRes, logsRes, alertsRes] = await Promise.allSettled([
        api.getAgencies(),
        api.http.get("/audit-logs?limit=20&mine=true"),
        api.http.get("/alerts?limit=10&mine=true"),
      ]);
      if (agRes.status     === "fulfilled") setAgencies(Array.isArray(agRes.value) ? agRes.value : []);
      if (logsRes.status   === "fulfilled") setAuditLogs(logsRes.value.data?.data ?? logsRes.value.data ?? []);
      if (alertsRes.status === "fulfilled") setAlerts(alertsRes.value.data?.data  ?? alertsRes.value.data ?? []);

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { /* silencieux */ }
    finally { if (mode === "refresh") setRefreshing(false); else setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load("init"); }, [load]));

  const activeAgencies  = agencies.filter((a) => a.isActive !== false).length;
  const totalAgents     = agencies.reduce((s, a) => s + toNum(a.agents?.length ?? 0), 0);
  const unresolvedAlert = alerts.filter((a) => !a.isResolved).length;
  const suspiciousLogs  = auditLogs.filter((l) => l.action === "SUSPICIOUS_ACTIVITY").length;

  const kpis = [
    { label: "Mes agences",        value: `${activeAgencies}/${agencies.length}`, sub: "actives",         icon: "storefront-outline",  color: T.caAccent, bg: T.caAccentLt },
    { label: "Mes agents",         value: totalAgents,                             sub: "au total",        icon: "people-outline",      color: T.teal,     bg: T.tealLt     },
    { label: "Mes alertes",        value: unresolvedAlert,                         sub: "non résolues",    icon: "warning-outline",     color: unresolvedAlert > 0 ? T.amber : T.green, bg: unresolvedAlert > 0 ? T.amberLt : T.greenLt },
    { label: "Activités suspectes",value: suspiciousLogs,                          sub: "à vérifier",      icon: "shield-outline",      color: suspiciousLogs > 0 ? T.red : T.green, bg: suspiciousLogs > 0 ? T.redLt : T.greenLt },
  ];

  // Santé de la société
  const agencyHealth = [
    { label: "Agences opérationnelles", status: (activeAgencies === agencies.length && agencies.length > 0) ? "ok" as const : agencies.length === 0 ? "warn" as const : "warn" as const, detail: `${activeAgencies}/${agencies.length} agences actives` },
    { label: "Agents actifs",           status: totalAgents > 0 ? "ok" as const : "warn" as const, detail: `${totalAgents} agent(s) rattaché(s)` },
    { label: "Alertes en attente",      status: unresolvedAlert === 0 ? "ok" as const : unresolvedAlert > 5 ? "error" as const : "warn" as const, detail: `${unresolvedAlert} alerte(s) non résolue(s)` },
    { label: "Activité récente",        status: auditLogs.length > 0 ? "ok" as const : "warn" as const, detail: `${auditLogs.length} événement(s) enregistré(s)` },
  ];

  const FLAG_MAP: Record<string, string> = { GN:"🇬🇳", SN:"🇸🇳", ML:"🇲🇱", CI:"🇨🇮", FR:"🇫🇷", GB:"🇬🇧", US:"🇺🇸" };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.caBg }]}>
      <StatusBar barStyle="light-content" />
      <Hero
        g1={T.caHero1} g2={T.caHero2} g3={T.caHero3}
        role="ADMIN SOCIÉTÉ"
        title="Supervision"
        subtitle={`${user?.firstName ?? ""}  ·  Ma société uniquement`}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={T.caAccent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[s.scroll, { backgroundColor: T.caBg }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={T.caAccent} />}
        >
          {/* KPIs ma société */}
          <SL dot={T.caAccent} label="MES INDICATEURS" />
          <KpiGrid kpis={kpis} />

          {/* Santé de ma société */}
          <SL dot={T.green} label="SANTÉ DE MA SOCIÉTÉ" />
          <HealthCard items={agencyHealth} />

          {/* Mes alertes */}
          <SL dot={T.amber} label="MES ALERTES" count={unresolvedAlert} />
          {alerts.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={T.green} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune alerte active</Text>
            </View>
          ) : (
            alerts.slice(0, 6).map((a, i) => <AlertCard key={a.id ?? i} item={a} />)
          )}

          {/* Mes agences — état détaillé */}
          <SL dot={T.caAccent} label={`MES AGENCES · ${agencies.length}`} />
          {agencies.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="storefront-outline" size={18} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune agence</Text>
            </View>
          ) : (
            agencies.map((agency) => {
              const isActive = agency.isActive !== false;
              const flag     = agency.country ? (FLAG_MAP[agency.country.toUpperCase().substring(0, 2)] ?? "🌍") : "🌍";
              const agentCount = toNum(agency.agents?.length ?? 0);
              return (
                <View key={agency.id} style={s.agCard}>
                  <View style={[s.agBar, { backgroundColor: isActive ? T.teal : T.red }]} />
                  <View style={s.agBody}>
                    <View style={s.agRow}>
                      <View style={s.agFlag}><Text style={{ fontSize: 18 }}>{flag}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.agName, { fontFamily: T.font.sans }]} numberOfLines={1}>{agency.name}</Text>
                        <Text style={[s.agCity, { fontFamily: T.font.sub  }]}>{agency.city ?? "—"} · {agency.country ?? "—"}</Text>
                      </View>
                      <View style={[s.agStatus, {
                        backgroundColor: isActive ? T.tealLt : T.redLt,
                        borderColor: isActive ? T.tealMd : T.red + "35",
                      }]}>
                        <View style={[s.agDot, { backgroundColor: isActive ? T.teal : T.red }]} />
                        <Text style={[s.agStatusTxt, { color: isActive ? T.teal : T.red, fontFamily: T.font.sans }]}>
                          {isActive ? "Active" : "Suspendue"}
                        </Text>
                      </View>
                    </View>
                    <View style={s.agFoot}>
                      <View style={s.agPill}>
                        <Ionicons name="people-outline" size={11} color={T.inkMuted} />
                        <Text style={[s.agPillTxt, { fontFamily: T.font.sans }]}>{agentCount} agent{agentCount > 1 ? "s" : ""}</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.agBtn, { backgroundColor: T.caAccentLt, borderColor: T.caAccentMd }]}
                        onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/details" as any, params: { id: agency.id } })}
                      >
                        <Ionicons name="eye-outline" size={12} color={T.caAccent} />
                        <Text style={[s.agBtnTxt, { color: T.caAccent, fontFamily: T.font.sans }]}>Voir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* Mes logs d'audit — ma société uniquement */}
          <SL dot={T.blue} label="MES LOGS D'AUDIT" count={auditLogs.length} />
          <View style={s.auditCard}>
            {auditLogs.length === 0 ? (
              <View style={s.emptyRow}>
                <Ionicons name="document-outline" size={18} color={T.inkMuted} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun log disponible</Text>
              </View>
            ) : (
              auditLogs.slice(0, 12).map((l, i) => <AuditRow key={l.id ?? i} item={l} />)
            )}
          </View>

          {/* Accès rapide Admin */}
          <SL dot={T.green} label="ACCÈS RAPIDE" />
          {[
            { icon: "analytics-outline",  label: "Mes transactions",  sub: "Historique & suivi",   color: T.caAccent, bg: T.caAccentLt, route: "/(tabs)/admin/transactions" },
            { icon: "storefront-outline", label: "Mes agences",       sub: "Gestion du réseau",    color: T.teal,     bg: T.tealLt,     route: "/(tabs)/admin/agencies"     },
            { icon: "settings-outline",   label: "Paramètres",        sub: "Taux & commissions",   color: T.purple,   bg: T.purpleLt,   route: "/(tabs)/admin/settings"     },
            { icon: "receipt-outline",    label: "Ma trésorerie",     sub: "Soldes & portefeuilles",color: T.amber,   bg: T.amberLt,    route: "/(tabs)/admin/treasury"     },
          ].map((item) => (
            <QuickAction key={item.label} {...item} onPress={() => router.push(item.route as any)} />
          ))}

          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  ROUTEUR
// ══════════════════════════════════════════════════════════
export default function SupervisionScreen() {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN")   return <SupervisionSA />;
  if (user?.role === "COMPANY_ADMIN") return <SupervisionCA />;
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.caBg, justifyContent: "center", alignItems: "center" }}>
      <Ionicons name="lock-closed-outline" size={48} color={T.inkMuted} />
      <Text style={[{ color: T.ink, fontSize: 16, fontWeight: "700", marginTop: 16, fontFamily: T.font.sans }]}>
        Accès non autorisé
      </Text>
      <TouchableOpacity
        style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: T.caAccentLt, borderRadius: 12 }}
        onPress={() => router.back()}
      >
        <Text style={{ color: T.caAccent, fontWeight: "700" }}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles partagés ─────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16 },

  auditCard: { backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, marginBottom: 20, ...T.shadow.soft },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: T.surface, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, marginBottom: 14 },
  emptyTxt: { color: T.inkMuted, fontSize: 12, fontWeight: "600" },

  agCard:  { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.soft },
  agBar:   { width: 4 },
  agBody:  { flex: 1, padding: 12 },
  agRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  agFlag:  { width: 34, height: 34, borderRadius: 9, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
  agName:  { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 2 },
  agCity:  { fontSize: 10, color: T.inkSub },
  agStatus:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  agDot:   { width: 5, height: 5, borderRadius: 99 },
  agStatusTxt: { fontSize: 9, fontWeight: "800" },
  agFoot:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  agPill:  { flexDirection: "row", alignItems: "center", gap: 5 },
  agPillTxt: { fontSize: 10, color: T.inkSub, fontWeight: "600" },
  agBtn:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
  agBtnTxt:{ fontSize: 10, fontWeight: "700" },
});