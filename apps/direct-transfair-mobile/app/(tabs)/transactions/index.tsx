// apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// TRANSACTIONS HISTORY v8.1 — Direct Transf'air
// ✅ v8.2 : séparation garantie aussi sur l'appareil (services/accountSpace.ts) ; état vide marchand → « Encaisser un paiement ».
// ✅ v8.1 : COMPTES SÉPARÉS — l'écran suit le compte actif (client / marchand) : il demande au serveur uniquement les opérations de ce compte
//    (space=client|merchant) et se recrée à chaque bascule, donc jamais de données de l'autre compte (ni en cache à l'écran).
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
import { filterBySpace } from "../../../services/accountSpace";
import { useAuth } from "../../../providers/AuthProvider";
import { useAccountSpace, type AccountSpace } from "../../../hooks/useAccountSpace";
import { SpaceSwitch } from "../../../components/home/SpaceSwitch";
import { useLoader } from "../../../components/wallet/useLoader";
import { formatDay } from "../../../components/wallet/walletTheme";
import { useT } from "../../../providers/I18nProvider";
import type { MessageKey } from "../../../i18n/catalog";
import {
  Chip, EmptyView, ErrorView, Notice, PageTitle, Screen, SearchPill, SkeletonRows, SlowNote, TxRow, UText,
} from "../../../components/ui";

type FilterKey = "ALL" | "PENDING" | "VALIDATED" | "PAID" | "CANCELLED";
const FILTER_KEYS: Record<FilterKey, MessageKey> = {
  ALL: "tx.f.all", PENDING: "tx.f.pending", VALIDATED: "tx.f.validated", PAID: "tx.f.paid", CANCELLED: "tx.f.cancelled",
};
const FILTERS = Object.keys(FILTER_KEYS) as FilterKey[];

type DayGroup = { key: string; title: string; items: any[] };

export default function TransactionsScreen() {
  const { space, ready } = useAccountSpace();
  if (!ready) return null;
  // key = compte actif : à la bascule l'écran repart de zéro (état, filtres, données).
  return <TransactionsContent key={space} space={space} />;
}

function TransactionsContent({ space }: { space: AccountSpace }) {
  const router   = useRouter();
  const t = useT();
  const { user } = useAuth();
  const isMerchant = space === "merchant";

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [q, setQ]           = useState("");

  // Chargement borné (20 s) : squelettes → erreur claire + « Réessayer »
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<any[]>(async () => {
    const res = await api.getTransactions({ limit: 200, space });
    // Double sécurité : même si le serveur renvoyait tout (ancienne version), on ne garde que les opérations du compte affiché.
    const list: any[] = filterBySpace(Array.isArray(res) ? res : [], space, user?.id);
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
    for (const x of transactions) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [transactions]);
  const pendingCount = counts.PENDING ?? 0;

  const subtitle = status === "ready"
    ? `${t("tx.count", { count: filtered.length })}${pendingCount > 0 ? t("tx.pendingSuffix", { count: pendingCount }) : ""}`
    : isMerchant ? t("tx.subMerchant") : t("tx.subClient");

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <PageTitle title={isMerchant ? t("tab.payments") : t("tab.activity")} subtitle={subtitle} />
      <SpaceSwitch style={{ marginBottom: 12 }} />
      <SearchPill value={q} onChangeText={setQ} placeholder={t("tx.search")} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={t(FILTER_KEYS[f])} active={filter === f} onPress={() => setFilter(f)} count={f === "ALL" ? undefined : counts[f]} />
        ))}
      </ScrollView>

      <SlowNote visible={slow && status === "loading"} />

      {status === "loading" ? (
        <SkeletonRows rows={6} />
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? t("tx.loadFail")} message={error?.message ?? ""} onRetry={reload} />
      ) : (
        <View>
          {error ? <Notice tone="warn" style={{ marginBottom: 12 }}>{t("tx.refreshFail")}</Notice> : null}
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
              title={q || filter !== "ALL" ? t("tx.noResult") : t("tx.none")}
              message={q || filter !== "ALL" ? t("tx.adjust") : isMerchant ? t("tx.emptyMerchant") : t("tx.emptyClient")}
              actionLabel={q || filter !== "ALL" ? undefined : isMerchant ? t("tx.ctaMerchant") : t("home.send")}
              onAction={() => router.push(isMerchant ? "/merchant/payment" : "/(tabs)/send")}
            />
          )}
        </View>
      )}
    </Screen>
  );
}
