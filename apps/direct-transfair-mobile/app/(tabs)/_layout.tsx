// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
// =========================================================
// TAB LAYOUT v9.2 — TabBar 100% custom (React Native pur)
//
// FIX v9.2 : ajout de <Tabs.Screen name="recharge" /> — nouvel écran
//   de recharge wallet (voir home.tsx v9.9, bouton "Recharger"),
//   poussé depuis le dashboard, pas un onglet visible de la tab bar
//   (même traitement que "qr" et "notifications" ci-dessous).
//
// FIX v9.1 : suppression de <Tabs.Screen name="agencies" />
//   → ce screen n'existe pas à la racine de (tabs)/
//   → il est accessible via routeOverride "/(tabs)/admin/agencies"
//   → sa présence ici causait l'erreur :
//     "No route named agencies exists in nested children"
//
// SOLUTION DÉFINITIVE : on remplace complètement la tabBar
// native par notre propre composant via la prop `tabBar`.
// Résultat : zéro flèche, espacement pixel-perfect garanti,
// bouton central flottant, design pill Option A.
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Pressable,
} from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Type local — évite l'incompatibilité de version avec expo-router
type BottomTabBarProps = {
  state: {
    index: number;
    routes: Array<{ name: string; key: string }>;
  };
  navigation: {
    navigate: (name: string, params?: object) => void;
  };
  descriptors: Record<string, unknown>;
};

const ROLE_THEMES = {
  SUPER_ADMIN:   { primary: "#D4A853", inactive: "#94A3B8" },
  COMPANY_ADMIN: { primary: "#10B981", inactive: "#94A3B8" },
  AGENT:         { primary: "#F59E0B", inactive: "#94A3B8" },
  USER:          { primary: "#4F46E5", inactive: "#94A3B8" },
} as const;

// ─── Définition des tabs par rôle ────────────────────────────
type TabDef = {
  name: string;
  label: string;
  icon: string;
  isCenter?: boolean;
  routeOverride?: string;
};

const USER_TABS: TabDef[] = [
  { name: "home",          label: "Accueil",  icon: "home" },
  { name: "transactions",  label: "Activité", icon: "time" },
  { name: "send",          label: "",         icon: "paper-plane", isCenter: true },
  { name: "beneficiaries", label: "Contacts", icon: "people" },
  { name: "profile",       label: "Compte",   icon: "person" },
];

const AGENT_TABS: TabDef[] = [
  { name: "home",         label: "Accueil",  icon: "home" },
  { name: "transactions", label: "Activité", icon: "time" },
  { name: "withdraw",     label: "",         icon: "storefront", isCenter: true, routeOverride: "/agent/withdraw" },
  { name: "rates",        label: "Taux",     icon: "swap-horizontal" },
  { name: "profile",      label: "Compte",   icon: "person" },
];

const ADMIN_TABS: TabDef[] = [
  { name: "home",         label: "Accueil",  icon: "home" },
  { name: "transactions", label: "Activité", icon: "time" },
  { name: "admin",        label: "",         icon: "stats-chart", isCenter: true, routeOverride: "/(tabs)/admin/agencies" },
  { name: "rates",        label: "Taux",     icon: "swap-horizontal" },
  { name: "profile",      label: "Compte",   icon: "person" },
];

// ─── Composant TabBar 100% custom ────────────────────────────
function CustomTabBar({
  tabs, accent, state, navigation,
}: {
  tabs: TabDef[];
  accent: string;
  state: BottomTabBarProps["state"];
  navigation: BottomTabBarProps["navigation"];
}) {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const pathname = usePathname();

  const bottom = Platform.OS === "ios"
    ? Math.max(insets.bottom, 16) + 8
    : 16;

  return (
    <View style={[s.barWrapper, { bottom }]}>
      {tabs.map((tab) => {
        const isActive =
          pathname.includes(tab.name) ||
          state.routes[state.index]?.name === tab.name;

        if (tab.isCenter) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={s.centerWrap}
              activeOpacity={0.9}
              onPress={() => {
                if (tab.routeOverride) {
                  router.push(tab.routeOverride as any);
                } else {
                  const idx = state.routes.findIndex((r) => r.name === tab.name);
                  if (idx >= 0) navigation.navigate(state.routes[idx].name);
                }
              }}
            >
              <LinearGradient
                colors={[accent, `${accent}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  s.centerBtn,
                  {
                    shadowColor:   accent,
                    shadowOffset:  { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius:  12,
                    elevation:     8,
                  },
                ]}
              >
                <Ionicons name={tab.icon as any} size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          );
        }

        return (
          <Pressable
            key={tab.name}
            style={s.tabItem}
            onPress={() => {
              const idx = state.routes.findIndex((r) => r.name === tab.name);
              if (idx >= 0) navigation.navigate(state.routes[idx].name);
            }}
          >
            <Ionicons
              name={
                isActive
                  ? (tab.icon as any)
                  : (`${tab.icon}-outline` as any)
              }
              size={22}
              color={isActive ? accent : "#94A3B8"}
            />
            <Text
              style={[
                s.tabLabel,
                {
                  color:      isActive ? "#0F172A" : "#94A3B8",
                  fontWeight: isActive ? "700"     : "500",
                },
              ]}
            >
              {tab.label}
            </Text>
            {isActive && (
              <View style={[s.activeDot, { backgroundColor: accent }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Layout par rôle ─────────────────────────────────────────
function RoleLayout({ tabs, accent }: { tabs: TabDef[]; accent: string }) {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <CustomTabBar
          tabs={tabs}
          accent={accent}
          state={props.state}
          navigation={props.navigation}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="send" />
      <Tabs.Screen name="withdraw" />
      <Tabs.Screen name="admin" />
      <Tabs.Screen name="beneficiaries" />
      <Tabs.Screen name="rates" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="qr" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="recharge" />
    </Tabs>
  );
}

// ─── Point d'entrée ──────────────────────────────────────────
export default function TabLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const role  = user.role || "USER";
  const theme = ROLE_THEMES[role as keyof typeof ROLE_THEMES] ?? ROLE_THEMES.USER;

  const isAdmin = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
  const isAgent = role === "AGENT";

  const tabs = isAdmin ? ADMIN_TABS : isAgent ? AGENT_TABS : USER_TABS;

  return <RoleLayout tabs={tabs} accent={theme.primary} />;
}

const s = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },

  barWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 68,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 12,
  },

  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    gap: 2,
  },

  tabLabel: {
    fontSize: 10,
    letterSpacing: -0.1,
    textAlign: "center",
  },

  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },

  centerWrap: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
  },

  centerBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});