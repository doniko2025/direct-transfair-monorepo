// apps/direct-transfair-mobile/app/(tabs)/profile/notifications.tsx
// =========================================================
// NOTIFICATIONS v1.0 — Direct Transf'air
// ✅ Préférences de notifications par catégorie et canal
// ✅ Persistance locale AsyncStorage (dt_notif_prefs_v1)
// ✅ Canaux : Push (mobile) + Email
// ✅ Thème par rôle cohérent avec security.tsx
// ✅ Toast animé confirmation sauvegarde
// =========================================================

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Platform, ActivityIndicator, ScrollView, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Thèmes par rôle ─────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { bg: "#FFFBF2", accent: "#B8860B", accentLight: "#FEF3C7" },
  COMPANY_ADMIN: { bg: "#F0FDF8", accent: "#059669", accentLight: "#D1FAE5" },
  AGENT:         { bg: "#FFFBF0", accent: "#D97706", accentLight: "#FEF3C7" },
  USER:          { bg: "#F0FDF4", accent: "#16A34A", accentLight: "#DCFCE7" },
} as const;

const T = {
  white:      "#FFFFFF",
  cardBg:     "#FFFFFF",
  border:     "#E5E8EF",
  borderLt:   "#F1F5F9",
  pageBg:     "#F4F6F9",
  text:       "#111827",
  textSub:    "#6B7280",
  textMuted:  "#9CA3AF",
  green:      "#16A34A",
  greenBg:    "#DCFCE7",
  radius: { md: 12, lg: 16, xl: 20 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

const STORAGE_KEY = "dt_notif_prefs_v1";

// ─── Types ───────────────────────────────────────────────
type NotifCategory = "b2b" | "agencyRefill" | "lowBalance" | "security" | "system";
type NotifChannel  = "push" | "email";

interface NotifPrefs {
  push:  Record<NotifCategory, boolean>;
  email: Record<NotifCategory, boolean>;
}

// ─── Défauts ─────────────────────────────────────────────
const DEFAULT_PREFS: NotifPrefs = {
  push: {
    b2b:          true,
    agencyRefill: true,
    lowBalance:   true,
    security:     true,
    system:       false,
  },
  email: {
    b2b:          true,
    agencyRefill: false,
    lowBalance:   false,
    security:     true,
    system:       false,
  },
};

// ─── Définition des catégories ───────────────────────────
const CATEGORIES: {
  key:     NotifCategory;
  icon:    string;
  label:   string;
  desc:    string;
}[] = [
  {
    key:   "b2b",
    icon:  "swap-horizontal-outline",
    label: "Virements B2B",
    desc:  "Déclarations, validations et rejets de virement",
  },
  {
    key:   "agencyRefill",
    icon:  "storefront-outline",
    label: "Recharges agences",
    desc:  "Transferts de fonds vers vos agences",
  },
  {
    key:   "lowBalance",
    icon:  "alert-circle-outline",
    label: "Alerte solde faible",
    desc:  "Quand le solde d'une agence est bas",
  },
  {
    key:   "security",
    icon:  "shield-checkmark-outline",
    label: "Sécurité du compte",
    desc:  "Connexions, changements de mot de passe",
  },
  {
    key:   "system",
    icon:  "megaphone-outline",
    label: "Alertes système",
    desc:  "Mises à jour et maintenances planifiées",
  },
];

// ─── Toggle Switch ────────────────────────────────────────
function Toggle({ enabled, onToggle, accent }: {
  enabled: boolean; onToggle: () => void; accent: string;
}) {
  const anim = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: enabled ? 1 : 0,
      useNativeDriver: false, speed: 40,
    }).start();
  }, [enabled]);

  const bg   = anim.interpolate({ inputRange: [0, 1], outputRange: ["#CBD5E1", accent] });
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
      <Animated.View style={[tgS.track, { backgroundColor: bg }]}>
        <Animated.View style={[tgS.knob, { left }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
const tgS = StyleSheet.create({
  track: {
    width: 46, height: 26, borderRadius: 99,
    justifyContent: "center",
  },
  knob: {
    position: "absolute",
    width: 20, height: 20, borderRadius: 99,
    backgroundColor: T.white,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
});

// ─── Ligne catégorie ─────────────────────────────────────
function CategoryRow({
  category, prefs, onToggle, accent, isLast,
}: {
  category: typeof CATEGORIES[0];
  prefs:    NotifPrefs;
  onToggle: (channel: NotifChannel) => void;
  accent:   string;
  isLast:   boolean;
}) {
  return (
    <View style={[crS.row, !isLast && { borderBottomWidth: 1, borderBottomColor: T.borderLt }]}>
      {/* Icône + texte */}
      <View style={[crS.iconBox, { backgroundColor: `${accent}12` }]}>
        <Ionicons name={category.icon as any} size={17} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[crS.label, { fontFamily: T.font.sans }]}>{category.label}</Text>
        <Text style={[crS.desc,  { fontFamily: T.font.sans }]}>{category.desc}</Text>
      </View>

      {/* Toggles Push + Email */}
      <View style={crS.togglesCol}>
        {/* Push */}
        <View style={crS.toggleRow}>
          <Ionicons name="phone-portrait-outline" size={11} color={T.textMuted} />
          <Toggle
            enabled={prefs.push[category.key]}
            onToggle={() => onToggle("push")}
            accent={accent}
          />
        </View>
        {/* Email */}
        <View style={crS.toggleRow}>
          <Ionicons name="mail-outline" size={11} color={T.textMuted} />
          <Toggle
            enabled={prefs.email[category.key]}
            onToggle={() => onToggle("email")}
            accent={accent}
          />
        </View>
      </View>
    </View>
  );
}
const crS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14,
  },
  iconBox:    { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  label:      { fontSize: 13, fontWeight: "700", color: T.text, marginBottom: 2 },
  desc:       { fontSize: 10, fontWeight: "500", color: T.textMuted, lineHeight: 14 },
  togglesCol: { gap: 6 },
  toggleRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function NotificationsScreen() {
  const router  = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [prefs,   setPrefs]   = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const [toast, setToast] = useState({ title: "", message: "" });
  const toastAnim = useRef(new Animated.Value(-120)).current;

  // ── Chargement AsyncStorage ────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as NotifPrefs;
          // Fusion avec les défauts pour gérer les nouvelles clés
          setPrefs({
            push:  { ...DEFAULT_PREFS.push,  ...parsed.push  },
            email: { ...DEFAULT_PREFS.email, ...parsed.email },
          });
        }
      } catch {
        // Silencieux — on reste sur les défauts
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // ── Toast ──────────────────────────────────────────────
  const showToast = (title: string, message: string) => {
    setToast({ title, message });
    Animated.spring(toastAnim, {
      toValue: Platform.OS === "android" ? 54 : 60,
      useNativeDriver: true, speed: 12,
    }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -120, duration: 300, useNativeDriver: true,
      }).start();
    }, 3000);
  };

  // ── Toggle ─────────────────────────────────────────────
  const toggle = (cat: NotifCategory, channel: NotifChannel) => {
    setPrefs((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [cat]: !prev[channel][cat],
      },
    }));
  };

  // ── Tout activer / désactiver ─────────────────────────
  const toggleAll = (channel: NotifChannel, value: boolean) => {
    const all = {} as Record<NotifCategory, boolean>;
    CATEGORIES.forEach((c) => { all[c.key] = value; });
    setPrefs((prev) => ({ ...prev, [channel]: all }));
  };

  // ── Sauvegarde ─────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      showToast("✅ Préférences sauvegardées", "Vos préférences de notifications ont été mises à jour.");
    } catch {
      showToast("Erreur", "Impossible d'enregistrer les préférences.");
    } finally {
      setSaving(false);
    }
  };

  // ── Header légende Push / Email ────────────────────────
  function ChannelLegend() {
    return (
      <View style={lgS.row}>
        <View style={{ flex: 1 }} />
        <View style={lgS.col}>
          <Ionicons name="phone-portrait-outline" size={12} color={T.textSub} />
          <Text style={[lgS.txt, { fontFamily: T.font.sans }]}>Push</Text>
        </View>
        <View style={lgS.col}>
          <Ionicons name="mail-outline" size={12} color={T.textSub} />
          <Text style={[lgS.txt, { fontFamily: T.font.sans }]}>Email</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const allPushOn  = CATEGORIES.every((c) => prefs.push[c.key]);
  const allEmailOn = CATEGORIES.every((c) => prefs.email[c.key]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        {/* ── Toast ── */}
        <Animated.View
          style={[s.toastWrap, { transform: [{ translateY: toastAnim }] }]}
          pointerEvents="none"
        >
          <View style={[s.toastBox, { backgroundColor: theme.accent }]}>
            <Ionicons name="checkmark-circle" size={22} color={T.white} />
            <View style={{ flex: 1 }}>
              <Text style={[s.toastTitle, { fontFamily: T.font.sans }]}>{toast.title}</Text>
              <Text style={[s.toastMsg,   { fontFamily: T.font.sans }]}>{toast.message}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[s.heroBox, { backgroundColor: theme.accentLight }]}>
            <Ionicons name="notifications" size={38} color={theme.accent} />
          </View>

          <Text style={[s.title,    { fontFamily: T.font.display }]}>
            Préférences de notifications
          </Text>
          <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
            Choisissez comment vous souhaitez être informé pour chaque type d'événement.
          </Text>

          {/* ── Tout activer / désactiver ── */}
          <View style={s.masterRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.masterLabel, { fontFamily: T.font.sans }]}>TOUT ACTIVER</Text>
            </View>
            {/* Master Push */}
            <View style={s.masterToggleGroup}>
              <Ionicons name="phone-portrait-outline" size={12} color={T.textSub} />
              <Toggle
                enabled={allPushOn}
                onToggle={() => toggleAll("push", !allPushOn)}
                accent={theme.accent}
              />
            </View>
            {/* Master Email */}
            <View style={s.masterToggleGroup}>
              <Ionicons name="mail-outline" size={12} color={T.textSub} />
              <Toggle
                enabled={allEmailOn}
                onToggle={() => toggleAll("email", !allEmailOn)}
                accent={theme.accent}
              />
            </View>
          </View>

          {/* ── Liste catégories ── */}
          <View style={s.card}>
            {/* Légende colonnes */}
            <View style={lgS.row}>
              <View style={{ flex: 1 }}>
                <Text style={[lgS.header, { fontFamily: T.font.sans }]}>CATÉGORIE</Text>
              </View>
              <View style={lgS.col}>
                <Ionicons name="phone-portrait-outline" size={11} color={T.textSub} />
                <Text style={[lgS.txt, { fontFamily: T.font.sans }]}>Push</Text>
              </View>
              <View style={lgS.col}>
                <Ionicons name="mail-outline" size={11} color={T.textSub} />
                <Text style={[lgS.txt, { fontFamily: T.font.sans }]}>Email</Text>
              </View>
            </View>

            {CATEGORIES.map((cat, i) => (
              <CategoryRow
                key={cat.key}
                category={cat}
                prefs={prefs}
                onToggle={(channel) => toggle(cat.key, channel)}
                accent={theme.accent}
                isLast={i === CATEGORIES.length - 1}
              />
            ))}
          </View>

          {/* ── Info ── */}
          <View style={[s.infoBox, { borderColor: `${theme.accent}30`, backgroundColor: `${theme.accent}08` }]}>
            <Ionicons name="information-circle-outline" size={15} color={theme.accent} />
            <Text style={[s.infoTxt, { fontFamily: T.font.sans, color: theme.accent }]}>
              Les notifications push nécessitent que l'application soit installée sur votre appareil. Les notifications email sont envoyées à l'adresse associée à votre compte.
            </Text>
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.accent }, saving && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={T.white} />
              : <>
                  <Ionicons name="checkmark-done-outline" size={18} color={T.white} />
                  <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>
                    ENREGISTRER LES PRÉFÉRENCES
                  </Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 110 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles légende ──────────────────────────────────────
