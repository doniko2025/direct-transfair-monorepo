// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../../../services/api";
import type { Beneficiary } from "../../../services/types";
import { colors } from "../../../theme/colors";

export default function BeneficiairesIndexScreen() {
  const router = useRouter();

  const [items, setItems] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getBeneficiaries();
      const list: Beneficiary[] = Array.isArray(res) ? res : [];
      setItems(list);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de charger les bénéficiaires.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
      return () => {};
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.getBeneficiaries();
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de rafraîchir la liste.");
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ CORRECTION : beneficiaries (anglais) pour matcher le dossier
  const goCreate = () => router.push("/(tabs)/beneficiaries/create");

  // ✅ CORRECTION : beneficiaries (anglais)
  const goDetail = (id: string) => {
    router.push({
      pathname: "/(tabs)/beneficiaries/[id]",
      params: { id },
    });
  };

  const renderItem = ({ item }: { item: Beneficiary }) => {
    const id = typeof item?.id === "string" ? item.id.trim() : "";

    return (
      <Pressable
        onPress={() => {
          if (!id || id === "undefined") {
            Alert.alert("Erreur", "Bénéficiaire invalide (id manquant).");
            return;
          }
          goDetail(id);
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <Text style={styles.name}>{item.fullName}</Text>
        <Text style={styles.line}>
          {item.city}, {item.country}
        </Text>
        {item.phone ? (
          <Text style={styles.line}>Téléphone : {item.phone}</Text>
        ) : null}
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  };

  if (loading && !refreshing && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.centerText}>Chargement des bénéficiaires…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          typeof item?.id === "string" ? item.id : String(index)
        }
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>Bénéficiaires</Text>
              <Pressable style={styles.addBtn} onPress={goCreate}>
                <Text style={styles.addBtnText}>Ajouter</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Gérez vos bénéficiaires avant d’envoyer de l’argent.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Aucun bénéficiaire pour le moment.
            </Text>
            <Pressable style={styles.emptyCta} onPress={goCreate}>
              <Text style={styles.emptyCtaText}>Créer un bénéficiaire</Text>
            </Pressable>
          </View>
        }
        contentContainerStyle={
          items.length === 0 ? styles.listEmpty : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerText: { marginTop: 8, color: colors.muted },
  header: { padding: 16, paddingBottom: 8 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 6, color: colors.muted },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: colors.white, fontWeight: "700" },
  card: { marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, position: "relative" },
  cardPressed: { opacity: 0.85 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 },
  line: { color: colors.muted },
  chevron: { position: "absolute", right: 12, top: 12, fontSize: 24, color: colors.muted },
  emptyWrap: { padding: 16, alignItems: "center" },
  emptyText: { color: colors.muted, marginBottom: 12 },
  emptyCta: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  emptyCtaText: { color: colors.white, fontWeight: "700" },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
});