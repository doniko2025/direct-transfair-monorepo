// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
// =========================================================
// TAB LAYOUT v5.2 — Direct Transf'air (Modern Minimalist Refresh)
// ✅ FIX : Plus aucun chevauchement d'icônes ou de labels
// ✅ FIX : Suppression définitive de la flèche parasite à droite
// ✅ UI  : Style Fintech premium, épuré et aligné au millimètre
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, GestureResponderEvent,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";

const ROLE_THEMES = {
  SUPER_ADMIN:   { primary: "#D4A853", inactive: "#94A3B8" },
  COMPANY_ADMIN: { primary: "#10B981", inactive: "#94A3B8" },
  AGENT:         { primary: "#F59E0B", inactive: "#94A3B8" },
  USER:          { primary: "#4F46E5", inactive: "#94A3B8" },
} as const;

// ─── Bouton Central Flottant (Glow & Relief) ────────────────
interface CenterButtonProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accent: string;
}
function CenterButton({ children, onPress, accent }: CenterButtonProps) {
  return (
    <TouchableOpacity 
      style={s.centerBtnWrap} 
      onPress={onPress} 
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={[accent, `${accent}DD`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[
          s.centerBtnInner, 
          { 
            shadowColor: accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 6
          }
        ]}
      >
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Onglet Standard Épuré ─────────────────────────────────
function TabIcon({ name, label, focused, accent, inactive }: {
  name: string; label: string;
  focused: boolean; accent: string; inactive: string;
}) {
  return (
    <View style={s.iconContainer}>
      <Ionicons
        name={focused ? name : (`${name}-outline` as any)}
        size={22}
        color={focused ? accent : inactive}
        style={s.icon}
      />
      <Text 
        style={[
          s.label, 
          { 
            color: focused ? "#0F172A" : inactive, 
            fontWeight: focused ? "700" : "500" 
          }
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {/* Indicateur de focus minimaliste (petit point élégant) */}
      {focused && <View style={[s.activeDot, { backgroundColor: accent }]} />}
    </View>
  );
}

// Composant de masquage pour supprimer les onglets parasites
const NullTab = () => null;

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

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
  const isUser  = role === "USER";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 24 : 16,
          left: 16,
          right: 16,
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
          height: 68,
          borderTopWidth: 0,
          // Ombres légères Fintech
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarItemStyle: {
          height: 68,
          justifyContent: "center",
          alignItems: "center",
        }
      }}
    >
      {/* ── 1. Accueil ── */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" label="Accueil" focused={focused} accent={theme.primary} inactive={theme.inactive} />
          ),
        }}
      />

      {/* ── 2. Activité ── */}
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="time" label="Activité" focused={focused} accent={theme.primary} inactive={theme.inactive} />
          ),
        }}
      />

      {/* ── 3. Action Centrale (Bouton Élevé) ── */}
      <Tabs.Screen
        name="send"
        options={
          isUser
            ? {
                tabBarIcon: () => (
                  <Ionicons name="paper-plane" size={22} color="#FFFFFF" style={{ marginLeft: 2, marginBottom: 1 }} />
                ),
                tabBarButton: (props) => <CenterButton {...props} accent={theme.primary} />,
              }
            : { tabBarButton: NullTab }
        }
      />

      <Tabs.Screen
        name="withdraw"
        options={
          isAgent
            ? {
                tabBarIcon: () => <Ionicons name="storefront" size={22} color="#FFFFFF" />,
                tabBarButton: (props) => (
                  <CenterButton {...props} accent={theme.primary} onPress={() => router.push("/agent/withdraw")} />
                ),
              }
            : { tabBarButton: NullTab }
        }
      />

      <Tabs.Screen
        name="admin"
        options={
          isAdmin
            ? {
                tabBarIcon: () => <Ionicons name="stats-chart" size={22} color="#FFFFFF" />,
                tabBarButton: (props) => (
                  <CenterButton {...props} accent={theme.primary} onPress={() => router.push("/(tabs)/admin/agencies")} />
                ),
              }
            : { tabBarButton: NullTab }
        }
      />

      {/* ── 4. Quatrième position (Contacts ou Taux selon rôle) ── */}
      <Tabs.Screen
        name="beneficiaries"
        options={
          isUser
            ? {
                tabBarIcon: ({ focused }) => (
                  <TabIcon name="people" label="Contacts" focused={focused} accent={theme.primary} inactive={theme.inactive} />
                ),
              }
            : { tabBarButton: NullTab }
        }
      />

      <Tabs.Screen
        name="rates"
        options={
          isAdmin || isAgent
            ? {
                tabBarIcon: ({ focused }) => (
                  <TabIcon name="swap-horizontal" label="Taux" focused={focused} accent={theme.primary} inactive={theme.inactive} />
                ),
              }
            : { tabBarButton: NullTab }
        }
      />

      {/* ── 5. Compte ── */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" label="Compte" focused={focused} accent={theme.primary} inactive={theme.inactive} />
          ),
        }}
      />

      {/* ── 🛑 Désactivation complète de toutes les flèches ou onglets parasites ── */}
      <Tabs.Screen name="index"         options={{ tabBarButton: NullTab }} />
      <Tabs.Screen name="qr"            options={{ tabBarButton: NullTab }} />
      <Tabs.Screen name="notifications" options={{ tabBarButton: NullTab }} />
      <Tabs.Screen name="agencies"      options={{ tabBarButton: NullTab }} /> 
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
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: 65, // Donne une zone de clic propre et fixe
    paddingTop: 6,
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    letterSpacing: -0.1,
    textAlign: "center",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: 6,
  },
  centerBtnWrap: {
    top: -16,
    justifyContent: "center",
    alignItems: "center",
    width: 68,
    height: 68,
  },
  centerBtnInner: {
    width: 52, 
    height: 52, 
    borderRadius: 26,
    borderWidth: 4, 
    borderColor: "#FFFFFF",
    justifyContent: "center", 
    alignItems: "center",
  },
});