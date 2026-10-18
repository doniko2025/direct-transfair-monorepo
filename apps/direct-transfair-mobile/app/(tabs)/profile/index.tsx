// apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
// =========================================================
// PROFILE INDEX v7.0 — Direct Transf'air
// ✅ v7.0 : 🔥 REFONTE TOTALE en thème clair : identité centrée (avatar, nom, e-mail, ID), jauge de
//    sécurité, menus en groupes blancs arrondis (icône sur pastille beige, intitulé, sous-titre),
//    interrupteur biométrique, déconnexion. Design system components/ui (accent = couleur de la société).
//    Logique INCHANGÉE : biométrie (disponibilité, activation, désactivation), déconnexion (web + mobile),
//    toutes les routes. Nom de société = branding.name du tenant.
// ✅ v6.0 : refonte « wallet » (en-tête de marque, jauge de sécurité, menus groupés).
// ✅ v5.x : historique (hero sombre, rôles agent/admin supprimés en phase 5, préférences de notifications).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useState } from "react";
import { View, Pressable, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import {
  isBiometricsAvailable,
  getBiometricsEnabled,
  setBiometricsEnabled,
  promptBiometrics,
} from "../../../hooks/useBiometrics";
import { useTenant } from "../../../providers/TenantProvider";
import Constants from "expo-constants";
import { Avatar, Button, Card, Group, ListRow, Pill, Screen, SectionHeader, Toggle, UText, useUI } from "../../../components/ui";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { C } = useUI();
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

  const score = bioEnabled ? 100 : 85;

  const menu = (icon: string, label: string, hint: string | undefined, route: string, last?: boolean) => (
    <ListRow icon={icon} title={label} subtitle={hint} onPress={() => router.push(route as any)} last={last} />
  );

  return (
    <Screen tabSpace>
      {/* ── Identité ── */}
      <View style={{ alignItems: "center", paddingTop: 16, paddingBottom: 22, gap: 6 }}>
        <Avatar name={displayName} size={88} />
        <UText v="title" style={{ marginTop: 10 }} numberOfLines={1}>{displayName}</UText>
        {!!user?.email && <UText v="body" tone="muted" numberOfLines={1}>{user.email}</UText>}
        <Pill label={`ID ${user?.id?.slice(0, 8).toUpperCase() ?? "—"}`} tone="neutral" icon="finger-print-outline" style={{ marginTop: 6 }} />
      </View>

      {/* ── Sécurité du compte ── */}
      <Card tone="accent">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <UText v="subheading">Sécurité du compte</UText>
            <UText v="caption" tone="muted" style={{ marginTop: 2 }}>
              {bioEnabled ? "Compte entièrement sécurisé" : "Active la biométrie pour 100 %"}
            </UText>
          </View>
          <UText v="title">{score}%</UText>
        </View>
        <View style={{ height: 8, borderRadius: 99, marginTop: 14, overflow: "hidden", backgroundColor: C.surface }}>
          <View style={{ height: 8, borderRadius: 99, width: `${score}%`, backgroundColor: C.accent }} />
        </View>
      </Card>

      {/* ── Mon compte ── */}
      <SectionHeader title="Mon compte" />
      <Group>
        {menu("person-outline", "Informations personnelles", "Identité, coordonnées", "/(tabs)/profile/personal-info")}
        {menu("card-outline", "Moyens de paiement", "Cartes et comptes enregistrés", "/(tabs)/profile/payment-methods")}
        {menu("speedometer-outline", "Mes plafonds de transfert", "Limites d'envoi", "/(tabs)/profile/limits")}
        {menu("location-outline", `Points ${branding.name}`, "Où déposer et retirer", "/(tabs)/profile/locations", true)}
      </Group>

      {/* ── Sécurité & appareils ── */}
      <SectionHeader title="Sécurité et appareils" />
      <Group>
        {menu("phone-portrait-outline", "Appareils connectés", "Gérer les appareils de confiance", "/(tabs)/profile/devices")}
        {menu("keypad-outline", "Modifier mon code secret", undefined, "/(tabs)/profile/security")}
        <ListRow
          icon="finger-print-outline"
          title={bioAvailable ? "Connexion biométrique" : "Biométrie non disponible"}
          subtitle={bioAvailable ? "Face ID / empreinte" : "Aucune empreinte enregistrée sur cet appareil"}
          onPress={bioAvailable ? handleToggleBio : undefined}
          right={<Toggle value={bioEnabled} onValueChange={handleToggleBio} disabled={!bioAvailable} />}
          last
        />
      </Group>

      {/* ── Session ── */}
      <Button label="Fermer la session" icon="log-out-outline" kind="danger" onPress={handleLogout} style={{ marginTop: 28 }} />

      <Pressable style={{ alignItems: "center", paddingVertical: 16 }} accessibilityRole="button">
        <UText v="caption" tone="muted" style={{ textDecorationLine: "underline" }}>Supprimer mon compte</UText>
      </Pressable>

      <UText v="label" tone="faint" align="center">{branding.name}{appVersion ? ` · v${appVersion}` : ""}</UText>
    </Screen>
  );
}
