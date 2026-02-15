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
        elevation: 5,
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
          bottom: Platform.OS === "ios" ? 25 : 15,
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
      {/* ACCUEIL */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={focused ? colors.primary : "#9CA3AF"}
              />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>
                Accueil
              </Text>
            </View>
          ),
        }}
      />

      {/* ACTIVITÉ */}
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons
                name={focused ? "time" : "time-outline"}
                size={24}
                color={focused ? colors.primary : "#9CA3AF"}
              />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>
                Activité
              </Text>
            </View>
          ),
        }}
      />

      {/* USER: ENVOI */}
      <Tabs.Screen
        name="send"
        options={
          role === "USER"
            ? {
                tabBarIcon: () => (
                  <Ionicons name="paper-plane" size={28} color="#FFF" style={{ marginLeft: -2, marginTop: 2 }} />
                ),
                tabBarButton: (props) => <CustomTabBarButton {...props} />,
              }
            : { href: null }
        }
      />

      {/* AGENT: GUICHET */}
      <Tabs.Screen
        name="withdraw"
        options={
          role === "AGENT"
            ? {
                tabBarIcon: () => <Ionicons name="storefront" size={28} color="#FFF" />,
                tabBarButton: (props) => (
                  <CustomTabBarButton {...props} onPress={() => router.push("/agent/withdraw")} />
                ),
              }
            : { href: null }
        }
      />

      {/* ADMIN: DASHBOARD */}
      <Tabs.Screen
        name="admin"
        options={
          role.includes("ADMIN")
            ? {
                tabBarIcon: () => <Ionicons name="stats-chart" size={28} color="#FFF" />,
                tabBarButton: (props) => <CustomTabBarButton {...props} />,
              }
            : { href: null }
        }
      />

      {/* CONTACTS */}
      <Tabs.Screen
        name="beneficiaries"
        options={
          role === "USER"
            ? {
                tabBarIcon: ({ focused }) => (
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={focused ? "people" : "people-outline"}
                      size={24}
                      color={focused ? colors.primary : "#9CA3AF"}
                    />
                    <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>
                      Contacts
                    </Text>
                  </View>
                ),
              }
            : { href: null }
        }
      />

      {/* ✅ FIX: agencies/index (route réelle) */}
      <Tabs.Screen name="agencies/index" options={{ href: null }} />

      {/* COMPTE */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={24}
                color={focused ? colors.primary : "#9CA3AF"}
              />
              <Text style={[styles.label, { color: focused ? colors.primary : "#9CA3AF" }]}>
                Compte
              </Text>
            </View>
          ),
        }}
      />

      {/* index masqué */}
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
