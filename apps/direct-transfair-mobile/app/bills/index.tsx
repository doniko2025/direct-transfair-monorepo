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
import { BillPaymentRow, CategoryTile, SavedBillCard } from "../../components/bills/billsUi";
import { EmptyView, ErrorView, NavBar, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, UText, Card, useUI } from "../../components/ui";
import { Ionicons } from "../../components/ui/Icon";
import { fmtDate } from "../../i18n/runtime";
import { Rise } from "../../components/merchant/merchantUi";
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
  const { C } = useUI();

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
          <Rise>
            <UText v="subheading" style={{ marginTop: 6, marginBottom: 12 }}>{t("bill.categories")}</UText>
          </Rise>
          {data.options.categories.length === 0 ? (
            <EmptyView icon="receipt-outline" title={t("bill.noBillers")} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {data.options.categories.map((c, i) => (
                <View key={c.category} style={{ width: "31.5%", flexGrow: 1, minWidth: 96 }}>
                  <CategoryTile
                    category={c.category}
                    count={c.count}
                    delay={i * 45}
                    onPress={() => router.push({ pathname: "/bills/billers", params: { category: c.category } } as any)}
                  />
                </View>
              ))}
            </View>
          )}

          {data.schedulesEnabled && (() => {
            const active = data.schedules.filter((s) => s.status === "ACTIVE");
            const next = [...active].sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0];
            return (
              <Rise delay={120}>
                <Card tone="accent" pad={16} onPress={() => router.push("/bills/schedules" as any)} style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 19, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={"calendar-outline" as any} size={22} color={C.accentDeep} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <UText v="bodyStrong">{t("bill.sch.entry")}</UText>
                    <UText v="caption" tone="muted" numberOfLines={2}>
                      {next ? t("bill.sch.entryCount", { n: String(active.length), date: fmtDate(next.nextRunAt) }) : t("bill.sch.entrySub")}
                    </UText>
                  </View>
                  <Ionicons name={"chevron-forward" as any} size={18} color={C.faint} />
                </Card>
              </Rise>
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
            <UText v="body" tone="muted">{t("bill.none")}</UText>
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
