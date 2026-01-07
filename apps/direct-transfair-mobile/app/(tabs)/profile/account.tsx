//apps/direct-transfair-mobile/app/(tabs)/profile/account.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { colors } from "../../../theme/colors";

export default function AccountMenuScreen() {
  const router = useRouter();
  
  // ✅ CORRECTION : On utilise "logout" (comme défini dans AuthProvider)
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    // Gestion Web (simple)
    if (Platform.OS === 'web') {
        if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) {
            await logout();
            window.location.reload(); 
        }
        return;
    }

    // Gestion Mobile (Alert Native)
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
        { text: "Annuler", style: "cancel" },
        { 
            text: "Oui", 
            style: "destructive", 
            onPress: async () => {
                await logout(); // ✅ Appel de la bonne fonction
                // On force la navigation vers le login
                if (router.canDismiss()) {
                    router.dismissAll();
                }
                router.replace("/(auth)/login");
            }
        }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon compte</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* IDENTITÉ */}
        <View style={styles.identityBox}>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.clientId}>ID Client : {user?.id?.slice(0, 12).toUpperCase()}</Text>
        </View>

        {/* LISTE DES ACTIONS */}
        <View style={styles.menuList}>
            <AccountMenuItem 
                icon="person-outline" 
                label="Mes informations personnelles"
                onPress={() => router.push("/(tabs)/profile/personal-info")}
            />
            <AccountMenuItem 
                icon="phone-portrait-outline" 
                label="Mes appareils"
                onPress={() => {}}
            />
            <AccountMenuItem 
                icon="keypad-outline" 
                label="Modifier mon code secret"
                onPress={() => {}}
            />
        </View>

        {/* DÉCONNEXION */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>ME DÉCONNECTER</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn}>
            <Ionicons name="warning-outline" size={16} color="#9CA3AF" />
            <Text style={styles.deleteText}>Supprimer mon compte</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function AccountMenuItem({ icon, label, onPress }: any) {
    return (
        <TouchableOpacity style={styles.item} onPress={onPress}>
            <View style={styles.itemIcon}>
                <Ionicons name={icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.itemLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: colors.primary, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  content: { padding: 20 },
  identityBox: { marginBottom: 30 },
  name: { fontSize: 22, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', marginBottom: 4 },
  clientId: { color: '#9CA3AF', fontSize: 14 },
  menuList: { backgroundColor: '#FFF', marginBottom: 40 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemIcon: { marginRight: 16 },
  itemLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1F2937' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderWidth: 1, borderColor: '#DC2626', borderRadius: 8, gap: 10, marginBottom: 20 },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
  deleteBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  deleteText: { color: '#9CA3AF', fontSize: 13 }
});