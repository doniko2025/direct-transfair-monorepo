// apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import type { Transaction } from "../../services/types";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Charger les transactions récentes
  const loadData = useCallback(async () => {
    try {
      // On récupère tout, mais on ne gardera que les 3 dernières
      const list = await api.getTransactions();
      // Tri par date décroissante
      const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentTransactions(sorted.slice(0, 3));
    } catch (e) {
      console.error("Erreur chargement home", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharge à chaque fois qu'on revient sur l'écran
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID": return "#16a34a"; // Vert
      case "VALIDATED": return "#2563eb"; // Bleu
      case "CANCELLED": return "#dc2626"; // Rouge
      default: return "#d97706"; // Orange (Pending)
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
        case "PAID": return "Payée";
        case "VALIDATED": return "Validée";
        case "CANCELLED": return "Annulée";
        default: return "En attente";
      }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* HEADER DE BIENVENUE */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeLabel}>Bonjour,</Text>
          <Text style={styles.welcomeName}>
            {user?.firstName ? `${user.firstName} ${user.lastName}` : (user?.email || "Client")}
          </Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/(tabs)/profile")}>
           <Text style={styles.profileInitials}>
             {user?.firstName ? user.firstName[0].toUpperCase() : "U"}
           </Text>
        </TouchableOpacity>
      </View>

      {/* CARTE D'ACTION RAPIDE */}
      <View style={styles.actionCard}>
        <View>
            <Text style={styles.cardTitle}>Envoyer de l'argent</Text>
            <Text style={styles.cardSubtitle}>Rapide, sécurisé et à faibles frais.</Text>
        </View>
        <TouchableOpacity style={styles.sendBtn} onPress={() => router.push("/(tabs)/send")}>
            <Text style={styles.sendBtnText}>Envoyer ›</Text>
        </TouchableOpacity>
      </View>

      {/* ADMIN SHORTCUT (Visible seulement si Admin) */}
      {user?.role === "ADMIN" && (
        <TouchableOpacity 
            style={styles.adminBanner} 
            onPress={() => router.push("/(tabs)/admin/transactions")}
        >
            <Ionicons name="shield-checkmark" size={20} color="#b45309" />
            <Text style={styles.adminText}>Espace Admin : Gérer les transactions</Text>
        </TouchableOpacity>
      )}

      {/* RACCORCIS */}
      <View style={styles.shortcuts}>
        <ShortcutItem 
            icon="people" 
            label="Bénéficiaires" 
            color="#e0f2fe" 
            iconColor="#0284c7"
            onPress={() => router.push("/(tabs)/beneficiaries")} 
        />
        <ShortcutItem 
            icon="time" 
            label="Historique" 
            color="#f3e8ff" 
            iconColor="#9333ea"
            onPress={() => router.push("/(tabs)/transactions")} 
        />
        <ShortcutItem 
            icon="cash" 
            label="Retrait" 
            color="#ecfccb" 
            iconColor="#65a30d"
            onPress={() => router.push("/(tabs)/withdraw")} 
        />
        <ShortcutItem 
            icon="settings" 
            label="Profil" 
            color="#f1f5f9" 
            iconColor="#475569"
            onPress={() => router.push("/(tabs)/profile")} 
        />
      </View>

      {/* ACTIVITÉ RÉCENTE */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Activités récentes</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={styles.seeAll}>Voir tout</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
      ) : recentTransactions.length === 0 ? (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucune transaction récente.</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/send")}>
                <Text style={styles.emptyLink}>Faire un premier envoi</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
            {recentTransactions.map((tx) => (
                <View key={tx.id} style={styles.txItem}>
                    <View style={styles.txIcon}>
                        <Text style={styles.txIconText}>💸</Text>
                    </View>
                    <View style={styles.txContent}>
                        <Text style={styles.txRef}>{tx.reference}</Text>
                        <Text style={[styles.txStatus, { color: getStatusColor(tx.status) }]}>
                            {getStatusLabel(tx.status)}
                        </Text>
                    </View>
                    <View style={styles.txRight}>
                        <Text style={styles.txAmount}>
                            {Number(tx.amount).toFixed(2)} {tx.currency}
                        </Text>
                        <Text style={styles.txDate}>
                            {new Date(tx.createdAt).toLocaleDateString("fr-FR", {day: "2-digit", month:"2-digit"})}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Composant Helper pour les boutons ronds
function ShortcutItem({ icon, label, color, iconColor, onPress }: any) {
    return (
        <TouchableOpacity style={styles.shortcut} onPress={onPress}>
            <View style={[styles.iconCircle, { backgroundColor: color }]}>
                <Ionicons name={icon} size={24} color={iconColor} /> 
            </View>
            <Text style={styles.shortcutLabel}>{label}</Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F8F9FA", padding: 20 },
  
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, marginTop: 10 },
  welcomeLabel: { fontSize: 14, color: "#666" },
  welcomeName: { fontSize: 20, fontWeight: "800", color: "#333" },
  profileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  profileInitials: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  actionCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  cardSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 12, maxWidth: 180 },
  sendBtn: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendBtnText: { color: colors.primary, fontWeight: "700", fontSize: 14 },

  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fcd34d',
    gap: 10
  },
  adminText: { color: '#b45309', fontWeight: '700', fontSize: 13 },

  shortcuts: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  shortcut: { alignItems: "center", width: "22%" },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  shortcutLabel: { fontSize: 11, fontWeight: "600", color: "#333", textAlign: 'center' },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  seeAll: { color: colors.primary, fontWeight: "600", fontSize: 14 },

  list: { gap: 12 },
  txItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  txIcon: { width: 40, height: 40, backgroundColor: "#f8fafc", borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12 },
  txIconText: { fontSize: 18 },
  txContent: { flex: 1 },
  txRef: { fontSize: 13, fontWeight: "700", color: "#333", marginBottom: 2 },
  txStatus: { fontSize: 11, fontWeight: "600" },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 16, fontWeight: "800", color: "#333" },
  txDate: { fontSize: 11, color: "#999", marginTop: 2 },

  emptyState: { alignItems: "center", paddingVertical: 20 },
  emptyText: { color: "#999", marginBottom: 8 },
  emptyLink: { color: colors.primary, fontWeight: "700" },
});