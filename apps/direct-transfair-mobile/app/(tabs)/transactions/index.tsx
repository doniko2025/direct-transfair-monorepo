// apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// TRANSACTIONS HISTORY v8.0 — Direct Transf'air
// ✅ v8.0 : 🔥 REFONTE TOTALE en thème clair (maquette « Flash Transfert / Activité ») : gros titre,
//    recherche en pilule, filtres en puces (noire quand sélectionnée), opérations regroupées par jour en
//    lignes à filets (avatar, statut avec point de couleur, montant signé vert/noir). Design system
//    components/ui ; aucune couleur codée en dur.
//    Logique INCHANGÉE : getTransactions({limit:200}) en chargement borné (useLoader 20 s), tri par date,
//    filtres par statut, recherche (référence, nom, téléphone), regroupement par jour, navigation détail.
// ✅ v7.0 : refonte « wallet » + chargement borné (fin du chargement infini).
// ✅ v6.x : historique des refontes précédentes (hero sombre, cartes neutres, filtres) — remplacé.
// ✅ v6.8 : (phase 5) clients wallet uniquement — seul api.getTransactions() est appelé.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";
import { useLoader } from "../../../components/wallet/useLoader";
import { formatDay } from "../../../components/wallet/walletTheme";
import {
  Chip, EmptyView, ErrorView, Notice, PageTitle, Screen, SearchPill, SkeletonRows, SlowNote, TxRow, UText,
} from "../../../components/ui";

type FilterKey = "ALL" | "PENDING" | "VALIDATED" | "PAID" | "CANCELLED";
const FILTER_LABELS: Record<FilterKey, string> = {
  ALL: "Toutes", PENDING: "En attente", VALIDATED: "Validées", PAID: "Payées", CANCELLED: "Annulées",
};
const FILTERS = Object.keys(FILTER_LABELS) as FilterKey[];

type DayGroup = { key: string; title: string; items: any[] };

export default function TransactionsScreen() {
  const router   = useRouter();
  const { user } = useAuth();

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
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <PageTitle title="Activité" subtitle={subtitle} />
      <SearchPill value={q} onChangeText={setQ} placeholder="Nom, téléphone, référence…" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={FILTER_LABELS[f]} active={filter === f} onPress={() => setFilter(f)} count={f === "ALL" ? undefined : counts[f]} />
        ))}
      </ScrollView>

      <SlowNote visible={slow && status === "loading"} />

      {status === "loading" ? (
        <SkeletonRows rows={6} />
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
      ) : (
        <View>
          {error ? <Notice tone="warn" style={{ marginBottom: 12 }}>Actualisation impossible pour le moment. Tire pour réessayer.</Notice> : null}
          {groups.map((g) => (
            <View key={g.key} style={{ marginBottom: 8 }}>
              <UText v="overline" tone="muted" style={{ marginTop: 14, marginBottom: 2 }}>{g.title}</UText>
              {g.items.map((tx, i) => (
                <TxRow
                  key={tx.id ?? `${g.key}-${i}`}
                  tx={tx}
                  userId={user?.id}
                  last={i === g.items.length - 1}
                  onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)}
                />
              ))}
            </View>
          ))}
          {groups.length === 0 && (
            <EmptyView
              icon="receipt-outline"
              title={q || filter !== "ALL" ? "Aucun résultat" : "Aucune transaction"}
              message={q || filter !== "ALL" ? "Modifie ta recherche ou ton filtre." : "Tes envois et réceptions apparaîtront ici."}
              actionLabel={q || filter !== "ALL" ? undefined : "Envoyer de l'argent"}
              onAction={() => router.push("/(tabs)/send")}
            />
          )}
        </View>
      )}
    </Screen>
  );
}
