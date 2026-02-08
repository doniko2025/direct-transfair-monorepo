// apps/direct-transfair-mobile/app/agent/commissions.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import CommissionFilter from "../../components/CommissionFilter";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";

type CommissionItem = {
  id: string;
  origin: string;
  amount: number;
  fees: number;
  agencyCommission: number;
  createdAt: string;
};

export default function AgentCommissionsScreen() {
  const router = useRouter();

  const [period, setPeriod] = useState("day");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.http.get(`/commissions/my-stats?period=${period}`);
      setData(res.data);
    } catch (e) {
      console.log("Erreur commissions:", e);
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>Commissions du jour</Text>
        <Text style={styles.todayAmount}>
          {Number(data?.todayCommissions || 0).toLocaleString()} XOF
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total période</Text>

        <Text style={styles.summaryAmount}>
          {Number(data?.totalCommissions || 0).toLocaleString()} XOF
        </Text>

        <View style={styles.row}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Volume traité</Text>
            <Text style={styles.statValue}>
              {Number(data?.totalVolume || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statLabel}>Opérations</Text>
            <Text style={styles.statValue}>{data?.count || 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name="arrow-back"
          size={24}
          color="#FFF"
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Mes Commissions</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <CommissionFilter selected={period} onSelect={setPeriod} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={(data?.history || []) as CommissionItem[]}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View>
                <Text style={styles.itemType}>{item.origin}</Text>
                <Text style={styles.itemDate}>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString()
                    : "—"}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.itemComm}>
                  + {Number(item.agencyCommission || 0).toLocaleString()} XOF
                </Text>
                <Text style={styles.itemVol}>
                  Montant: {Number(item.amount || 0).toLocaleString()}
                </Text>
                <Text style={styles.itemFees}>
                  Frais: {Number(item.fees || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },

  todayCard: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 14,
    marginTop: 10,
    marginBottom: 12,
  },

  todayLabel: { color: "#9CA3AF", fontSize: 12 },
  todayAmount: { color: "#FFF", fontSize: 26, fontWeight: "900" },

  summaryCard: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },

  summaryLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 5,
  },

  summaryAmount: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 15,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 15,
  },

  stat: { alignItems: "flex-start" },

  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  statValue: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  item: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemType: { fontWeight: "700", color: "#374151" },
  itemDate: { color: "#9CA3AF", fontSize: 12 },
  itemComm: { color: "#059669", fontWeight: "800", fontSize: 16 },
  itemVol: { color: "#9CA3AF", fontSize: 11 },
  itemFees: { color: "#9CA3AF", fontSize: 11 },
});
