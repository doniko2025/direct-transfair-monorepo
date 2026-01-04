// apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl 
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await api.getMe(); 
    } catch (error) {
      console.log(error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Direct Transf'air</Text>
          <Text style={styles.subtitle}>
            Bonjour {user?.firstName ?? user?.email ?? "Client"}
          </Text>
        </View>
        <Ionicons name="notifications-outline" size={24} color="#333" />
      </View>

      {/* SECTION ACTIONS RAPIDES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Opérations rapides</Text>

        <View style={styles.grid}>
          {/* ✅ CORRECTION : Lien vers (tabs)/send */}
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => router.push("/(tabs)/send")}
          >
            <View style={[styles.iconContainer, { backgroundColor: "#E3F2FD" }]}>
              <Ionicons name="send" size={24} color="#2196F3" />
            </View>
            <Text style={styles.cardText}>Envoyer</Text>
          </TouchableOpacity>

          {/* ✅ CORRECTION : Lien vers (tabs)/beneficiaries */}
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => router.push("/(tabs)/beneficiaries")}
          >
            <View style={[styles.iconContainer, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="people" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.cardText}>Bénéficiaires</Text>
          </TouchableOpacity>

          {/* ✅ CORRECTION : Lien vers (tabs)/transactions */}
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => router.push("/(tabs)/transactions")}
          >
            <View style={[styles.iconContainer, { backgroundColor: "#FFF3E0" }]}>
              <Ionicons name="time" size={24} color="#FF9800" />
            </View>
            <Text style={styles.cardText}>Historique</Text>
          </TouchableOpacity>
          
          {/* ✅ CORRECTION : Lien vers (tabs)/withdraw */}
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => router.push("/(tabs)/withdraw")}
          >
            <View style={[styles.iconContainer, { backgroundColor: "#F3E5F5" }]}>
              <Ionicons name="cash" size={24} color="#9C27B0" />
            </View>
            <Text style={styles.cardText}>Retrait</Text>
          </TouchableOpacity>
        </View>
      </View>

      {user?.role === "ADMIN" && (
        <View style={[styles.section, styles.adminSection]}>
          <Text style={styles.sectionTitle}>Espace Administrateur</Text>
          <TouchableOpacity 
            style={styles.fullWidthButton}
            onPress={() => router.push("/(tabs)/admin/transactions")}
          >
            <Text style={styles.buttonText}>Voir toutes les transactions</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    padding: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#1A1A1A" },
  subtitle: { fontSize: 14, color: "#757575", marginTop: 4 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#1A1A1A" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  iconContainer: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  cardText: { fontSize: 14, fontWeight: "600", color: "#333" },
  adminSection: {
    backgroundColor: "#FFF8E1", marginHorizontal: 20, borderRadius: 16, padding: 20, marginBottom: 30, marginTop: 0
  },
  fullWidthButton: {
    backgroundColor: "#F7931E", paddingVertical: 14, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 14 }
});