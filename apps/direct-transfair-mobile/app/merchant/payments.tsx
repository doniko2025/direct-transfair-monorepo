// apps/direct-transfair-mobile/app/merchant/payments.tsx
// =========================================================
// HISTORIQUE DES ENCAISSEMENTS v1.0 — Lot 11
// Liste filtrable (tous / en attente / payés / autres) avec chargement progressif.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { Button, Chip, EmptyView, ErrorView, NavBar, Screen, SkeletonRows } from "../../components/ui";
import { PaymentRow, apiProblem } from "../../components/merchant/merchantUi";

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "PENDING", label: "En attente" },
  { key: "PAID", label: "Payés" },
  { key: "REFUNDED", label: "Remboursés" },
  { key: "DECLINED", label: "Refusés" },
  { key: "EXPIRED", label: "Expirés" },
] as const;

export default function MerchantPaymentsScreen() {
  const router = useRouter();
  // Lot 13 : un caissier arrive avec le commerce choisi (ses propres encaissements seulement).
  const { merchantId } = useLocalSearchParams<{ merchantId?: string }>();
  const shop = merchantId ? String(merchantId) : undefined;
  const [filter, setFilter] = useState<string>("");
  const [items, setItems] = useState<PaymentRequestView[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (f: string, pg: number, mode: "reset" | "more" | "pull") => {
    const id = ++seq.current;
    if (mode === "reset") setLoading(true);
    if (mode === "more") setMore(true);
    if (mode === "pull") setRefreshing(true);
    try {
      const res = await api.listMerchantPayments({ status: f || undefined, page: pg, merchantId: shop });
      if (id !== seq.current) return;
      setItems((prev) => (mode === "more" ? [...prev, ...res.data.filter((x) => !prev.some((p) => p.id === x.id))] : res.data));
      setPage(res.meta.page);
      setPages(res.meta.pages);
      setError(null);
    } catch (e) {
      if (id === seq.current) setError(apiProblem(e).message);
    } finally {
      if (id === seq.current) { setLoading(false); setMore(false); setRefreshing(false); }
    }
  }, [shop]);

  useFocusEffect(useCallback(() => { void load(filter, 1, "reset"); }, [filter, load]));
  useEffect(() => () => { seq.current++; }, []);

  return (
    <Screen header={<NavBar onBack={() => router.back()} title={shop ? "Mes encaissements" : "Paiements encaissés"} />} refreshing={refreshing} onRefresh={() => load(filter, 1, "pull")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {FILTERS.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </View>

      {loading ? <SkeletonRows rows={5} /> : error && items.length === 0 ? (
        <ErrorView title="Chargement impossible" message={error} onRetry={() => load(filter, 1, "reset")} />
      ) : items.length === 0 ? (
        <EmptyView icon="receipt-outline" title="Aucun paiement" message="Vos encaissements apparaîtront ici." />
      ) : (
        <>
          {items.map((p) => (
            <PaymentRow key={p.id} p={p} onPress={() => router.push({ pathname: "/merchant/payment", params: { id: p.id, ...(shop ? { merchantId: shop, from: "cashier" } : {}) } } as any)} />
          ))}
          {page < pages && <Button label="Voir plus" kind="outline" loading={more} onPress={() => load(filter, page + 1, "more")} />}
        </>
      )}
    </Screen>
  );
}
