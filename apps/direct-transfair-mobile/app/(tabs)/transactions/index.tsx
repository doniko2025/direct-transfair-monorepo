// apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
// =========================================================
// TRANSACTIONS HISTORY v7.0 — Direct Transf'air
// ✅ v7.0 : 🔥 REFONTE TOTALE de l'écran « Activité » + correction du chargement infini.
//    • Design : en-tête de marque (couleur du tenant) avec recherche, filtres en pastilles avec compteurs,
//      opérations regroupées par jour dans des cartes, montants lisibles, statut en pastille. Tout vient du
//      kit components/wallet.
//    • Chargement : useLoader() borne l'attente (20 s). Squelettes pendant le chargement, message « le serveur
//      démarre » si ça traîne, puis erreur claire avec « Réessayer ». Un échec n'affiche plus une liste vide
//      comme si le client n'avait aucune transaction. Pull-to-refresh conservé.
//    • Logique conservée : sens (reçu/envoyé), montants convertis, recherche (référence, nom, téléphone),
//      filtres par statut, tri par date, navigation vers le détail. getTransactions({ limit: 200 }).
// ✅ v6.8 : (phase 5) clients wallet uniquement — branches SUPER_ADMIN /
//    COMPANY_ADMIN / AGENT supprimées (historique admin et journal de
//    caisse : voir le portail web). Seul api.getTransactions() est appelé.
// ✅ v6.7 : HERO — dégradé sombre identique à ClientDashboard
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (load, resolveDirection, filtrage, tri : tout identique).
//    - En-tête (rôle, titre "Historique", compteur, refresh, recherche) :
//      fond blanc plat → LinearGradient sombre (#0A0F0D → #123324),
//      mêmes teintes exactes que le hero du dashboard client.
//    - SafeAreaView passe en fond sombre (zone sous l'encoche) ; le
//      contenu sous le hero (filtres + liste) reçoit un fond clair
//      explicite (C.pageBg) pour ne pas hériter du sombre du parent.
//    - useSafeAreaInsets (nouveau) remplace le paddingTop conditionnel
//      Platform.OS pour un alignement fiable sous l'encoche.
//    - rolePill / refreshBtn / barre de recherche : recolorés en style
//      "verre" (fond blanc translucide) pour rester lisibles sur fond
//      sombre. Filtres et cartes de transactions : strictement
//      inchangés (déjà blancs/neutres, pas concernés).
// ✅ v6.6 : Fond blanc neutre (#FAFAFA), cartes ombrées
//    - pageBg #F0FDF8 → #FAFAFA (suppression fond vert pâle)
//    - cardBorder #D1FAE5 → #E5E5EA (bordures neutres)
//    - Ombres cartes : shadowColor green → #000, opacity 0.05→0.08
//    - searchBox : fond blanc + bordure neutre
//    - refreshBtn : style neutre
//    - Logique métier 100 % inchangée
// =========================================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";
import ScreenHeader from "../../../components/wallet/ScreenHeader";
import { Card, FilterChips, SearchBar, TransactionRow } from "../../../components/wallet/WalletParts";
import { SkeletonList } from "../../../components/wallet/Skeleton";
import { EmptyState, ErrorState, SlowHint } from "../../../components/wallet/StateViews";
import { useLoader } from "../../../components/wallet/useLoader";
import { FONT, N, TAB_BAR_SPACE, formatDay, useWalletTheme } from "../../../components/wallet/walletTheme";

type FilterKey = "ALL" | "PENDING" | "VALIDATED" | "PAID" | "CANCELLED";
const FILTER_LABELS: Record<FilterKey, string> = {
  ALL: "Toutes", PENDING: "En attente", VALIDATED: "Validées", PAID: "Payées", CANCELLED: "Annulées",
};
const FILTERS = Object.keys(FILTER_LABELS) as FilterKey[];

type DayGroup = { key: string; title: string; items: any[] };

export default function TransactionsScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const { P }    = useWalletTheme();

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [q, setQ]           = useState("");

  // Chargement borné (20 s) : squelettes → erreur claire + « Réessayer »
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<any[]>(async () => {
    const res = await api.getTransactions({ limit: 200 });
    const list: any[] = Array.isArray(res) ? res : [];
    return [...list].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });
  const transactions = data ?? [];

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filter !== "ALL" && tx.status !== filter) return false;
      if (!sq) return true;
      return (
        (tx.reference ?? "").toLowerCase().includes(sq) ||
        (tx.beneficiary?.fullName ?? "").toLowerCase().includes(sq) ||
        (tx.beneficiary?.phone ?? "").toLowerCase().includes(sq) ||
        `${tx.sender?.firstName ?? ""} ${tx.sender?.lastName ?? ""}`.toLowerCase().includes(sq) ||
        `${tx.senderFirstName ?? ""} ${tx.senderLastName ?? ""}`.toLowerCase().includes(sq)
      );
    });
  }, [transactions, filter, q]);

  // Regroupement par jour
  const groups: DayGroup[] = useMemo(() => {
    const map = new Map<string, DayGroup>();
    for (const tx of filtered) {
      const day = new Date(tx.createdAt).toDateString();
      if (!map.has(day)) map.set(day, { key: day, title: formatDay(tx.createdAt), items: [] });
      map.get(day)!.items.push(tx);
    }
    return Array.from(map.values());
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: transactions.length };
    for (const t of transactions) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [transactions]);
  const pendingCount = counts.PENDING ?? 0;

  const subtitle = status === "ready"
    ? `${filtered.length} opération${filtered.length !== 1 ? "s" : ""}${pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}`
    : "Tes envois et réceptions";

  return (
    <View style={{ flex: 1, backgroundColor: N.page }}>
      <ScreenHeader title="Activité" subtitle={subtitle}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Nom, téléphone, référence…" />
      </ScreenHeader>

      <View style={{ paddingTop: 14 }}>
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ key: f, label: FILTER_LABELS[f], count: f === "ALL" ? undefined : counts[f] }))}
        />
      </View>

      {status === "loading" ? (
        <View style={s.pad}>
          <SlowHint visible={slow} />
          <Card><SkeletonList rows={6} /></Card>
        </View>
      ) : status === "error" ? (
        <ErrorState title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={P.accent} />}
          ListHeaderComponent={
            error ? (
              <View style={s.stale}>
                <Text style={s.staleTxt}>Actualisation impossible pour le moment. Tire pour réessayer.</Text>
              </View>
            ) : null
          }
          renderItem={({ item: g }) => (
            <View style={{ marginBottom: 16 }}>
              <Text style={s.day}>{g.title}</Text>
              <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
                {g.items.map((tx, i) => (
                  <TransactionRow
                    key={tx.id ?? `${g.key}-${i}`}
                    tx={tx}
                    userId={user?.id}
                    last={i === g.items.length - 1}
                    onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)}
                  />
                ))}
              </Card>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={q || filter !== "ALL" ? "Aucun résultat" : "Aucune transaction"}
              message={q || filter !== "ALL" ? "Modifie ta recherche ou ton filtre." : "Tes envois et réceptions apparaîtront ici."}
              actionLabel={q || filter !== "ALL" ? undefined : "Envoyer de l'argent"}
              onAction={() => router.push("/(tabs)/send")}
            />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  day: { fontFamily: FONT.medium, fontSize: 13, fontWeight: "700", color: N.muted, marginBottom: 8, marginLeft: 4, textTransform: "capitalize" },
  stale: { backgroundColor: N.warnBg, borderColor: N.warnBd, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 },
  staleTxt: { fontFamily: FONT.body, fontSize: 12.5, color: N.warn },
});
