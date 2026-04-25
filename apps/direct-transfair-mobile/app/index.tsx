//apps/direct-transfair-mobile/app/index.tsx
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// ─── THÈMES & TYPOGRAPHIES ──────────────────────────────────────────────
const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#059669",     // Vert Émeraude
  primaryDark: "#047857", // Vert profond
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
};

// ─── DÉCORS D'ARRIÈRE-PLAN ──────────────────────────────────────────────
function BgCircles() {
  return (
    <>
      <View style={[styles.circle, { width: 400, height: 400, top: -100, right: -100, opacity: 0.1 }]} />
      <View style={[styles.circle, { width: 250, height: 250, top: "30%", left: -100, opacity: 0.05 }]} />
      <View style={[styles.circle, { width: 150, height: 150, bottom: -50, right: "20%", opacity: 0.08 }]} />
    </>
  );
}

export default function Index() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Animations d'entrée
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />
      
      {/* ─── ARRIÈRE-PLAN ─── */}
      <View style={styles.bg}>
        <BgCircles />
      </View>

      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.content, 
            isDesktop && styles.contentDesktop,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          
          {/* ─── LOGO & TITRE ─── */}
          <View style={styles.logoSection}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <Ionicons name="swap-horizontal" size={40} color={THEME.primary} />
              </View>
            </View>
            <Text style={styles.title}>Direct Transf'air</Text>
            <Text style={styles.subtitle}>
              L'argent sans frontières.{"\n"}Transferts instantanés et sécurisés.
            </Text>
          </View>

          {/* ─── BOUTONS D'ACTION ─── */}
          <View style={styles.actionSection}>
            <TouchableOpacity 
              style={styles.primaryBtn} 
              activeOpacity={0.9}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.primaryBtnText}>Se connecter</Text>
              <Ionicons name="arrow-forward" size={20} color={THEME.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryBtn} 
              activeOpacity={0.8}
              onPress={() => router.replace("/(auth)/register")}
            >
              <Text style={styles.secondaryBtnText}>Devenir client</Text>
            </TouchableOpacity>
          </View>

          {/* ─── FOOTER ─── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              En continuant, vous acceptez nos{" "}
              <Text style={styles.footerLink}>Conditions générales</Text> et notre{" "}
              <Text style={styles.footerLink}>Politique de confidentialité</Text>.
            </Text>
          </View>

        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.primaryDark },
  
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.primary,
  },
  circle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: THEME.white,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: Platform.OS === 'android' ? 60 : 80,
  },
  contentDesktop: {
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },

  // Logo
  logoSection: {
    alignItems: "center",
    marginTop: 40,
  },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  logoInner: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: THEME.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 36,
    fontFamily: FONTS.heading,
    fontWeight: "900",
    color: THEME.white,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.body,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },

  // Actions
  actionSection: {
    width: "100%",
    gap: 16,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.white,
    borderRadius: 20,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
    gap: 10,
  },
  primaryBtnText: {
    color: THEME.primary,
    fontSize: 18,
    fontFamily: FONTS.body,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secondaryBtnText: {
    color: THEME.white,
    fontSize: 16,
    fontFamily: FONTS.body,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: FONTS.body,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
  },
  footerLink: {
    color: THEME.white,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});