const lgS = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", marginBottom: 4 },
  header: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase" },
  col:    { width: 58, alignItems: "center", gap: 2 },
  txt:    { fontSize: 9, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5 },
});

// ─── Styles globaux ──────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  toastWrap: {
    position: "absolute", top: 0, left: 0, right: 0,
    zIndex: 9999, paddingHorizontal: 20,
  },
  toastBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 16,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  toastTitle: { color: T.white, fontSize: 13, fontWeight: "800" },
  toastMsg:   { color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "500", marginTop: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    backgroundColor: T.cardBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { color: T.text, fontSize: 20, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, alignItems: "center" },

  heroBox: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: "center", alignItems: "center", marginBottom: 18,
  },
  title: {
    color: T.text, fontSize: 22, fontWeight: "700",
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    color: T.textSub, fontSize: 13, fontWeight: "500",
    textAlign: "center", lineHeight: 19, marginBottom: 24,
    paddingHorizontal: 16,
  },

  masterRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.cardBg,
    borderRadius: T.radius.lg, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: T.border,
    width: "100%", maxWidth: 480,
  },
  masterLabel:       { fontSize: 9, fontWeight: "900", color: T.textMuted, letterSpacing: 1 },
  masterToggleGroup: { flexDirection: "row", alignItems: "center", gap: 6, width: 58, justifyContent: "center" },

  card: {
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    padding: 16, borderWidth: 1, borderColor: T.border,
    width: "100%", maxWidth: 480, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: T.radius.md,
    borderWidth: 1, marginBottom: 20,
    width: "100%", maxWidth: 480,
  },
  infoTxt: { flex: 1, fontSize: 11, fontWeight: "500", lineHeight: 16 },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: T.radius.md, paddingVertical: 16,
    width: "100%", maxWidth: 480,
  },
  saveTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
});