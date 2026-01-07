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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { colors } from "../../../theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName}`.toUpperCase()
    : "UTILISATEUR";

  const initials = user?.firstName
    ? user.firstName[0].toUpperCase() + (user.lastName ? user.lastName[0].toUpperCase() : "")
    : "DT";

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
          </View>
        </View>

        {/* BANNIÈRE PARRAINAGE */}
        <View style={styles.referralCard}>
            <View style={styles.referralIcon}>
                <Ionicons name="people" size={24} color="#2563EB" />
            </View>
            <View style={styles.referralContent}>
                <Text style={styles.referralTitle}>Parrainez vos amis</Text>
                <Text style={styles.referralText}>
                    Offrez 10 EUR et gagnez 10 EUR pour chaque ami parrainé !
                </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#2563EB" />
        </View>

        {/* MENU */}
        <View style={styles.menuContainer}>
            
            <MenuCard 
                icon="person-settings" 
                label="Mon compte" 
                color="#DBEAFE"
                iconColor="#2563EB"
                onPress={() => router.push("/(tabs)/profile/account")} 
            />

            <MenuCard 
                icon="people" 
                label="Mes bénéficiaires" 
                color="#E0E7FF"
                iconColor="#4F46E5"
                onPress={() => router.push("/(tabs)/beneficiaries")} 
            />

            <MenuCard 
                icon="storefront" 
                label="Trouver un point Direct Transf'AIR" 
                color="#F3E8FF"
                iconColor="#9333EA"
                // ✅ Vers Locations
                onPress={() => router.push("/(tabs)/profile/locations")} 
            />

            <MenuCard 
                icon="card" 
                label="Mes moyens de paiements" 
                color="#DCFCE7"
                iconColor="#16A34A"
                // ✅ Vers Paiements
                onPress={() => router.push("/(tabs)/profile/payment-methods")} 
            />

            <MenuCard 
                icon="stats-chart" 
                label="Mes plafonds" 
                color="#FEF3C7" // Jaune clair
                iconColor="#D97706"
                // ✅ Vers Plafonds
                onPress={() => router.push("/(tabs)/profile/limits")} 
            />

            <MenuCard 
                icon="help-circle" 
                label="J'ai besoin d'aide" 
                color="#F3F4F6"
                iconColor="#4B5563"
                onPress={() => {}} 
            />

        </View>

        <View style={styles.footer}>
            <Text style={styles.footerText}>Conditions générales d'utilisation et de vente</Text>
            <Text style={styles.version}>Version 2.1.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MenuCard({ icon, label, color, iconColor, onPress }: any) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.iconBox, { backgroundColor: color }]}>
                <Ionicons name={icon} size={22} color={iconColor} />
            </View>
            <Text style={styles.cardLabel}>{label}</Text>
            <View style={styles.chevronBox}>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F3F4F6" },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  avatarContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#2563EB' },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  userPhone: { fontSize: 14, color: '#6B7280' },
  referralCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#2563EB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  referralIcon: { marginRight: 12 },
  referralContent: { flex: 1, marginRight: 8 },
  referralTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  referralText: { fontSize: 12, color: '#4B5563', lineHeight: 16 },
  menuContainer: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1F2937' },
  chevronBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  version: { fontSize: 12, color: '#D1D5DB' },
});