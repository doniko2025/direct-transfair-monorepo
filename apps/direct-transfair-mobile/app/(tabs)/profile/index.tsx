// apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
// =========================================================
// PROFILE INDEX v5.4 — Direct Transf'air
// ✅ v5.4 : HERO — dégradé sombre identique à ClientDashboard
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (biométrie, déconnexion, tous les onPress des MenuRow : identiques).
//    - L'ancienne "hero card" blanche (barre colorée du haut + avatar +
//      nom + rôle), qui vivait DANS le scroll, est remplacée par un vrai
//      hero plein écran en LinearGradient sombre (#0A0F0D → #123324,
//      mêmes teintes que ClientDashboard), positionné AU-DESSUS du
//      scroll — évite la duplication d'un bloc identité en double.
//      LinearGradient était déjà importé mais inutilisé depuis le
//      passage au fond blanc en v5.3 — reprend son usage ici.
//    - Avatar / nom / ID / pastille de rôle : recolorés en blanc et
//      "verre" translucide pour rester lisibles sur fond sombre. Le
//      reste de l'écran (jauge sécurité, sections MON COMPTE /
//      SÉCURITÉ / ADMIN, déconnexion) reste blanc/neutre inchangé,
//      toujours coloré par thème.accent selon le rôle comme avant.
//    - SafeAreaView passe en fond sombre ; le ScrollView (déjà en
//      backgroundColor: T.bg explicite) continue de peindre le blanc
//      par-dessus pour tout ce qui suit le hero — aucun changement
//      nécessaire de ce côté.
//    - useSafeAreaInsets (nouveau) pour un alignement fiable sous
//      l'encoche.
// ✅ v5.1 conservé intégralement
// ✅ v5.2 : "Préférences de notifications" branché
// ✅ v5.3 : Fond blanc pur — plus de dégradé vert/teal
// =========================================================

import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Alert, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // ✅ v5.4 (nouveau)
import { useAuth } from "../../../providers/AuthProvider";
import {
  isBiometricsAvailable,
  getBiometricsEnabled,
  setBiometricsEnabled,
  promptBiometrics,
} from "../../../hooks/useBiometrics";

// ─── Thèmes par rôle ────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN: {
    accent: "#1D4ED8", accentSoft: "#EFF6FF",
    accentMid: "#DBEAFE",
    label: "Super Admin", icon: "shield-checkmark",
  },
  COMPANY_ADMIN: {
    accent: "#0D9488", accentSoft: "#E8F9F6",
    accentMid: "#CCFBF1",
    label: "Admin Société", icon: "business",
  },
  AGENT: {
    accent: "#D97706", accentSoft: "#FFFBEB",
    accentMid: "#FEF3C7",
    label: "Agent", icon: "briefcase",
  },
  USER: {
    accent: "#059669", accentSoft: "#ECFDF5",
    accentMid: "#A7F3D0",
    label: "Client", icon: "wallet",
  },
} as const;

