// apps/direct-transfair-mobile/app/(tabs)/admin/clients/details.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../../../theme/colors";
import { api } from "../../../../services/api";
import type { Client, ClientSubscriptionStatus } from "../../../../services/types";

type Params = { id?: string | string[] };

function getParamId(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function isDigitsOnly(s: string): boolean {
  return /^[0-9]+$/.test(s);
}

function getWebConfirm(): ((msg: string) => boolean) | null {
  if (Platform.OS !== "web") return null;
  const w = globalThis as unknown as { confirm?: (msg: string) => boolean };
  return typeof w.confirm === "function" ? w.confirm : null;
}

export default function ClientDetailsScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();

  const idStr = getParamId(params.id);
  const clientId = idStr && isDigitsOnly(idStr) ? Number(idStr) : NaN;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!Number.isFinite(clientId)) {
      setErrorMsg("ID société invalide.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await api.getClient(clientId);
      setClient(data);
    } catch (e) {
      const err = e as { response?: { status?: number } };
      if (err.response?.status === 404) {
        setErrorMsg("Société introuvable (404).");
      } else {
        setErrorMsg("Erreur lors du chargement.");
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      void fetchDetails();
      return () => {};
    }, [fetchDetails]),
  );

  const handleToggleStatus = useCallback(async () => {
    if (!client || processing) return;

    const current = String(client.subscriptionStatus ?? "").toUpperCase();
    const nextStatus: ClientSubscriptionStatus =
      current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    const run = async () => {
      setProcessing(true);
      try {
        const updated = await api.updateClientStatus(client.id, nextStatus);
        setClient(updated);
      } catch {
        Platform.OS === "web"
          ? alert("Impossible de changer le statut.")
          : Alert.alert("Erreur", "Impossible de changer le statut.");
      } finally {
        setProcessing(false);
      }
    };

    const confirmWeb = getWebConfirm();
    if (confirmWeb) {
      if (confirmWeb("Changer le statut de la société ?")) await run();
      return;
    }

    Alert.alert("Confirmation", "Changer le statut de la société ?", [
      { text: "Annuler", style: "cancel" },
      { text: "OUI", onPress: () => void run() },
    ]);
  }, [client, processing]);

  const handleDelete = useCallback(async () => {
    if (!client || processing) return;

    const run = async () => {
      setProcessing(true);
      try {
        await api.deleteClient(client.id);
        if (Platform.OS === "web") {
          alert("Société supprimée !");
          router.back();
        } else {
          Alert.alert("Succès", "Société supprimée !", [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } catch {
        Platform.OS === "web"
          ? alert("Erreur lors de la suppression.")
          : Alert.alert("Erreur", "Impossible de supprimer.");
      } finally {
        setProcessing(false);
      }
    };

    const confirmWeb = getWebConfirm();
    if (confirmWeb) {
      if (confirmWeb("Supprimer cette société ? Action irréversible.")) await run();
      return;
    }

    Alert.alert("Confirmation", "Supprimer cette société ? Action irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: () => void run() },
    ]);
  }, [client, processing, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#111827", fontWeight: "700", marginBottom: 8 }}>
          Détails société
        </Text>
        <Text style={{ color: "#6B7280", textAlign: "center" }}>{errorMsg}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.center}>
        <Text>Société introuvable</Text>
      </View>
    );
  }

  const statusUp = String(client.subscriptionStatus ?? "").toUpperCase();
  const isActive = statusUp === "ACTIVE";

  const badgeBg = isActive ? "#D1FAE5" : "#FEE2E2";
  const badgeFg = isActive ? "#065F46" : "#991B1B";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{client.name}</Text>

        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.topLabel}>Code Société</Text>
            <Text style={styles.topValue}>{client.code}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
            <Text style={{ color: badgeFg, fontWeight: "800", fontSize: 12 }}>
              {statusUp || "N/A"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS</Text>
          <InfoRow label="Email" value={client.email ?? "N/A"} icon="mail" />
          <InfoRow label="Téléphone" value={client.phone ?? "N/A"} icon="call" />
          <InfoRow label="Adresse" value={client.address ?? "N/A"} icon="map" />
          <InfoRow label="Type abonnement" value={String(client.subscriptionType ?? "N/A")} icon="card" />
          <View style={styles.divider} />
          <InfoRow label="Utilisateurs" value={String(client._count?.users ?? 0)} icon="people" />
          <InfoRow label="Agences" value={String(client._count?.agencies ?? 0)} icon="business" />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 15, marginBottom: 10 }]}>
          ACTIONS SENSIBLES
        </Text>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnSuspend]}
            onPress={handleToggleStatus}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <>
                <Ionicons
                  name={isActive ? "pause" : "play"}
                  size={18}
                  color="#D97706"
                />
                <Text style={styles.btnTextSuspend}>
                  {isActive ? "Suspendre" : "Activer"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.btnDelete]}
            onPress={handleDelete}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Ionicons name="trash" size={18} color="#DC2626" />
                <Text style={styles.btnTextDelete}>Supprimer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow(props: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const { label, value, icon } = props;
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconSmall}>
        <Ionicons name={icon} size={16} color="#6B7280" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  backBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "#fff", fontWeight: "800" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },

  content: { padding: 20 },

  cardTop: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    elevation: 5,
  },
  topLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700" },
  topValue: { color: "#FFF", fontSize: 20, fontWeight: "900", marginTop: 6 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },

  section: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 12, color: "#9CA3AF", fontWeight: "900", marginBottom: 15, letterSpacing: 1 },

  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  iconSmall: {
    width: 32,
    height: 32,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoLabel: { fontSize: 12, color: "#6B7280" },
  infoValue: { fontSize: 15, color: "#1F2937", fontWeight: "700" },

  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },

  actionsContainer: { flexDirection: "row", gap: 15 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  btnSuspend: { backgroundColor: "#FFF", borderColor: "#FCD34D" },
  btnTextSuspend: { color: "#D97706", fontWeight: "900" },

  btnDelete: { backgroundColor: "#FFF", borderColor: "#FCA5A5" },
  btnTextDelete: { color: "#DC2626", fontWeight: "900" },
});
