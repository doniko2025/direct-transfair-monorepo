// apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
// =========================================================
// PROFILE INDEX v6.0 — Direct Transf'air
// ✅ v6.0 : 🔥 REFONTE TOTALE de l'écran « Compte » : identité en en-tête de marque, jauge de sécurité,
//    menus groupés en cartes avec icône, intitulé et sous-titre, interrupteur biométrique, déconnexion.
//    Couleurs issues du thème du tenant (kit components/wallet). Logique INCHANGÉE : biométrie
//    (disponibilité, activation, désactivation), déconnexion (web + mobile), toutes les routes.
// ✅ v5.5 : (phase 5) clients wallet uniquement — thèmes et sections des
//    rôles AGENT / COMPANY_ADMIN / SUPER_ADMIN (dont « ADMINISTRATION »)
//    supprimés ; ces rôles utilisent le portail web.
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
//    Nom de la société = branding.name du tenant (était « Direct Transf'air » écrit en dur).
// =========================================================

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../providers/AuthProvider";
import {
  isBiometricsAvailable,
  getBiometricsEnabled,
  setBiometricsEnabled,
  promptBiometrics,
} from "../../../hooks/useBiometrics";
import { Avatar, Card } from "../../../components/wallet/WalletParts";
import { FONT, N, RADIUS, TAB_BAR_SPACE, useWalletTheme } from "../../../components/wallet/walletTheme";