const T = {
  bg:      "#FFFFFF",   // fond blanc pur (corps de l'écran, sous le hero)
  pageBg:  "#F8FAFF",   // très légère teinte pour le scroll
  white:   "#FFFFFF",
  text:    "#0F172A",
  textSub: "#475569",
  textDim: "#94A3B8",
  border:  "#E8EDF5",
  red:     "#DC2626",
  redSoft: "#FEE2E2",
  // ✅ v5.4 (nouveau) — mêmes teintes exactes que le hero de ClientDashboard
  heroFrom: "#0A0F0D",
  heroTo:   "#123324",
  heroGlow: "rgba(5,150,105,0.18)",
  heroMuted:"rgba(255,255,255,0.6)",
  radius: { sm: 10, md: 14, lg: 20, xl: 28 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Menu Row ────────────────────────────────────────────
function MenuRow({
  icon, label, accent, onPress, rightElement, danger = false, disabled = false,
}: {
  icon: string; label: string; accent: string; onPress?: () => void;
  rightElement?: React.ReactNode; danger?: boolean; disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = danger ? T.red : accent;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[mrS.row, { borderBottomColor: T.border }]}
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,     useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Icône */}
        <View style={[mrS.iconBox, { backgroundColor: danger ? "#FEE2E2" : `${color}12` }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>

        {/* Label */}
        <Text style={[mrS.label, { fontFamily: T.font.sans, color: danger ? T.red : T.text }]}>
          {label}
        </Text>

        {/* Right element ou chevron */}
        {rightElement ?? (
          <View style={[mrS.chevronBox, { backgroundColor: `${color}10` }]}>
            <Ionicons name="chevron-forward" size={13} color={color} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const mrS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 15, borderBottomWidth: 1,
  },
  iconBox:    { width: 38, height: 38, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  label:      { flex: 1, fontSize: 14, fontWeight: "600" },
  chevronBox: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Section ─────────────────────────────────────────────
function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      {/* Titre de section */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <View style={[sS.dot, { backgroundColor: accent }]} />
        <Text style={[sS.title, { fontFamily: T.font.sans }]}>{title}</Text>
      </View>

      {/* Carte blanche avec bande colorée gauche + ombre */}
      <View style={sS.card}>
        <View style={[sS.accentBar, { backgroundColor: accent }]} />
        <View style={sS.inner}>{children}</View>
      </View>
    </View>
  );
}

const sS = StyleSheet.create({
  dot:   { width: 6, height: 6, borderRadius: 99 },
  title: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },
  card: {
    backgroundColor: T.white,
    borderRadius:    T.radius.lg,
    borderWidth:     1,
    borderColor:     T.border,
    flexDirection:   "row",
    overflow:        "hidden",
    shadowColor:     "#64748B",
    shadowOffset:    { width: 0, height: 5 },
    shadowOpacity:   0.10,
    shadowRadius:    16,
    elevation:       6,
  },
  accentBar: { width: 4 },
  inner:     { flex: 1, paddingHorizontal: 14 },
});

// ─── BiometricToggle ─────────────────────────────────────
function BiometricToggle({ enabled, onToggle, accent }: {
  enabled: boolean; onToggle: () => void; accent: string;
}) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={btS.row}>
      <View style={[btS.track, enabled && { backgroundColor: accent }]}>
        <View style={[btS.knob, enabled && btS.knobOn]} />
      </View>
    </TouchableOpacity>
  );
}

const btS = StyleSheet.create({
  row:   { justifyContent: "center", alignItems: "center" },
  track: { width: 46, height: 26, borderRadius: 99, backgroundColor: "#CBD5E1", justifyContent: "center", padding: 3 },
  knob:  { width: 20, height: 20, borderRadius: 99, backgroundColor: T.white, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  knobOn:{ alignSelf: "flex-end" },
});

// ─── Main Screen ─────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets(); // ✅ v5.4 (nouveau)

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const isAdmin = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
  const isAgent = role === "AGENT";
  const isUser  = role === "USER";

  // ─── Biométrie ───────────────────────────────────────
  const [bioEnabled,   setBioEnabledState]   = useState(false);
  const [bioAvailable, setBioAvailableState] = useState(false);

  useEffect(() => {
    const load = async () => {
      const available = await isBiometricsAvailable();
      setBioAvailableState(available);
      if (available) setBioEnabledState(await getBiometricsEnabled());
    };
    void load();
  }, []);

  const handleToggleBio = async () => {
    if (!bioAvailable) {
      Alert.alert("Biométrie indisponible", "Votre appareil ne supporte pas la biométrie ou aucune empreinte n'est enregistrée.");
      return;
    }
    if (!bioEnabled) {
      const ok = await promptBiometrics("Activez la connexion biométrique");
      if (!ok) return;
      await setBiometricsEnabled(true);
      setBioEnabledState(true);
      Alert.alert("✅ Activé", "La connexion biométrique est maintenant activée.");
    } else {
      Alert.alert(
        "Désactiver la biométrie",
        "Vous devrez utiliser votre mot de passe pour vous reconnecter.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Désactiver", style: "destructive", onPress: async () => { await setBiometricsEnabled(false); setBioEnabledState(false); } },
        ],
      );
    }
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : "Utilisateur";

  const initials = user?.firstName
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "DT";

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Fermer votre session Direct Transf'air ?")) void logout();
      return;
    }
    Alert.alert(
      "Déconnexion sécurisée",
      "Êtes-vous sûr de vouloir fermer votre session ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Me déconnecter", style: "destructive",
          onPress: async () => {
            await logout();
            if (router.canDismiss()) router.dismissAll();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  return (
    // ✅ v5.4 : fond sombre (zone sous l'encoche) — le ScrollView plus
    // bas repeint T.bg (blanc) par-dessus dès le début de son contenu.
    <SafeAreaView style={{ flex: 1, backgroundColor: T.heroFrom }}>
      <StatusBar barStyle="light-content" backgroundColor={T.heroFrom} />

      {/* ✅ v5.4 : hero plein écran, remplace l'ancienne "hero card"
          blanche qui vivait dans le scroll (avatar/nom/rôle déplacés ici) */}
      <LinearGradient
        colors={[T.heroFrom, T.heroTo]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 20 }]}
      >
        <View style={s.heroGlow} pointerEvents="none" />
        <View style={s.heroBody}>
          <View style={s.avatarBox}>
            <Text style={[s.initials, { fontFamily: T.font.display }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { fontFamily: T.font.display }]}>{displayName}</Text>
            <Text style={[s.userId, { fontFamily: T.font.mono }]}>
              {user?.id?.slice(0, 12).toUpperCase() ?? "—"}
            </Text>
            <View style={s.rolePill}>
              <Ionicons name={theme.icon as any} size={11} color="#FFFFFF" />
              <Text style={[s.roleLabel, { fontFamily: T.font.sans }]}>
                {theme.label}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: T.bg }}
      >
        {/* ── Security gauge (Users only) ── */}
        {isUser && (
          <View style={[s.secCard, { borderColor: `${theme.accent}30` }]}>
            <View style={s.secTop}>
              <Ionicons name="shield-checkmark" size={16} color={theme.accent} />
              <Text style={[s.secTitle, { fontFamily: T.font.sans }]}>Sécurité du compte</Text>
              <Text style={[s.secScore, { color: theme.accent, fontFamily: T.font.display }]}>
                {bioEnabled ? "100%" : "85%"}
              </Text>
            </View>
            <View style={[s.secBarBg, { backgroundColor: `${theme.accent}12` }]}>
              <View style={[s.secBarFill, { width: bioEnabled ? "100%" : "85%", backgroundColor: theme.accent }]} />
            </View>
            <Text style={[s.secHint, { fontFamily: T.font.sans }]}>
              {bioEnabled ? "🔒 Compte entièrement sécurisé" : "Activez la biométrie pour atteindre 100%"}
            </Text>
          </View>
        )}

        {/* ── MON COMPTE ── */}
        <Section title="MON COMPTE" accent={theme.accent}>
          <MenuRow icon="person-outline" label="Informations personnelles" accent={theme.accent} onPress={() => router.push("/(tabs)/profile/personal-info")} />
          {isUser && (
            <>
              <MenuRow icon="card-outline"        label="Moyens de paiement"         accent={theme.accent} onPress={() => router.push("/(tabs)/profile/payment-methods")} />
              <MenuRow icon="speedometer-outline" label="Mes plafonds de transfert"  accent={theme.accent} onPress={() => router.push("/(tabs)/profile/limits")} />
            </>
          )}
          {(isUser || isAgent) && (
            <MenuRow icon="location-outline" label="Points Direct Transf'air" accent={theme.accent} onPress={() => router.push("/(tabs)/profile/locations")} />
          )}
        </Section>

        {/* ── SÉCURITÉ & APPAREILS ── */}
        <Section title="SÉCURITÉ & APPAREILS" accent={theme.accent}>
          <MenuRow icon="phone-portrait-outline" label="Appareils connectés"        accent={theme.accent} onPress={() => router.push("/(tabs)/profile/devices")} />
          <MenuRow icon="keypad-outline"         label="Modifier mon code secret"   accent={theme.accent} onPress={() => router.push("/(tabs)/profile/security")} />
          <MenuRow
            icon={bioAvailable ? "finger-print-outline" : "finger-print-outline"}
            label={bioAvailable ? "Biométrie (Face ID / Touch ID)" : "Biométrie (non disponible)"}
            accent={bioAvailable ? theme.accent : T.textDim}
            disabled={!bioAvailable}
            rightElement={
              bioAvailable ? (
                <BiometricToggle enabled={bioEnabled} onToggle={handleToggleBio} accent={theme.accent} />
              ) : (
                <View style={{ width: 46, height: 26, borderRadius: 99, backgroundColor: "#E2E8F0", justifyContent: "center", padding: 3 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: T.white }} />
                </View>
              )
            }
          />
        </Section>

        {/* ── ADMIN ONLY ── */}
        {isAdmin && (
          <Section title="ADMINISTRATION" accent={theme.accent}>
            <MenuRow icon="analytics-outline"      label="Tableau de bord admin"            accent={theme.accent} onPress={() => router.back()} />
            <MenuRow icon="notifications-outline"  label="Préférences de notifications"     accent={theme.accent} onPress={() => router.push("/(tabs)/profile/notifications")} />
          </Section>
        )}

        {/* ── Déconnexion ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="power-outline" size={18} color={T.red} />
          <Text style={[s.logoutTxt, { fontFamily: T.font.sans }]}>Fermer la session</Text>
        </TouchableOpacity>

        {isUser && (
          <TouchableOpacity style={s.deleteBtn} activeOpacity={0.7}>
            <Ionicons name="warning-outline" size={14} color={T.textDim} />
            <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>Supprimer mon compte</Text>
          </TouchableOpacity>
        )}

        <Text style={[s.version, { fontFamily: T.font.mono }]}>
          Direct Transf'air v5.0 · Build 501
        </Text>
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  // ✅ v5.4 (nouveau) — hero plein écran, remplace l'ancienne hero card
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute", top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: T.heroGlow,
  },
  heroBody: { flexDirection: "row", alignItems: "center", gap: 16 },

  avatarBox: {
    width: 60, height: 60, borderRadius: T.radius.lg,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
  },
  initials: { fontSize: 24, fontWeight: "900", color: "#FFFFFF" },
  name:     { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 3 },
  userId:   { color: T.heroMuted, fontSize: 10, fontWeight: "700", marginBottom: 8, letterSpacing: 1 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: T.radius.sm, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.25)",
  },
  roleLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5, color: "#FFFFFF" },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  secCard: {
    backgroundColor: T.white, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 20, borderWidth: 1.5,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  secTop:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  secTitle:   { flex: 1, fontSize: 13, fontWeight: "700", color: T.text },
  secScore:   { fontSize: 18, fontWeight: "900" },
  secBarBg:   { height: 5, borderRadius: 99, marginBottom: 10, overflow: "hidden" },
  secBarFill: { height: 5, borderRadius: 99 },
  secHint:    { color: T.textDim, fontSize: 11, fontWeight: "600" },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.redSoft, borderRadius: T.radius.md,
    paddingVertical: 16, marginTop: 8, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#FECACA",
    shadowColor: "#DC2626", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },
  logoutTxt: { color: T.red, fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },

  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginBottom: 20 },
  deleteTxt: { color: T.textDim, fontSize: 12, fontWeight: "600" },

  version: { textAlign: "center", color: T.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
});