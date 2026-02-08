// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

// --- BOUTON CENTRAL FLOTTANT ---
const CustomTabBarButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    style={{
      top: -25,
      justifyContent: "center",
      alignItems: "center",
      ...styles.shadow,
    }}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View
      style={{
        width: 65,
        height: 65,
        borderRadius: 32.5,
        backgroundColor: colors.primary,
        borderWidth: 4,
        borderColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
        elevation: 5
      }}
    >
      {children}
    </View>
  </TouchableOpacity>
);

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const role = user.role;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === 'ios' ? 25 : 15,
          left: 15,
          right: 15,
          backgroundColor: "#ffffff",
          borderRadius: 20,
          height: 70,
          borderTopWidth: 0,
          ...styles.shadow,
        },
      }}
    >
      {/* 1. ACCUEIL (Pour TOUS) */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={focused ? colors.primary : "#9CA3AF"} />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Accueil</Text>
            </View>
          ),
        }}
      />

      {/* 2. HISTORIQUE / ACTIVITÉ (Pour TOUS) */}
      <Tabs.Screen
        name="transactions"
        options={{
          // On cache l'onglet historique standard pour les Admins s'ils ont leur propre dashboard, sinon on laisse visible
          // Ici je laisse visible pour simplifier, sauf si tu veux le cacher
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "time" : "time-outline"} size={24} color={focused ? colors.primary : "#9CA3AF"} />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Activité</Text>
            </View>
          ),
        }}
      />

      {/* --- BOUTONS CENTRAUX (Conditionnels) --- */}
      {/* CORRECTIF : On sépare complètement les objets options pour éviter le conflit href/tabBarButton */}

      {/* USER: Envoyer */}
      <Tabs.Screen
        name="send"
        options={
          role === 'USER'
            ? {
                tabBarIcon: () => <Ionicons name="paper-plane" size={28} color="#FFF" style={{ marginLeft: -2, marginTop: 2 }} />,
                tabBarButton: (props) => <CustomTabBarButton {...props} />,
              }
            : { href: null } // Si pas USER, on cache et on ne définit PAS de bouton
        }
      />

      {/* AGENT: Guichet */}
      <Tabs.Screen
        name="withdraw"
        options={
          role === 'AGENT'
            ? {
                tabBarIcon: () => <Ionicons name="storefront" size={28} color="#FFF" />,
                // Redirection forcée vers l'écran Guichet de l'agent
                tabBarButton: (props) => (
                  <CustomTabBarButton {...props} onPress={() => router.push("/agent/withdraw")} />
                ),
              }
            : { href: null }
        }
      />

      {/* ADMIN: Dashboard */}
      <Tabs.Screen
        name="admin"
        options={
          role.includes('ADMIN')
            ? {
                tabBarIcon: () => <Ionicons name="stats-chart" size={28} color="#FFF" />,
                tabBarButton: (props) => <CustomTabBarButton {...props} />,
              }
            : { href: null }
        }
      />

      {/* --- AUTRES ONGLETS --- */}

      {/* CONTACTS (User seulement) */}
      <Tabs.Screen
        name="beneficiaries"
        options={
          role === 'USER'
            ? {
                tabBarIcon: ({ focused }) => (
                  <View style={styles.iconContainer}>
                    <Ionicons name={focused ? "people" : "people-outline"} size={24} color={focused ? colors.primary : "#9CA3AF"} />
                    <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Contacts</Text>
                  </View>
                ),
              }
            : { href: null }
        }
      />

      {/* AGENCES (MASQUÉ POUR TOUS - Route technique accessible via dashboard admin) */}
      <Tabs.Screen name="agencies" options={{ href: null }} />

      {/* COMPTE (Pour TOUS) */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={focused ? colors.primary : "#9CA3AF"} />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Compte</Text>
            </View>
          ),
        }}
      />

      {/* Index masqué */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#7F5DF0",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 5,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    top: 0,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
  },
});