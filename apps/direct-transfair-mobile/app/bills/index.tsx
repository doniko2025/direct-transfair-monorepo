// apps/direct-transfair-mobile/app/bills/index.tsx
// =========================================================
// FACTURES — accueil (lot 14)
// Catégories (électricité, eau, assurance, scolarité, loyer…) proposées par LA société du client, factures enregistrées
// (repaiement en deux touchers) et derniers paiements. Fonction fermée → message « bientôt disponible ».
// =========================================================

import React from "react";
import { Alert, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { BillOptions, BillPaymentView, BillScheduleView, SavedBillView } from "../../services/billTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { BillPaymentRow, BillsHero, CategoryTile, EmptyPayments, SavedBillCard, ScheduleEntryCard } from "../../components/bills/billsUi";
import { EmptyView, ErrorView, NavBar, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, UText } from "../../components/ui";
import { fmtDate } from "../../i18n/runtime";
import { useT } from "../../providers/I18nProvider";

interface HomeData {
  options: BillOptions;
  saved: SavedBillView[];
  recent: BillPaymentView[];
  schedules: BillScheduleView[];
  schedulesEnabled: boolean;
}

export default function BillsHomeScreen() {
  const t = useT();
  const router = useRouter();

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<HomeData>(async () => {
    const options = await api.getBillOptions();
    if (!options.enabled) return { options, saved: [], recent: [], schedules: [], schedulesEnabled: false };
    const [saved, recent, sched] = await Promise.all([
      api.listSavedBills().catch(() => [] as SavedBillView[]),
      api.listMyBills({ page: 1 }).then((r) => (r as { data: BillPaymentView[] }).data.slice(0, 3)).catch(() => [] as BillPaymentView[]),
      api.listBillSchedules().catch(() => null),
    ]);
    return { options, saved, recent, schedules: sched?.data ?? [], schedulesEnabled: !!sched?.enabled };
  });

  const removeSaved = (s: SavedBillView) => {
    const run = async () => { try { await api.removeSavedBill(s.id); } finally { await refresh(); } };
    if (Platform.OS === "web") { if (window.confirm(`${t("bill.removeSaved")} « ${s.label} » ?`)) void run(); return; }
    Alert.alert(t("bill.removeSaved"), s.label, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("bill.removeSaved"), style: "destructive", onPress: () => void run() },
    ]);
  };

  const payAgain = (s: SavedBillView) =>
    router.push({ pathname: "/bills/biller", params: { id: s.biller.id, ref: s.accountRef, f: JSON.stringify(s.fields ?? {}), label: s.label } } as any);

  return (
    <Screen header={<NavBar onBack={() => router.back()} title={t("bill.title")} />} refreshing={refreshing} onRefresh={refresh}>
      {status === "loading" ? (
        <>
          <SkeletonRows rows={4} />
          <SlowNote visible={slow} />
        </>
      ) : status === "error" || !data ? (
        <ErrorView title={error?.title ?? t("bill.loadFail")} message={error?.message ?? ""} onRetry={reload} />
      ) : !data.options.enabled ? (
        <EmptyView icon="receipt-outline" title={t("bill.disabledTitle")} message={t("bill.disabledMsg")} />
      ) : (
        <>
          <BillsHero />
          <SectionHeader title={t("bill.chooseCat")} />
          {data.options.categories.length === 0 ? (
            <EmptyView icon="receipt-outline" title={t("bill.noBillers")} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {data.options.categories.map((c, i, all) => {
                // Une seule catégorie, ou dernière tuile d'une rangée impaire : pleine largeur (pas de trou dans la grille).
                const wide = all.length === 1 || (i === all.length - 1 && all.length % 2 === 1);
                return (
                  <View key={c.category} style={{ width: wide ? "100%" : "47.5%", flexGrow: 1 }}>
                    <CategoryTile
                      category={c.category}
                      count={c.count}
                      wide={wide}
                      delay={i * 50}
                      onPress={() => router.push({ pathname: "/bills/billers", params: { category: c.category } } as any)}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {data.schedulesEnabled && (() => {
            const active = data.schedules.filter((s) => s.status === "ACTIVE");
            const next = [...active].sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0];
            return (
              <ScheduleEntryCard
                delay={120}
                title={t("bill.sch.entry")}
                subtitle={next ? t("bill.sch.entryCount", { n: String(active.length), date: fmtDate(next.nextRunAt) }) : t("bill.sch.entrySub")}
                onPress={() => router.push("/bills/schedules" as any)}
              />
            );
          })()}

          {data.saved.length > 0 && (
            <>
              <SectionHeader title={t("bill.saved")} />
              <UText v="caption" tone="muted" style={{ marginBottom: 10 }}>{t("bill.savedHint")}</UText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
                {data.saved.map((s, i) => (
                  <SavedBillCard key={s.id} saved={s} delay={i * 60} onPay={() => payAgain(s)} onRemove={() => removeSaved(s)} />
                ))}
              </ScrollView>
            </>
          )}

          <SectionHeader title={t("bill.recent")} action={data.recent.length ? t("bill.seeAll") : undefined} onAction={() => router.push("/bills/history" as any)} />
          {data.recent.length === 0 ? (
            <EmptyPayments />
          ) : (
            data.recent.map((p, i) => (
              <BillPaymentRow key={p.id} p={p} delay={i * 60} onPress={() => router.push({ pathname: "/bills/payment", params: { id: p.id } } as any)} />
            ))
          )}
          <Notice tone="info" icon="shield-checkmark-outline" style={{ marginTop: 16 }}>{t("bill.help")}</Notice>
        </>
      )}
    </Screen>
  );
}
