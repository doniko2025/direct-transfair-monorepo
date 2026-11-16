// apps/direct-transfair-mobile/app/bills/billers.tsx
// =========================================================
// FACTURES — choix du facturier dans une catégorie (lot 14), avec recherche.
// =========================================================

import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { BillerView } from "../../services/billTypes";
import { BillerRow, billCategoryLabel } from "../../components/bills/billsUi";
import { EmptyView, ErrorView, Field, NavBar, Screen, SkeletonRows } from "../../components/ui";
import { apiProblem } from "../../components/merchant/merchantUi";
import { useT } from "../../providers/I18nProvider";

export default function BillersScreen() {
  const t = useT();
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const cat = typeof category === "string" ? category : undefined;
  const [q, setQ] = useState("");
  const [list, setList] = useState<BillerView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setError(null);
      try {
        const rows = await api.listBillers({ category: cat, q: q.trim() || undefined });
        if (alive) setList(rows);
      } catch (e) {
        if (alive) setError(apiProblem(e).message);
      }
    }, q ? 250 : 0); // petite attente pendant la frappe
    return () => { alive = false; clearTimeout(timer); };
  }, [cat, q, tick]);

  return (
    <Screen header={<NavBar onBack={() => router.back()} title={cat ? billCategoryLabel(cat) : t("bill.pickBiller")} />}>
      <Field label={undefined} icon="search-outline" placeholder={t("bill.search")} value={q} onChangeText={setQ} autoCapitalize="none" style={{ marginBottom: 14 }} />
      {error ? (
        <ErrorView title={t("bill.loadFail")} message={error} onRetry={() => setTick((n) => n + 1)} />
      ) : !list ? (
        <SkeletonRows rows={4} />
      ) : list.length === 0 ? (
        <EmptyView icon="receipt-outline" title={t("bill.noBillers")} />
      ) : (
        list.map((b, i) => (
          <BillerRow key={b.id} biller={b} delay={i * 45} onPress={() => router.push({ pathname: "/bills/biller", params: { id: b.id } } as any)} />
        ))
      )}
    </Screen>
  );
}
