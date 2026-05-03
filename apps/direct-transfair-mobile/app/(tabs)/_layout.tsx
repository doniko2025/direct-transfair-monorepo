// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
// =========================================================
// TAB LAYOUT v4.1 — Direct Transf'air
// Fix: Correction des types TypeScript sur le bouton central
// Tab bar blanche flottante moderne et responsive
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

// ─── Palettes v4 par rôle ─────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { primary: "#D4A853", inactive: "#C4B89A80" },
  COMPANY_ADMIN: { primary: "#34D399", inactive: "#8A9BB580" },
  AGENT:         { primary: "#F59E0B", inactive: "#A8907080" },
  USER:          { primary: "#10B981", inactive: "#7B9E8A80" },
} as const;

// ─── Bouton central surélevé ─────────────────────────────
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
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={[accent, `${accent}CC`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={[s.centerBtnInner, { shadowColor: accent }]}
      >
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Tab Icon ─────────────────────────────────────────────
function TabIcon({
  name, label, focused, accent, inactive,
}: {
  name: string; label: string;
  focused: boolean; accent: string; inactive: string;
}) {
  return (
    <View style={s.iconContainer}>
      <View style={focused ? [s.iconDot, { backgroundColor: `${accent}20` }] : null}>
        <Ionicons
          name={focused ? name : `${name}-outline` as any}
          size={22}
          color={focused ? accent : inactive}
        />
      </View>
      <Text style={[s.label, { color: focused ? accent : inactive }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────
export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading || !user) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const role = user.role || "USER";
  const theme = ROLE_THEMES[role as keyof typeof ROLE_THEMES] ?? ROLE_THEMES.USER;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 25 : 15,
          left: 20,
          right: 20,
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
          height: 65,
          borderTopWidth: 0,
          // Shadow tab bar
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 10,
        },
      }}
    >
      {/* ── Accueil ── */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="home"
              label="Accueil"
              focused={focused}
              accent={theme.primary}
              inactive={theme.inactive}
            />
          ),
        }}
      />

      {/* ── Activité / Transactions ── */}
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="time"
              label="Activité"
              focused={focused}
              accent={theme.primary}
              inactive={theme.inactive}
            />
          ),
        }}
      />

      {/* ── Bouton central USER : Envoyer ── */}
      <Tabs.Screen
        name="send"
        options={
          role === "USER"
            ? {
                tabBarIcon: () => (
                  <Ionicons
                    name="paper-plane"
                    size={24}
                    color="#FFF"
                    style={{ marginLeft: -2, marginTop: 2 }}
                  />
                ),
                tabBarButton: (props) => (
                  <CenterButton {...props} accent={theme.primary} />
                ),
              }
            : { href: null }
        }
      />

      {/* ── Bouton central AGENT : Retrait ── */}
      <Tabs.Screen
        name="withdraw"
        options={
          role === "AGENT"
            ? {
                tabBarIcon: () => (
                  <Ionicons name="storefront" size={24} color="#FFF" />
                ),
                tabBarButton: (props) => (
                  <CenterButton
                    {...props}
                    accent={theme.primary}
                    onPress={() => router.push("/agent/withdraw")}
                  />
                ),
              }
            : { href: null }
        }
      />

      {/* ── Bouton central ADMIN : Dashboard ── */}
      <Tabs.Screen
        name="admin"
        options={
          role === "COMPANY_ADMIN" || role === "SUPER_ADMIN"
            ? {
                tabBarIcon: () => (
                  <Ionicons name="stats-chart" size={24} color="#FFF" />
                ),
                tabBarButton: (props) => (
                  <CenterButton
                    {...props}
                    accent={theme.primary}
                    onPress={() => router.push("/(tabs)/admin/agencies")}
                  />
                ),
              }
            : { href: null }
        }
      />

      {/* ── Contacts (USER uniquement) ── */}
      <Tabs.Screen
        name="beneficiaries"
        options={
          role === "USER"
            ? {
                tabBarIcon: ({ focused }) => (
                  <TabIcon
                    name="people"
                    label="Contacts"
                    focused={focused}
                    accent={theme.primary}
                    inactive={theme.inactive}
                  />
                ),
              }
            : { href: null }
        }
      />

      {/* ── Compte / Profil ── */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="person"
              label="Compte"
              focused={focused}
              accent={theme.primary}
              inactive={theme.inactive}
            />
          ),
        }}
      />

      {/* ── Routes cachées explicitement ── */}
      <Tabs.Screen name="index"         options={{ href: null }} />
      <Tabs.Screen name="qr"            options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  loader: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "#0B1F14",
  },

  iconContainer: {
    alignItems: "center", justifyContent: "center", paddingTop: 4,
  },
  iconDot: {
    padding: 4, borderRadius: 10,
  },
  label: {
    fontSize: 10, marginTop: 3, fontWeight: "700",
  },

  // Bouton central surélevé
  centerBtnWrap: {
    top: -20,
    justifyContent: "center",
    alignItems: "center",
  },
  centerBtnInner: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 4, borderColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});