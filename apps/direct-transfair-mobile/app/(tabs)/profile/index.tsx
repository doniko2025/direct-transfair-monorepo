//apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform, // ✅ Import Platform
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { colors } from "../../../theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth(); 

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName}`.toUpperCase()
    : "UTILISATEUR";

  const initials = user?.firstName
    ? user.firstName[0].toUpperCase() + (user.lastName ? user.lastName[0].toUpperCase() : "")
    : "DT";

  // ✅ GESTIONNAIRE DE DÉCONNEXION COMPATIBLE WEB
  const handleLogout = () => {
      if (Platform.OS === 'web') {
          // Sur PC, Alert.alert ne marche pas toujours bien, on utilise window.confirm
          if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) {
              logout();
          }
      } else {
          // Sur Mobile
          Alert.alert(
              "Déconnexion", 
              "Voulez-vous vraiment vous déconnecter ?",
              [
                  { text: "Annuler", style: "cancel" },
                  { 
                      text: "Me déconnecter", 
                      style: "destructive", 
                      onPress: async () => {
                          await logout();
                      }
                  }
              ]
          );
      }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#F3F4F6" barStyle="dark-content" />
      
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* HEADER USER */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userPhone}>{user?.phone || user?.email}</Text>
            <Text style={styles.userId}>ID Client : {user?.id?.substring(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* MENU PRINCIPAL */}
        <View style={styles.menuContainer}>
            
            <MenuCard 
                icon="person-outline" 
                label="Mes informations personnelles" 
                onPress={() => router.push("/(tabs)/profile/account")} 
            />

            <MenuCard 
                icon="phone-portrait-outline" 
                label="Mes appareils" 
                onPress={() => {}} 
            />

            <MenuCard 
                icon="keypad-outline" 
                label="Modifier mon code secret" 
                onPress={() => {}} 
            />

             {/* Sections Admin si nécessaire */}
             {(user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <MenuCard 
                    icon="business-outline" 
                    label="Gérer mes agences" 
                    color="#F0FDF4"
                    onPress={() => router.push("/(tabs)/admin/agencies")} 
                />
             )}

        </View>

        {/* ✅ BOUTON DÉCONNEXION */}
        <View style={styles.logoutContainer}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{marginRight: 8}} />
                <Text style={styles.logoutText}>ME DÉCONNECTER</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteLink} onPress={() => Alert.alert("Attention", "Contactez le support pour supprimer votre compte.")}>
                <Ionicons name="warning-outline" size={14} color="#9CA3AF" />
                <Text style={styles.deleteText}>Supprimer mon compte</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.footer}>
            <Text style={styles.version}>Version 2.1.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MenuCard({ icon, label, color = "#FFF", onPress }: any) {
    return (
        <TouchableOpacity style={[styles.card, {backgroundColor: color}]} onPress={onPress}>
            <View style={styles.row}>
                <Ionicons name={icon} size={22} color="#F59E0B" style={{marginRight: 15}} />
                <Text style={styles.cardLabel}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  container: { padding: 20, paddingBottom: 40 },
  
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, backgroundColor: colors.primary, padding: 20, borderRadius: 16 },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  userPhone: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  userId: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  menuContainer: { gap: 12, marginBottom: 40 },
  card: { borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: "#000", shadowOpacity: 0.05, elevation: 1, backgroundColor:'#FFF' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#1F2937' },

  logoutContainer: { marginTop: 10, gap: 15 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.danger, backgroundColor: '#FEF2F2' },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  deleteLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  deleteText: { color: '#9CA3AF', fontSize: 12, textDecorationLine: 'underline' },

  footer: { marginTop: 30, alignItems: 'center' },
  version: { fontSize: 12, color: '#D1D5DB' },
});