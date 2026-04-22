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
      if (confirmWeb(`Voulez-vous ${nextStatus === "ACTIVE" ? "activer" : "suspendre"} cette société ?`)) await run();
      return;
    }

    Alert.alert("Confirmation", `Voulez-vous ${nextStatus === "ACTIVE" ? "activer" : "suspendre"} cette société ?`, [
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
      } catch (e: any) {
        const msg = e?.response?.data?.message || "Impossible de supprimer.";
        Platform.OS === "web" ? alert(msg) : Alert.alert("Erreur", msg);
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

  const handleEdit = useCallback(() => {
    if (!client) return;
    // Redirection vers l'écran d'édition (que l'on créera ensuite)
    router.push({
      pathname: "/(tabs)/admin/clients/edit",
      params: { id: client.id },
    });
  }, [client, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (errorMsg || !client) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#111827", fontWeight: "700", marginBottom: 8, fontSize: 18 }}>
          Détails société
        </Text>
        <Text style={{ color: "#6B7280", textAlign: "center", marginBottom: 20 }}>
          {errorMsg || "Société introuvable"}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Retourner à la liste</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusUp = String(client.subscriptionStatus ?? "").toUpperCase();
  const isActive = statusUp === "ACTIVE";
  const badgeBg = isActive ? "#D1FAE5" : "#FEE2E2";
  const badgeFg = isActive ? "#065F46" : "#991B1B";

  const formatName = (f?: string | null, l?: string | null) => {
    const full = `${f || ""} ${l || ""}`.trim();
    return full || "Non renseigné";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{client.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* CARTE PRINCIPALE */}
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

        {/* INFORMATIONS SOCIÉTÉ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS SOCIÉTÉ</Text>
          <InfoRow label="Email Administrateur" value={client.email || client.contactEmail || "Non renseigné"} icon="mail-outline" />
          <InfoRow label="Téléphone Contact" value={client.phone || client.contactPhone || "Non renseigné"} icon="call-outline" />
          <InfoRow label="Secteur d'activité" value={client.activitySector || "Non renseigné"} icon="briefcase-outline" />
          <View style={styles.divider} />
          <InfoRow label="Type de Contrat" value={String(client.subscriptionType === "PURCHASE" ? "Achat" : "Location")} icon="document-text-outline" />
        </View>

        {/* INFORMATIONS GÉRANT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS GÉRANT</Text>
          <InfoRow label="Nom complet" value={formatName(client.ownerFirstName, client.ownerLastName)} icon="person-outline" />
          <InfoRow label="Date de naissance" value={client.ownerBirthDate || "Non renseignée"} icon="calendar-outline" />
          <InfoRow label="Lieu de naissance" value={client.ownerBirthPlace || "Non renseigné"} icon="location-outline" />
          <InfoRow label="Nationalité / Pays" value={client.ownerCountry || "Non renseigné"} icon="earth-outline" />
        </View>

        {/* ADRESSE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADRESSE</Text>
          <InfoRow label="Adresse complète" value={client.address || "Non renseignée"} icon="map-outline" />
        </View>

        {/* STATISTIQUES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STATISTIQUES</Text>
          <InfoRow label="Comptes Utilisateurs" value={String(client._count?.users ?? 0)} icon="people-outline" />
          <InfoRow label="Agences Connectées" value={String(client._count?.agencies ?? 0)} icon="business-outline" />
        </View>

        {/* ACTIONS SENSIBLES */}
        <Text style={[styles.sectionTitle, { marginTop: 10, marginBottom: 12, marginLeft: 4 }]}>
          ACTIONS RAPIDES
        </Text>

        <View style={styles.actionsRow}>
          {/* Bouton Modifier */}
          <TouchableOpacity
            style={[styles.actionBox, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
            onPress={handleEdit}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={24} color="#3B82F6" />
            <Text style={[styles.actionBoxText, { color: "#3B82F6" }]}>Modifier</Text>
          </TouchableOpacity>

          {/* Bouton Suspendre/Activer */}
          <TouchableOpacity
            style={[styles.actionBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}
            onPress={handleToggleStatus}
            disabled={processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <Ionicons name={isActive ? "pause" : "play"} size={24} color="#D97706" />
            )}
            <Text style={[styles.actionBoxText, { color: "#D97706" }]}>
              {isActive ? "Suspendre" : "Activer"}
            </Text>
          </TouchableOpacity>

          {/* Bouton Supprimer */}
          <TouchableOpacity
            style={[styles.actionBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}
            onPress={handleDelete}
            disabled={processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name="trash" size={24} color="#DC2626" />
            )}
            <Text style={[styles.actionBoxText, { color: "#DC2626" }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>

        {/* Espace vide pour ne pas que la barre de navigation masque le contenu */}
        <View style={{ height: 130 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconSmall}>
        <Ionicons name={icon} size={18} color="#64748B" />
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F8FAFC" },
  
  backBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#FFFFFF", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  headerIcon: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },

  content: { padding: 18 },

  cardTop: { backgroundColor: colors.primary, borderRadius: 20, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  topLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  topValue: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginTop: 4, letterSpacing: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },

  section: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0", elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 11, color: "#94A3B8", fontWeight: "900", marginBottom: 16, letterSpacing: 1.2 },

  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  iconSmall: { width: 38, height: 38, backgroundColor: "#F1F5F9", borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 14 },
  infoLabel: { fontSize: 12, color: "#64748B", fontWeight: "600", marginBottom: 2 },
  infoValue: { fontSize: 15, color: "#0F172A", fontWeight: "800" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 4, marginBottom: 16 },

  actionsRow: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  actionBox: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 16, 
    borderRadius: 18, 
    borderWidth: 1 
  },
  actionBoxText: { marginTop: 8, fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
});