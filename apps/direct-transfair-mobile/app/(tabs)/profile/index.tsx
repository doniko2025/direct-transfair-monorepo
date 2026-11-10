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
import { useThemeLabel } from "../../../components/theme/ThemeSwitcher";
import { useI18n, useT } from "../../../providers/I18nProvider";
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
  const t = useT();
  const { info } = useI18n();
  const themeLabel = useThemeLabel();   // abonne aussi l'écran au changement de thème
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
      Alert.alert(t("prof.bioUnavailTitle"), t("prof.bioUnavailMsg"));
      return;
    }
    if (!bioEnabled) {
      const ok = await promptBiometrics(t("prof.bioPrompt"));
      if (!ok) return;
      await setBiometricsEnabled(true);
      setBioEnabledState(true);
      Alert.alert(t("prof.bioOnTitle"), t("prof.bioOnMsg"));
    } else {
      Alert.alert(
        t("prof.bioOffTitle"),
        t("prof.bioOffMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("prof.disable"), style: "destructive", onPress: async () => { await setBiometricsEnabled(false); setBioEnabledState(false); } },
        ],
      );
    }
  };

  const personName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : t("prof.user");
  // Compte marchand : c'est le COMMERCE qui est présenté ; la personne n'apparaît que comme titulaire.
  const displayName = merchantSpace && shop?.businessName ? shop.businessName : personName;

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("prof.logoutWeb", { brand: branding.name }))) void logout();
      return;
    }
    Alert.alert(
      t("prof.logoutTitle"),
      t("prof.logoutMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("prof.logoutConfirm"), style: "destructive",
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
          <Pressable onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel={t("prof.changePhoto")} hitSlop={8}>
            <Avatar name={displayName} size={88} uri={photo} />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.ink, borderWidth: 2, borderColor: C.bg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="camera-outline" size={15} color={C.surface} />
            </View>
          </Pressable>
        )}
        <UText v="title" style={{ marginTop: 10 }} numberOfLines={1}>{displayName}</UText>
        {merchantSpace ? (
          <>
            <UText v="body" tone="muted" numberOfLines={1}>{[shop?.category, shop?.city].filter(Boolean).join(" · ") || t("prof.holder", { name: personName })}</UText>
            <Pill
              label={shop?.status === "SUSPENDED" ? t("prof.shopSuspended") : t("prof.shopActive")}
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
            {isMerchant ? t("prof.spaceMerchant") : t("prof.spaceClient")}
          </UText>
        </View>
      ) : null}

      {/* ── Sécurité du compte ── */}
      <Card tone="accent">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <UText v="subheading">{t("prof.security")}</UText>
            <UText v="caption" tone="muted" style={{ marginTop: 2 }}>
              {bioEnabled ? t("prof.secFull") : t("prof.secHint")}
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
          <SectionHeader title={t("prof.myShop")} />
          <Group>
            {menu("qr-code-outline", t("prof.collect"), t("prof.collectSub"), "/merchant/collect")}
            {menu("cash-outline", t("prof.withdraw"), t("prof.withdrawSub"), "/merchant/payouts")}
            {menu("receipt-outline", t("prof.payments"), t("prof.paymentsSub"), "/merchant/payments")}
            {menu("qr-code-outline", t("prof.shopQr"), t("prof.shopQrSub"), "/merchant/qr")}
            {menu("people-outline", t("prof.staff"), t("prof.staffSub"), "/merchant/staff")}
            {menu("lock-closed-outline", t("prof.closing"), t("prof.closingSub"), "/merchant/closing")}
            {menu("shield-checkmark-outline", t("prof.verifyReceipt"), t("prof.verifyReceiptSub"), "/pay/verify")}
            {menu("storefront-outline", t("prof.shopSettings"), t("prof.shopSettingsSub"), "/merchant/settings", true)}
          </Group>
          <SectionHeader title={t("prof.holderTitle")} />
          <Group>
            <ListRow
              icon="shield-checkmark-outline"
              title={t("prof.kyc")}
              subtitle={kyc?.verified ? t("prof.kycHolderOk") : t("prof.kycHolder")}
              onPress={() => router.push("/(tabs)/profile/kyc" as any)}
              right={kyc ? <Pill label={KYC_STATUS_LABEL[kyc.status]} tone={kyc.status === "VERIFIED" ? "pos" : kyc.status === "PENDING" ? "info" : "warn"} /> : undefined}
            />
            {menu("person-outline", t("prof.personal"), t("prof.personalHolder"), "/(tabs)/profile/personal-info")}
            {menu("chatbubbles-outline", t("prof.support"), t("prof.supportSub"), "/(tabs)/profile/support", true)}
          </Group>
        </>
      ) : (
        <>
          {/* ── Mon compte (compte client) ── */}
          <SectionHeader title={t("prof.myAccount")} />
          <Group>
            {isUser ? (
              <ListRow
                icon="shield-checkmark-outline"
                title={t("prof.kyc")}
                subtitle={kyc?.verified ? t("prof.kycOk") : t("prof.kycRequired")}
                onPress={() => router.push("/(tabs)/profile/kyc" as any)}
                right={kyc ? <Pill label={KYC_STATUS_LABEL[kyc.status]} tone={kyc.status === "VERIFIED" ? "pos" : kyc.status === "PENDING" ? "info" : "warn"} /> : undefined}
              />
            ) : null}
            {/* Lot 12 : l'accueil ne garde que l'essentiel — tout le reste est ici. */}
            {clientSpace ? menu("scan-outline", t("prof.payQr"), t("prof.payQrSub"), "/pay/scan") : null}
            {clientSpace ? menu("shield-checkmark-outline", t("prof.verifyReceipt"), t("prof.verifyReceiptSub"), "/pay/verify") : null}
            {clientSpace ? menu("notifications-outline", t("prof.requests"), t("prof.requestsSub"), "/pay/requests") : null}
            {clientSpace ? menu("qr-code-outline", t("prof.myQr"), t("prof.myQrSub"), "/(tabs)/qr") : null}
            {clientSpace ? menu("people-outline", t("prof.beneficiaries"), t("prof.beneficiariesSub"), "/(tabs)/beneficiaries") : null}
            {clientSpace ? menu("swap-horizontal", t("prof.rates"), t("prof.ratesSub"), "/(tabs)/rates") : null}
            {clientSpace && isCashier ? menu("storefront-outline", t("prof.cashier"), t("prof.cashierSub"), "/cashier") : null}
            {clientSpace && !canSwitch ? menu("storefront-outline", t("prof.becomeMerchant"), t("prof.becomeMerchantSub"), "/merchant/activate") : null}
            {menu("person-outline", t("prof.personal"), t("prof.personalSub"), "/(tabs)/profile/personal-info")}
            {menu("card-outline", t("prof.payMethods"), t("prof.payMethodsSub"), "/(tabs)/profile/payment-methods")}
            {menu("speedometer-outline", t("prof.limits"), t("prof.limitsSub"), "/(tabs)/profile/limits")}
            {menu("location-outline", t("prof.points", { brand: branding.name }), t("prof.pointsSub"), "/(tabs)/profile/locations", !isUser)}
            {isUser ? menu("chatbubbles-outline", t("prof.support"), t("prof.supportSub"), "/(tabs)/profile/support", true) : null}
          </Group>
        </>
      )}

      {/* ── Préférences : thème clair / sombre + langue (FR / EN / PT) ── */}
      <SectionHeader title={t("th.title")} />
      <Group>
        {menu("palette", t("th.title"), t("th.rowSub", { theme: themeLabel, lang: `${info.flag} ${info.label}` }), "/(tabs)/profile/preferences", true)}
      </Group>

      {/* ── Sécurité & appareils ── */}
      <SectionHeader title={t("prof.secDevices")} />
      <Group>
        {menu("phone-portrait-outline", t("prof.devices"), t("prof.devicesSub"), "/(tabs)/profile/devices")}
        {menu("keypad-outline", t("prof.changePin"), undefined, "/(tabs)/profile/security")}
        <ListRow
          icon="finger-print-outline"
          title={bioAvailable ? t("prof.bio") : t("prof.bioNone")}
          subtitle={bioAvailable ? t("prof.bioSub") : t("prof.bioNoneSub")}
          onPress={bioAvailable ? handleToggleBio : undefined}
          right={<Toggle value={bioEnabled} onValueChange={handleToggleBio} disabled={!bioAvailable} />}
          last
        />
      </Group>

      <ProfilePhotoSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} />

      {/* ── Session ── */}
      <Button label={t("prof.logout")} icon="log-out-outline" kind="danger" onPress={handleLogout} style={{ marginTop: 28 }} />

      <Pressable
        style={{ alignItems: "center", paddingVertical: 16 }}
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/profile/delete-account" as any)}
        testID="profile-delete-account"
      >
        <UText v="caption" tone="muted" style={{ textDecorationLine: "underline" }}>{t("prof.deleteAccount")}</UText>
      </Pressable>

      <UText v="label" tone="faint" align="center">{branding.name}{appVersion ? ` · v${appVersion}` : ""}</UText>
    </Screen>
  );
}
