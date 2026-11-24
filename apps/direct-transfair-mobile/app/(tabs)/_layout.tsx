// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
// =========================================================
// TAB LAYOUT v12.1 — Clients wallet uniquement (rôle USER)
//
// ✅ v12.2 : CORRECTIF DÉFINITIF « Activité ouvre un détail » — (1) le détail d'une opération ouvert depuis l'accueil / les demandes d'argent
//   passe maintenant par la route « /operation/<id> » (pile principale) et ne se glisse plus dans la pile de l'onglet Activité ;
//   (2) la remise sur la liste est aussi déclenchée si la pile contient plus d'une page ; (3) popToTopOnBlur : quand on quitte
//   l'onglet Activité / Compte / Contacts, sa pile revient seule sur sa liste.
// ✅ v12.1 : CORRECTIF « Activité n'affiche que le détail » — ouvrir une opération depuis l'accueil laissait seule la page
//   Détail dans la pile de l'onglet Activité ; toucher l'onglet rouvrait donc ce détail au lieu de la liste. Désormais,
//   toucher un onglet dont la pile n'est pas sur sa page racine remet d'abord cette pile sur sa liste (Activité, Compte…).
//
// ✅ v12.0 : DESIGN « CORRIDOR » — barre à 4 onglets (Accueil, Activité, Contacts, Compte) comme la maquette :
//   fond blanc, filet vert pâle, icônes Lucide, onglet actif vert forêt coiffé d'une languette jaune.
//   L'envoi se lance depuis le gros bouton jaune de l'accueil ; l'écran « send » reste une route (hors barre).
//   Aucun changement de navigation : mêmes routes, mêmes écrans « poussés ».
// ✅ v11.0 : REFONTE TOTALE en thème clair (maquettes « Flash Transfert »). Barre d'onglets blanche à plat
//   (filet fin en haut, plus de barre flottante), onglet central « Envoyer » en pilule à la couleur
//   d'accent de la société (texte auto-contrasté), onglet actif en noir. Aucun changement de navigation :
//   mêmes routes, mêmes écrans « poussés » (qr, notifications, recharge, rates) hors de la barre.
//   Les libellés sont lus dans une table (aucun texte codé dans le rendu).
//   La barre n'est affichée que sur les 5 écrans racines : sur les écrans « poussés » (détail, reçu, création,
//   sous-pages du compte, QR, taux, recharge, notifications) elle se masque pour laisser la place aux
//   boutons du bas ; chaque écran garde son bouton retour.
// ✅ v10.1 : couleur des onglets = marque du tenant (white-label).
// ✅ v10.0 (phase 5) : l'app mobile est réservée aux clients ; les rôles AGENT / COMPANY_ADMIN /
//   SUPER_ADMIN utilisent le portail web (apps/web-admin).
// ✅ v9.x conservés : TabBar 100 % custom (React Native pur), pas de flèche, écrans « poussés ».
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { View, ActivityIndicator, Platform, Pressable } from 'react-native';
import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from '../../components/ui/Icon';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthProvider";
import { useUI, SYSTEM_FONT } from "../../components/ui/theme";
import { useAccountSpace } from "../../hooks/useAccountSpace";

import { Text } from '../../components/ui/Text';
import { useT } from '../../providers/I18nProvider';
import type { MessageKey } from '../../i18n/catalog';
// Type local — évite l'incompatibilité de version avec expo-router
type BottomTabBarProps = {
  state: { index: number; routes: Array<{ name: string; key: string; state?: { key?: string; routes?: Array<{ name: string }> } }> };
  navigation: { navigate: (name: string, params?: object) => void; dispatch: (action: object) => void };
  descriptors: Record<string, unknown>;
};

// Chemins pour lesquels la barre d'onglets est visible (écrans racines)
const ROOT_PATHS = new Set(["", "/", "/home", "/transactions", "/beneficiaries", "/profile"]);
// Lot 12 : trois onglets seulement (Accueil, Activité / Paiements, Profil). Les bénéficiaires restent une page, ouverte depuis le profil.

type TabDef = { name: string; label: MessageKey; icon: string };

const USER_TABS: TabDef[] = [
  { name: "home",          label: "tab.home",  icon: "home" },
  { name: "transactions",  label: "tab.activity", icon: "time" },
  { name: "profile",       label: "tab.profile",   icon: "person" },
];
const MERCHANT_TABS: TabDef[] = [
  { name: "home",          label: "tab.home",   icon: "home" },
  { name: "transactions",  label: "tab.payments", icon: "time" },
  { name: "profile",       label: "tab.profile",    icon: "person" },
];

function CustomTabBar({ state, navigation }: { state: BottomTabBarProps["state"]; navigation: BottomTabBarProps["navigation"] }) {
  const { C } = useUI();
  const t = useT();
  const { isMerchant } = useAccountSpace();
  const tabs = isMerchant ? MERCHANT_TABS : USER_TABS;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const bottom = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 6);
  const clean = (pathname || "").replace(/\/+$/, "");
  if (!ROOT_PATHS.has(clean)) return null;

  const go = (name: string) => {
    const idx = state.routes.findIndex((r) => r.name === name);
    if (idx < 0) { router.push(`/(tabs)/${name}` as any); return; }
    // La pile interne de l'onglet (Activité, Compte…) se souvient de la dernière page ouverte (ex. un Détail ouvert depuis l'accueil) :
    // on la remet sur sa liste « index » avant d'afficher l'onglet, pour qu'un appui sur l'onglet montre toujours sa page principale.
    const nested = state.routes[idx].state;
    const top = nested?.routes?.[nested.routes.length - 1]?.name;
    if (nested?.key && top && (top !== "index" || (nested.routes?.length ?? 0) > 1)) {
      navigation.dispatch({ type: "RESET", payload: { index: 0, routes: [{ name: "index" }] }, target: nested.key });
    }
    navigation.navigate(state.routes[idx].name);
  };

  return (
    <View
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line,
        flexDirection: "row", alignItems: "flex-start", paddingTop: 10, paddingBottom: bottom, paddingHorizontal: 8,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.name === "home"
          ? clean === "" || clean === "/" || clean === "/home"
          : clean.startsWith(`/${tab.name}`);

        return (
          <Pressable
            key={tab.name}
            style={{ flex: 1, alignItems: "center", gap: 5, paddingBottom: 4 }}
            onPress={() => go(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {isActive && (
              <View style={{ position: "absolute", top: -11, width: 34, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: C.sun }} />
            )}
            <Ionicons name={tab.icon as any} size={22} color={isActive ? C.forest : C.faint} />
            <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 11.5, fontWeight: "600", color: isActive ? C.forest : C.faint }}>
              {t(tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const { C } = useUI();

  if (isLoading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.forest} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar state={props.state as any} navigation={props.navigation as any} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="transactions" options={{ popToTopOnBlur: true }} />
      <Tabs.Screen name="send" />
      <Tabs.Screen name="beneficiaries" options={{ popToTopOnBlur: true }} />
      <Tabs.Screen name="profile" options={{ popToTopOnBlur: true }} />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="qr" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="recharge" />
      <Tabs.Screen name="rates" />
    </Tabs>
  );
}