import { useTenant } from "../../../providers/TenantProvider";
import Constants from "expo-constants";
// ─── Ligne de menu ───────────────────────────────────────
function MenuRow({
  icon, label, hint, onPress, right, last, disabled,
}: {
  icon: string; label: string; hint?: string; onPress?: () => void;
  right?: React.ReactNode; last?: boolean; disabled?: boolean;
}) {
  const { P } = useWalletTheme();
  return (
    <TouchableOpacity
      style={[s.row, !last && s.divider, disabled && { opacity: 0.55 }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <View style={[s.rowIcon, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
        <Ionicons name={icon as any} size={19} color={P.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowLabel} numberOfLines={1}>{label}</Text>
        {!!hint && <Text style={s.rowHint} numberOfLines={1}>{hint}</Text>}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={N.muted} />}
    </TouchableOpacity>
  );
}

function Switch({ on, onToggle, color }: { on: boolean; onToggle: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={[s.track, on && { backgroundColor: color }]}>
        <View style={[s.knob, on && { alignSelf: "flex-end" }]} />
      </View>
    </TouchableOpacity>
  );
}

function GroupTitle({ children }: { children: string }) {
  return <Text style={s.group}>{children}</Text>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { P } = useWalletTheme();
  const { branding } = useTenant();
  const appVersion = Constants.expoConfig?.version ?? "";

  // ─── Biométrie (logique inchangée) ─────────────────────
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

  const displayName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Utilisateur";

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm(`Fermer votre session ${branding.name} ?`)) void logout();
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
      ],
    );
  };

  const topPad = Math.max(insets.top, Platform.OS === "android" ? 28 : 20) + 14;
  const score = bioEnabled ? 100 : 85;

  return (
    <View style={{ flex: 1, backgroundColor: N.page }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
        {/* ── Identité ── */}
        <LinearGradient
          colors={[P.bg1, P.bg2, P.bg3]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad }]}
        >
          <Avatar name={displayName} size={76} />
          <Text style={s.heroName} numberOfLines={1}>{displayName}</Text>
          {!!user?.email && <Text style={s.heroMail} numberOfLines={1}>{user.email}</Text>}
          <View style={s.idPill}>
            <Ionicons name="finger-print-outline" size={13} color="#fff" />
            <Text style={s.idTxt}>ID {user?.id?.slice(0, 8).toUpperCase() ?? "—"}</Text>
          </View>
        </LinearGradient>

        <View style={s.body}>
          {/* ── Sécurité du compte ── */}
          <Card>
            <View style={s.secTop}>
              <View style={[s.secIcon, { backgroundColor: P.tint }]}>
                <Ionicons name="shield-checkmark" size={20} color={P.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.secTitle}>Sécurité du compte</Text>
                <Text style={s.secHint}>
                  {bioEnabled ? "Compte entièrement sécurisé" : "Active la biométrie pour atteindre 100 %"}
                </Text>
              </View>
              <Text style={[s.secScore, { color: P.accent }]}>{score}%</Text>
            </View>
            <View style={[s.bar, { backgroundColor: P.tint }]}>
              <View style={[s.barFill, { width: `${score}%`, backgroundColor: P.action }]} />
            </View>
          </Card>

          {/* ── Mon compte ── */}
          <View>
            <GroupTitle>Mon compte</GroupTitle>
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              <MenuRow icon="person-outline" label="Informations personnelles" hint="Identité, coordonnées" onPress={() => router.push("/(tabs)/profile/personal-info")} />
              <MenuRow icon="card-outline" label="Moyens de paiement" hint="Cartes et comptes enregistrés" onPress={() => router.push("/(tabs)/profile/payment-methods")} />
              <MenuRow icon="speedometer-outline" label="Mes plafonds de transfert" hint="Limites d'envoi" onPress={() => router.push("/(tabs)/profile/limits")} />
              <MenuRow icon="location-outline" label={`Points ${branding.name}`} hint="Où déposer et retirer" onPress={() => router.push("/(tabs)/profile/locations")} last />
            </Card>
          </View>

          {/* ── Sécurité & appareils ── */}
          <View>
            <GroupTitle>Sécurité et appareils</GroupTitle>
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              <MenuRow icon="phone-portrait-outline" label="Appareils connectés" hint="Gérer les appareils de confiance" onPress={() => router.push("/(tabs)/profile/devices")} />
              <MenuRow icon="keypad-outline" label="Modifier mon code secret" onPress={() => router.push("/(tabs)/profile/security")} />
              <MenuRow
                icon="finger-print-outline"
                label={bioAvailable ? "Connexion biométrique" : "Biométrie non disponible"}
                hint={bioAvailable ? "Face ID / empreinte" : "Aucune empreinte enregistrée sur cet appareil"}
                disabled={!bioAvailable}
                onPress={handleToggleBio}
                right={<Switch on={bioEnabled} onToggle={handleToggleBio} color={P.action} />}
                last
              />
            </Card>
          </View>

          {/* ── Session ── */}
          <TouchableOpacity style={s.logout} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={19} color={N.danger} />
            <Text style={s.logoutTxt}>Fermer la session</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.delete} activeOpacity={0.7}>
            <Text style={s.deleteTxt}>Supprimer mon compte</Text>
          </TouchableOpacity>

          <Text style={s.version}>{branding.name}{appVersion ? ` · v${appVersion}` : ""}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    alignItems: "center", paddingHorizontal: 20, paddingBottom: 56, gap: 6,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroName: { fontFamily: FONT.display, fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 10 },
  heroMail: { fontFamily: FONT.body, fontSize: 13.5, color: "rgba(255,255,255,0.75)" },
  idPill: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6,
  },
  idTxt: { fontFamily: FONT.medium, fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 0.8 },

  body: { paddingHorizontal: 16, gap: 18, marginTop: -30 },

  secTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  secIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  secTitle: { fontFamily: FONT.medium, fontSize: 15, fontWeight: "700", color: N.ink },
  secHint: { fontFamily: FONT.body, fontSize: 12.5, color: N.muted, marginTop: 2 },
  secScore: { fontFamily: FONT.display, fontSize: 22, fontWeight: "700" },
  bar: { height: 8, borderRadius: 99, marginTop: 14, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 99 },

  group: { fontFamily: FONT.medium, fontSize: 13, fontWeight: "700", color: N.muted, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#EEF2F0" },
  rowIcon: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: FONT.medium, fontSize: 14.5, fontWeight: "700", color: N.ink },
  rowHint: { fontFamily: FONT.body, fontSize: 12, color: N.muted, marginTop: 2 },

  track: { width: 48, height: 28, borderRadius: 99, backgroundColor: "#D0D5DD", justifyContent: "center", padding: 3 },
  knob: { width: 22, height: 22, borderRadius: 99, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 3, elevation: 2 },

  logout: {
    height: 52, borderRadius: RADIUS.md, backgroundColor: N.dangerBg, borderWidth: 1, borderColor: N.dangerBd,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  logoutTxt: { fontFamily: FONT.medium, fontSize: 15, fontWeight: "700", color: N.danger },
  delete: { alignItems: "center", paddingVertical: 4 },
  deleteTxt: { fontFamily: FONT.body, fontSize: 13, color: N.muted, textDecorationLine: "underline" },
  version: { fontFamily: FONT.body, fontSize: 11.5, color: N.muted, textAlign: "center" },
});
