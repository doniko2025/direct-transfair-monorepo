// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
// =========================================================
// TAB LAYOUT v10.1 — Clients wallet uniquement (rôle USER)
//
// ✅ v10.1 : la couleur des onglets suit la marque du tenant (white-label) au lieu de l'indigo codé en
//   dur, pour rester cohérente avec les écrans wallet refaits (components/wallet). Aucun changement de
//   navigation.
//
// ✅ v10.0 (phase 5) : l'app mobile est réservée aux clients.
//   Les onglets et thèmes des rôles AGENT / COMPANY_ADMIN /
//   SUPER_ADMIN, ainsi que les écrans « admin » et « withdraw »
//   (guichet agent), ont été supprimés : ces rôles utilisent le
//   portail web (apps/web-admin). Une session d'un autre rôle est
//   fermée par AuthProvider avant d'arriver ici.
//
// ✅ v9.x conservés : TabBar 100% custom (React Native pur),
//   bouton central flottant, pas de flèche, écrans « poussés »
//   (qr, notifications, recharge, rates) hors de la barre.
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
import { useWalletTheme } from "../../components/wallet/walletTheme";

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

const FALLBACK_ACCENT = "#059669";

// ─── Onglets du client ───────────────────────────────────────
type TabDef = {
  name: string;
  label: string;
  icon: string;
  isCenter?: boolean;
};

const USER_TABS: TabDef[] = [
  { name: "home",          label: "Accueil",  icon: "home" },
  { name: "transactions",  label: "Activité", icon: "time" },
  { name: "send",          label: "",         icon: "paper-plane", isCenter: true },
  { name: "beneficiaries", label: "Contacts", icon: "people" },
  { name: "profile",       label: "Compte",   icon: "person" },
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
                const idx = state.routes.findIndex((r) => r.name === tab.name);
                if (idx >= 0) navigation.navigate(state.routes[idx].name);
                else router.push(`/(tabs)/${tab.name}` as any);
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

// ─── Point d'entrée ──────────────────────────────────────────
export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const { P } = useWalletTheme();
  const ACCENT = P.action || FALLBACK_ACCENT;

  if (isLoading || !user) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <CustomTabBar
          tabs={USER_TABS}
          accent={ACCENT}
          state={props.state}
          navigation={props.navigation}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="send" />
      <Tabs.Screen name="beneficiaries" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="qr" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="recharge" />
      <Tabs.Screen name="rates" />
    </Tabs>
  );
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
