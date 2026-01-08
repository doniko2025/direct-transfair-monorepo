// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";
import { ActivityIndicator, View, Platform } from "react-native";

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

  // Helper pour cacher/montrer les onglets selon le rôle
  const showFor = (roles: string[]) => roles.includes(role) ? undefined : null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: role === 'USER' ? colors.primary : '#1F2937', // Orange pour client, Sombre pour Pros
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFF",
          borderTopWidth: 0,
          elevation: 15,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontWeight: "600", fontSize: 10 },
      }}
    >
      {/* --- 1. ACCUEIL (Tout le monde a un accueil différent) --- */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />

      {/* --- 2. FONCTIONNALITÉS SPÉCIFIQUES (Onglet 2) --- */}
      
      {/* CLIENT : Bouton ENVOYER (Central/Flottant) */}
      <Tabs.Screen
        name="send"
        options={{
          title: "Envoyer",
          href: showFor(['USER']),
          tabBarIcon: ({ color }) => (
            <View style={{
                backgroundColor: colors.primary, width: 50, height: 50, borderRadius: 25,
                justifyContent: 'center', alignItems: 'center', marginBottom: 20,
                shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5
            }}>
              <Ionicons name="paper-plane" size={24} color="#FFF" style={{ marginLeft: -2 }} />
            </View>
          ),
          tabBarLabel: () => null, // Pas de texte
        }}
      />

      {/* AGENT : Onglet GUICHET (Dépôt/Retrait) */}
      <Tabs.Screen
        name="withdraw" // On utilisera cette route pour le "Guichet" général
        options={{
          title: "Guichet",
          href: showFor(['AGENT']),
          tabBarIcon: ({ color }) => <Ionicons name="storefront" size={24} color={color} />,
        }}
      />

      {/* ADMIN SOCIÉTÉ : Onglet AGENCES */}
      <Tabs.Screen
        name="agencies" // Créer ce fichier plus tard (liste des agences)
        options={{
          title: "Agences",
          href: showFor(['COMPANY_ADMIN']),
          tabBarIcon: ({ color }) => <Ionicons name="business" size={24} color={color} />,
        }}
      />

      {/* SUPER ADMIN : Onglet SOCIÉTÉS */}
      <Tabs.Screen
        name="admin" // Route existante admin/index
        options={{
          title: "Sociétés",
          href: showFor(['SUPER_ADMIN']),
          tabBarIcon: ({ color }) => <Ionicons name="briefcase" size={24} color={color} />,
        }}
      />


      {/* --- 3. HISTORIQUE / TRANSACTIONS (Onglet 3) --- */}
      <Tabs.Screen
        name="transactions"
        options={{
          title: role === 'SUPER_ADMIN' ? "Finances" : "Historique",
          href: showFor(['USER', 'AGENT', 'COMPANY_ADMIN', 'SUPER_ADMIN']), // Tout le monde
          tabBarIcon: ({ color }) => <Ionicons name={role === 'SUPER_ADMIN' ? "pie-chart" : "time"} size={24} color={color} />,
        }}
      />

      {/* --- 4. COMPTE / PROFIL (Onglet 4) --- */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Compte",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />

      {/* --- ROUTES CACHÉES (Pas dans la barre) --- */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="beneficiaries" options={{ href: null }} /> 
    </Tabs>
  );
}