// apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
// =========================================================
// PROFILE INDEX v8.2 — SÉPARATION RENFORCÉE : en compte marchand, l'identité affichée est celle du COMMERCE (nom, catégorie, statut) et le menu ne garde
//    que ce qui sert au commerce (pas de plafonds d'envoi, moyens de paiement, points de dépôt, QR personnel, bénéficiaires) ; en compte client,
//    aucune information du commerce n'apparaît.
// PROFILE INDEX v8.1 — « Supprimer mon compte » ouvre l'écran de suppression (téléphone + code secret)
// PROFILE INDEX v8.0 — COMPTES SÉPARÉS + vrai choix de photo
// ✅ v8.0 : bascule « Compte client | Compte marchand » ; les entrées du menu suivent le compte actif (opérations client d'un côté,
//    encaisser / retirer / réglages du commerce de l'autre) ; l'avatar est cliquable : caméra, galerie ou retrait de la photo.
// PROFILE INDEX v7.2 — la photo du client (selfie validé) remplace les initiales de l'avatar
// PROFILE INDEX v7.1 — + « Vérification d'identité » (clients wallet, lot 7)
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
import { useKycStatus } from "../../../hooks/useKycStatus";
import { useAccountSpace } from "../../../hooks/useAccountSpace";
import { SpaceSwitch } from "../../../components/home/SpaceSwitch";
import { ProfilePhotoSheet } from "../../../components/profile/ProfilePhotoSheet";
import { Ionicons } from "../../../components/ui/Icon";
import { useProfilePhoto } from "../../../hooks/useProfilePhoto";
import { useIsCashier } from "../../../hooks/useIsCashier";
import { KYC_STATUS_LABEL } from "../../../services/kyc";
import { api } from "../../../services/api";
import type { MerchantProfileView } from "../../../services/merchantTypes";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { C } = useUI();
  const { branding } = useTenant();
  const appVersion = Constants.expoConfig?.version ?? "";
  const { status: kyc } = useKycStatus();
  const photo = useProfilePhoto(user?.role === "USER" ? kyc : null);
  const { isMerchant, canSwitch } = useAccountSpace();
  const [photoSheet, setPhotoSheet] = useState(false);
  const isUser = user?.role === "USER";
  const clientSpace = isUser && !isMerchant;
  const merchantSpace = isUser && isMerchant;
  const isCashier = useIsCashier(clientSpace, user?.id);

  // Fiche du commerce (nom, catégorie, statut) — chargée seulement en compte marchand.
  const [shop, setShop] = useState<MerchantProfileView | null>(null);
  useEffect(() => {
    if (!merchantSpace) { setShop(null); return; }
    let alive = true;
    api.getMerchantMe().then((m) => { if (alive) setShop(m.profile); }).catch(() => { /* le nom de la personne reste affiché */ });
    return () => { alive = false; };
  }, [merchantSpace, user?.id]);

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

  const personName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Utilisateur";
  // Compte marchand : c'est le COMMERCE qui est présenté ; la personne n'apparaît que comme titulaire.
  const displayName = merchantSpace && shop?.businessName ? shop.businessName : personName;

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
      {/* ── Identité : la personne (compte client) ou le commerce (compte marchand) ── */}
      <View style={{ alignItems: "center", paddingTop: 16, paddingBottom: 22, gap: 6 }}>
        {merchantSpace ? (
          <Avatar name={displayName} size={88} />
        ) : (
          <Pressable onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel="Changer ma photo de profil" hitSlop={8}>
            <Avatar name={displayName} size={88} uri={photo} />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.ink, borderWidth: 2, borderColor: C.bg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="camera-outline" size={15} color={C.surface} />
            </View>
          </Pressable>
        )}
        <UText v="title" style={{ marginTop: 10 }} numberOfLines={1}>{displayName}</UText>
        {merchantSpace ? (
          <>
            <UText v="body" tone="muted" numberOfLines={1}>{[shop?.category, shop?.city].filter(Boolean).join(" · ") || `Titulaire : ${personName}`}</UText>
            <Pill
              label={shop?.status === "SUSPENDED" ? "Commerce suspendu" : "Commerce actif"}
              tone={shop?.status === "SUSPENDED" ? "warn" : "pos"}
              icon="storefront-outline"
              style={{ marginTop: 6 }}
            />
          </>
        ) : (
          <>
            {!!user?.email && <UText v="body" tone="muted" numberOfLines={1}>{user.email}</UText>}
            <Pill label={`ID ${user?.id?.slice(0, 8).toUpperCase() ?? "—"}`} tone="neutral" icon="finger-print-outline" style={{ marginTop: 6 }} />
          </>
        )}
      </View>

      {/* ── Compte actif : deux comptes séparés (solde, opérations, menus) ── */}
      {canSwitch ? (
        <View style={{ marginBottom: 18 }}>
          <SpaceSwitch />
          <UText v="caption" tone="muted" align="center" style={{ marginTop: 8 }}>
            {isMerchant ? "Compte marchand : solde et paiements de votre commerce, séparés de votre compte client." : "Compte client : vos envois, votre solde et vos opérations personnelles."}
          </UText>
        </View>
      ) : null}

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

      {/* ── Mon commerce (compte marchand) ── */}
      {merchantSpace ? (
        <>
          <SectionHeader title="Mon commerce" />
          <Group>
            {menu("qr-code-outline", "Encaisser", "QR code ou téléphone Orange Money", "/merchant/collect")}
            {menu("cash-outline", "Retirer mes gains", "Solde de votre commerce", "/merchant/payouts")}
            {menu("receipt-outline", "Paiements encaissés", "Historique, remboursements, reçus", "/merchant/payments")}
            {menu("qr-code-outline", "QR de caisse", "QR permanent à afficher ou imprimer", "/merchant/qr")}
            {menu("people-outline", "Équipe de caisse", "Caissiers et droits", "/merchant/staff")}
            {menu("lock-closed-outline", "Clôture & exports", "Fin de journée, PDF et CSV", "/merchant/closing")}
            {menu("shield-checkmark-outline", "Vérifier un reçu", "Scanner le QR d'un reçu PDF", "/pay/verify")}
            {menu("storefront-outline", "Réglages du commerce", "Fiche, logo, alertes, destination des retraits", "/merchant/settings", true)}
          </Group>
          <SectionHeader title="Titulaire du compte" />
          <Group>
            <ListRow
              icon="shield-checkmark-outline"
              title="Vérification d'identité"
              subtitle={kyc?.verified ? "Identité du titulaire vérifiée" : "Identité du titulaire du compte"}
              onPress={() => router.push("/(tabs)/profile/kyc" as any)}
              right={kyc ? <Pill label={KYC_STATUS_LABEL[kyc.status]} tone={kyc.status === "VERIFIED" ? "pos" : kyc.status === "PENDING" ? "info" : "warn"} /> : undefined}
            />
            {menu("person-outline", "Informations personnelles", "Identité et coordonnées du titulaire", "/(tabs)/profile/personal-info")}
            {menu("chatbubbles-outline", "Assistance", "Questions, litiges, suivi de vos demandes", "/(tabs)/profile/support", true)}
          </Group>
        </>
      ) : (
        <>
          {/* ── Mon compte (compte client) ── */}
          <SectionHeader title="Mon compte" />
          <Group>
            {isUser ? (
              <ListRow
                icon="shield-checkmark-outline"
                title="Vérification d'identité"
                subtitle={kyc?.verified ? "Envois et retraits ouverts" : "Obligatoire pour envoyer de l'argent"}
                onPress={() => router.push("/(tabs)/profile/kyc" as any)}
                right={kyc ? <Pill label={KYC_STATUS_LABEL[kyc.status]} tone={kyc.status === "VERIFIED" ? "pos" : kyc.status === "PENDING" ? "info" : "warn"} /> : undefined}
              />
            ) : null}
            {/* Lot 12 : l'accueil ne garde que l'essentiel — tout le reste est ici. */}
            {clientSpace ? menu("scan-outline", "Payer avec un QR code", "Scanner le QR d'un commerce", "/pay/scan") : null}
            {clientSpace ? menu("shield-checkmark-outline", "Vérifier un reçu", "Scanner le QR d'un reçu PDF", "/pay/verify") : null}
            {clientSpace ? menu("notifications-outline", "Demandes à payer", "Paiements demandés par des marchands", "/pay/requests") : null}
            {clientSpace ? menu("qr-code-outline", "Mon QR code", "Recevoir de l'argent d'un proche", "/(tabs)/qr") : null}
            {clientSpace ? menu("people-outline", "Mes bénéficiaires", "Contacts et destinataires", "/(tabs)/beneficiaries") : null}
            {clientSpace ? menu("swap-horizontal", "Taux de change", "Taux du jour", "/(tabs)/rates") : null}
            {clientSpace && isCashier ? menu("storefront-outline", "Caisse", "Encaisser pour un commerce dont vous êtes caissier", "/cashier") : null}
            {clientSpace && !canSwitch ? menu("storefront-outline", "Devenir marchand", "Encaissez par QR code ou par téléphone", "/merchant/activate") : null}
            {menu("person-outline", "Informations personnelles", "Identité, coordonnées", "/(tabs)/profile/personal-info")}
            {menu("card-outline", "Moyens de paiement", "Cartes et comptes enregistrés", "/(tabs)/profile/payment-methods")}
            {menu("speedometer-outline", "Mes plafonds de transfert", "Limites d'envoi", "/(tabs)/profile/limits")}
            {menu("location-outline", `Points ${branding.name}`, "Où déposer et retirer", "/(tabs)/profile/locations", !isUser)}
            {isUser ? menu("chatbubbles-outline", "Assistance", "Questions, litiges, suivi de vos demandes", "/(tabs)/profile/support", true) : null}
          </Group>
        </>
      )}

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

      <ProfilePhotoSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} />

      {/* ── Session ── */}
      <Button label="Fermer la session" icon="log-out-outline" kind="danger" onPress={handleLogout} style={{ marginTop: 28 }} />

      <Pressable
        style={{ alignItems: "center", paddingVertical: 16 }}
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/profile/delete-account" as any)}
        testID="profile-delete-account"
      >
        <UText v="caption" tone="muted" style={{ textDecorationLine: "underline" }}>Supprimer mon compte</UText>
      </Pressable>

      <UText v="label" tone="faint" align="center">{branding.name}{appVersion ? ` · v${appVersion}` : ""}</UText>
    </Screen>
  );
}
