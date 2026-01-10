// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
import React from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

// --- BOUTON FLOTTANT (Gros bouton orange) ---
const CustomTabBarButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    style={{
      top: -30,
      justifyContent: "center",
      alignItems: "center",
      ...styles.shadow,
    }}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View
      style={{
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.primary,
        borderWidth: 4,
        borderColor: "#F3F4F6", // Doit matcher la couleur de fond de l'écran
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </View>
  </TouchableOpacity>
);

export default function TabLayout() {
  const { user, isLoading } = useAuth();

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
          bottom: 25,
          left: 20,
          right: 20,
          backgroundColor: "#ffffff",
          borderRadius: 20,
          height: 80, // Hauteur suffisante
          borderTopWidth: 0,
          ...styles.shadow, // Ombre unique (inclut elevation)
        },
      }}
    >
      {/* 1. ACCUEIL */}
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

      {/* 2. ENVOYER (Visible seulement pour USER) */}
      <Tabs.Screen
        name="send"
        options={
          role === 'USER'
            ? {
                // Si c'est un USER, on affiche le bouton personnalisé
                tabBarIcon: () => (
                  <Ionicons name="paper-plane" size={30} color="#FFF" style={{ marginLeft: -2, marginTop: 2 }} />
                ),
                tabBarButton: (props) => <CustomTabBarButton {...props} />,
              }
            : {
                // Sinon, on cache l'onglet complètement
                href: null,
              }
        }
      />

      {/* 3. GUICHET (Visible seulement pour AGENT) */}
      <Tabs.Screen
        name="withdraw"
        options={
          role === 'AGENT'
            ? {
                tabBarIcon: ({ focused }) => (
                   <Ionicons name="storefront" size={28} color="#FFF" />
                ),
                tabBarButton: (props) => <CustomTabBarButton {...props} />,
              }
            : { href: null }
        }
      />

      {/* 4. AGENCES (Visible seulement pour COMPANY_ADMIN) */}
      <Tabs.Screen
        name="agencies"
        options={{
          href: role === 'COMPANY_ADMIN' ? undefined : null,
          tabBarIcon: ({ focused }) => (
             <View style={styles.iconContainer}>
                <Ionicons name="business" size={24} color={focused ? colors.primary : "#9CA3AF"} />
                <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Agences</Text>
             </View>
          ),
        }}
      />

      {/* 5. ADMIN (Visible seulement pour SUPER_ADMIN) */}
      <Tabs.Screen
        name="admin"
        options={{
          href: role === 'SUPER_ADMIN' ? undefined : null,
          tabBarIcon: ({ focused }) => (
             <View style={styles.iconContainer}>
                <Ionicons name="briefcase" size={24} color={focused ? colors.primary : "#9CA3AF"} />
                <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Sociétés</Text>
             </View>
          ),
        }}
      />

      {/* 6. HISTORIQUE */}
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "time" : "time-outline"} size={24} color={focused ? colors.primary : "#9CA3AF"} />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>Historique</Text>
            </View>
          ),
        }}
      />

      {/* 7. COMPTE */}
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

      {/* --- ROUTES MASQUÉES (Navigation interne) --- */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="beneficiaries" options={{ href: null }} /> 
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