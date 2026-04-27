// apps/direct-transfair-mobile/app/(tabs)/_layout.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";

const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D" },
  COMPANY_ADMIN: { primary: "#1E3A8A" },
  AGENT: { primary: "#78350F" },
  USER: { primary: "#059669" },
};

const CustomTabBarButton = ({ children, onPress, themeColor }: any) => (
  <TouchableOpacity style={[styles.customBtn, styles.shadow]} onPress={onPress} activeOpacity={0.9}>
    <View style={[styles.customBtnInner, { backgroundColor: themeColor }]}>
      {children}
    </View>
  </TouchableOpacity>
);

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading || !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  const role = user.role || "USER";
  const theme = THEMES[role as keyof typeof THEMES] || THEMES.USER;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 25 : 15,
          left: 20, right: 20,
          backgroundColor: "#FFFFFF",
          borderRadius: 24, height: 65, borderTopWidth: 0,
          ...styles.shadow,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ focused }) => (<View style={styles.iconContainer}><Ionicons name={focused ? "home" : "home-outline"} size={22} color={focused ? theme.primary : "#9CA3AF"} /><Text style={[styles.label, { color: focused ? theme.primary : "#9CA3AF" }]}>Accueil</Text></View>) }} />
      <Tabs.Screen name="transactions" options={{ tabBarIcon: ({ focused }) => (<View style={styles.iconContainer}><Ionicons name={focused ? "time" : "time-outline"} size={22} color={focused ? theme.primary : "#9CA3AF"} /><Text style={[styles.label, { color: focused ? theme.primary : "#9CA3AF" }]}>Activité</Text></View>) }} />
      
      <Tabs.Screen name="send" options={role === "USER" ? { tabBarIcon: () => <Ionicons name="paper-plane" size={24} color="#FFF" style={{ marginLeft: -2, marginTop: 2 }} />, tabBarButton: (props) => <CustomTabBarButton {...props} themeColor={theme.primary} /> } : { href: null }} />
      <Tabs.Screen name="withdraw" options={role === "AGENT" ? { tabBarIcon: () => <Ionicons name="storefront" size={24} color="#FFF" />, tabBarButton: (props) => <CustomTabBarButton {...props} themeColor={theme.primary} onPress={() => router.push("/agent/withdraw")} /> } : { href: null }} />
      <Tabs.Screen name="admin" options={role.includes("ADMIN") ? { tabBarIcon: () => <Ionicons name="stats-chart" size={24} color="#FFF" />, tabBarButton: (props) => <CustomTabBarButton {...props} themeColor={theme.primary} onPress={() => router.push("/(tabs)/admin/agencies")} /> } : { href: null }} />
      
      <Tabs.Screen name="beneficiaries" options={role === "USER" ? { tabBarIcon: ({ focused }) => (<View style={styles.iconContainer}><Ionicons name={focused ? "people" : "people-outline"} size={22} color={focused ? theme.primary : "#9CA3AF"} /><Text style={[styles.label, { color: focused ? theme.primary : "#9CA3AF" }]}>Contacts</Text></View>) } : { href: null }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => (<View style={styles.iconContainer}><Ionicons name={focused ? "person" : "person-outline"} size={22} color={focused ? theme.primary : "#9CA3AF"} /><Text style={[styles.label, { color: focused ? theme.primary : "#9CA3AF" }]}>Compte</Text></View>) }} />

      {/* ✅ CACHE EXPLICITEMENT TOUTES LES AUTRES ROUTES DU DOSSIER (TABS) */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="qr" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shadow: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
  iconContainer: { alignItems: "center", justifyContent: "center", top: 2 },
  label: { fontSize: 10, marginTop: 4, fontWeight: "600" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  customBtn: { top: -20, justifyContent: "center", alignItems: "center" },
  customBtnInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: "#FFFFFF", justifyContent: "center", alignItems: "center", elevation: 6 }
});