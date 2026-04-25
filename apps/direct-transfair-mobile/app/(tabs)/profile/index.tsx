//apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";

// ─── THÈMES DYNAMIQUES ──────────────────────────────────────────────────
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2", text: "#450A0A" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF", text: "#1E3A8A" },
  AGENT: { primary: "#78350F", light: "#FFF7ED", text: "#451A03" },
  USER: { primary: "#065F46", light: "#ECFDF5", text: "#064E3B" },
};

// ─── TYPOGRAPHIES ───────────────────────────────────────────────────────
const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

export default function SuperProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const role = user?.role || "USER";
  const theme = THEMES[role as keyof typeof THEMES] || THEMES.USER;

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : "Client Privilège";

  const initials = user?.firstName
    ? user.firstName[0].toUpperCase() + (user.lastName ? user.lastName[0].toUpperCase() : "")
    : "DT";

  // ─── ACTIONS ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // ✅ Toast Web moderne CENTRÉ avec un fond flouté
      const overlayDiv = document.createElement("div");
      overlayDiv.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.5); z-index:9998; backdrop-filter:blur(4px);";
      
      const confirmDiv = document.createElement("div");
      confirmDiv.innerHTML = `
        <div style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:${theme.primary}; color:white; padding:24px; border-radius:20px; font-family:${FONTS.body}; z-index:9999; box-shadow:0 20px 40px rgba(0,0,0,0.3); text-align:center; min-width: 280px;">
          <p style="margin:0 0 20px 0; font-weight:800; font-size:16px;">Voulez-vous vous déconnecter ?</p>
          <div style="display:flex; gap:12px; justify-content:center;">
            <button id="cancel-btn" style="flex:1; background:rgba(255,255,255,0.2); border:none; color:white; padding:12px; border-radius:12px; font-weight:bold; cursor:pointer;">Annuler</button>
            <button id="confirm-btn" style="flex:1; background:white; color:${theme.primary}; border:none; padding:12px; border-radius:12px; font-weight:bold; cursor:pointer;">Oui</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlayDiv);
      document.body.appendChild(confirmDiv);

      const cleanup = () => {
        confirmDiv.remove();
        overlayDiv.remove();
      };

      document.getElementById("cancel-btn")?.addEventListener("click", cleanup);
      document.getElementById("confirm-btn")?.addEventListener("click", () => {
        cleanup();
        logout();
      });
    } else {
      import("react-native").then(({ Alert }) => {
        Alert.alert(
          "Déconnexion sécurisée",
          "Êtes-vous sûr de vouloir fermer votre session ?",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Me déconnecter", style: "destructive", onPress: () => logout() }
          ]
        );
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <ScrollView contentContainerStyle={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
        
        {/* ─── HEADER IDENTITÉ ─── */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.headerTop}>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
            </View>
            <View style={styles.identity}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.idClient}>ID: {user?.id?.slice(0, 10).toUpperCase()}</Text>
              <View style={[styles.roleBadge, { backgroundColor: theme.light }]}>
                <Text style={[styles.roleText, { color: theme.text }]}>{role.replace("_", " ")}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── CONTENU BLANC ─── */}
        <View style={styles.body}>
          
          {/* Sécurité Globale Jauge */}
          <View style={styles.securityBox}>
            <View style={styles.secHeader}>
              <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
              <Text style={styles.secTitle}>Sécurité du compte</Text>
              <Text style={styles.secScore}>85%</Text>
            </View>
            <View style={styles.secBarBg}>
              <View style={[styles.secBarFill, { backgroundColor: theme.primary, width: "85%" }]} />
            </View>
            <Text style={styles.secHint}>Activez la validation 2FA pour atteindre 100%</Text>
          </View>

          {/* MENU : MON COMPTE */}
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <View style={styles.menuGroup}>
            <MenuRow 
              icon="person-outline" label="Informations personnelles" color={theme.primary}
              onPress={() => router.push("/(tabs)/profile/personal-info")}
            />
            <MenuRow 
              icon="card-outline" label="Moyens de paiement" color={theme.primary}
              onPress={() => router.push("/(tabs)/profile/payment-methods")}
            />
            <MenuRow 
              icon="speedometer-outline" label="Mes plafonds" color={theme.primary}
              onPress={() => router.push("/(tabs)/profile/limits")}
            />
          </View>

          {/* MENU : SÉCURITÉ */}
          <Text style={styles.sectionTitle}>Sécurité & Appareils</Text>
          <View style={styles.menuGroup}>
            <MenuRow 
              icon="phone-portrait-outline" label="Appareils connectés" color={theme.primary}
              onPress={() => router.push("/(tabs)/profile/devices")}
            />
            <MenuRow 
              icon="keypad-outline" label="Modifier mon code secret" color={theme.primary}
              onPress={() => router.push("/(tabs)/profile/security")} 
            />
            <MenuRow 
              icon="finger-print-outline" label="Biométrie (Face ID / Touch ID)" color={theme.primary}
              onPress={() => {}}
              hideChevron
              rightElement={<View style={[styles.toggle, { backgroundColor: theme.primary }]}><View style={styles.toggleKnob}/></View>}
            />
          </View>

          {/* DÉCONNEXION */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="power-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>Fermer la session</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Direct Transf'air v2.1.0 • Build 402</Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, color, onPress, hideChevron, rightElement }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {rightElement ? rightElement : (!hideChevron && <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F9FAFB" },
  header: { padding: 24, paddingBottom: 40 },
  headerTop: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, elevation: 4 },
  avatarText: { fontSize: 28, fontFamily: FONTS.heading, fontWeight: "600" },
  identity: { marginLeft: 20, flex: 1 },
  name: { fontSize: 24, fontFamily: FONTS.heading, color: "#FFF", marginBottom: 4 },
  idClient: { fontSize: 12, fontFamily: FONTS.body, color: "rgba(255,255,255,0.7)", letterSpacing: 1 },
  roleBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  roleText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  
  // ✅ CORRECTION ICI : paddingBottom à 120 pour faire de la place à la barre de navigation
  body: { flex: 1, backgroundColor: "#F9FAFB", borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -20, padding: 24, paddingBottom: 120 },
  
  securityBox: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, marginBottom: 30, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  secHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  secTitle: { flex: 1, marginLeft: 8, fontSize: 14, fontFamily: FONTS.body, fontWeight: "600", color: "#1F2937" },
  secScore: { fontSize: 16, fontFamily: FONTS.body, fontWeight: "800" },
  secBarBg: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, marginBottom: 8 },
  secBarFill: { height: 6, borderRadius: 3 },
  secHint: { fontSize: 11, color: "#6B7280", fontStyle: "italic" },

  sectionTitle: { fontSize: 13, fontFamily: FONTS.body, fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  menuGroup: { backgroundColor: "#FFF", borderRadius: 16, paddingHorizontal: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: FONTS.body, fontWeight: "500", color: "#1F2937" },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: "center", paddingHorizontal: 2 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFF", alignSelf: "flex-end" },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 18, borderRadius: 16, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", marginTop: 10 },
  logoutText: { color: "#DC2626", fontFamily: FONTS.body, fontWeight: "800", fontSize: 15, marginLeft: 8 },
  
  version: { textAlign: "center", marginTop: 24, fontSize: 11, color: "#D1D5DB", fontFamily: FONTS.body },
});