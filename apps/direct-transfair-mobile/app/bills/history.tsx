// apps/direct-transfair-mobile/app/bills/history.tsx
// =========================================================
// FACTURES — tous mes paiements (lot 14), pagination « charger plus ».
// =========================================================

import React, { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { BillPaymentView } from "../../services/billTypes";
import { BillPaymentRow } from "../../components/bills/billsUi";
import { Button, EmptyView, ErrorView, NavBar, Screen, SkeletonRows } from "../../components/ui";
import { apiProblem } from "../../components/merchant/merchantUi";
import { useFocusEffect } from "expo-router";
import { useT } from "../../providers/I18nProvider";

type Page = { data: BillPaymentView[]; total: number; page: number; limit: number };

export default function BillsHistoryScreen() {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState<BillPaymentView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = (await api.listMyBills({ page: p })) as Page;
      setRows((cur) => (p === 1 ? res.data : [...(cur ?? []), ...res.data]));
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      setError(apiProblem(e).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(1); }, [load]));

  return (
    <Screen header={<NavBar onBack={() => router.back()} title={t("bill.history")} />}>
      {error && !rows ? (
        <ErrorView title={t("bill.loadFail")} message={error} onRetry={() => load(1)} />
      ) : !rows ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyView icon="receipt-outline" title={t("bill.none")} />
      ) : (
        <>
          {rows.map((p, i) => (
            <BillPaymentRow key={p.id} p={p} delay={Math.min(i, 8) * 40} onPress={() => router.push({ pathname: "/bills/payment", params: { id: p.id } } as any)} />
          ))}
          {rows.length < total && <Button label={t("bill.seeAll")} kind="outline" loading={busy} onPress={() => load(page + 1)} style={{ marginTop: 6 }} />}
        </>
      )}
    </Screen>
  );
}
