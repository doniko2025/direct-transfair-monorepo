// apps/direct-transfair-mobile/app/_layout.tsx
import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { colors } from "../theme/colors";

function Splash() {
  return (
    <View style={styles.splashContainer}>
      <StatusBar style="light" />
      <Text style={styles.splashTitle}>Direct Transf'air</Text>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

function RootStack() {
  const { loading, token } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    const inAuth = root === "(auth)";
    const inTabs = root === "(tabs)";

    if (!token && !inAuth) {
      router.replace("/(auth)/login");
    }

    if (token && !inTabs) {
      router.replace("/(tabs)/home");
    }
  }, [loading, token, segments, router]);

  if (loading) return <Splash />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 16,
  },
});
