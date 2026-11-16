// apps/direct-transfair-mobile/app/bills/schedules.tsx
// =========================================================
// FACTURES PROGRAMMÉES (lot 14b) — loyer, abonnements, scolarité mensuelle, assurance annuelle…
// Chaque carte montre la prochaine échéance, le mode (rappel ou prélèvement automatique) et le dernier problème éventuel.
// Actions : payer maintenant (ouvre le paiement prérempli), mettre en pause, reprendre (code secret pour un prélèvement automatique),
// supprimer. Ouvert aussi depuis les rappels (/bills/schedules). Fonction fermée par la société → message clair.
// =========================================================

import React, { useState } from "react";
import { Alert, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { BillScheduleList, BillScheduleView } from "../../services/billTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { CategoryBadge, billCategoryLabel } from "../../components/bills/billsUi";
import { Button, Card, EmptyView, ErrorView, NavBar, Notice, Pill, Screen, SkeletonRows, SlowNote, UText } from "../../components/ui";
import { PinPrompt, Rise, apiProblem, money } from "../../components/merchant/merchantUi";
import { fmtDate } from "../../i18n/runtime";
import { useT } from "../../providers/I18nProvider";
import type { MessageKey } from "../../i18n/catalog";

const STATUS_TONE = { ACTIVE: "pos", PAUSED: "warn", ENDED: "info" } as const;

export default function BillSchedulesScreen() {
  const t = useT();
  const router = useRouter();
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<BillScheduleList>(() => api.listBillSchedules());

  const [busy, setBusy] = useState<string | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setProblem(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (e) {
      setProblem(apiProblem(e).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const resume = async (s: BillScheduleView) => {
    if (s.mode === "AUTO" && pin.length !== 6) { setResuming(s.id); setPin(""); setPinError(null); return; }
    setBusy(s.id);
    setProblem(null);
    setPinError(null);
    try {
      await api.resumeBillSchedule(s.id, s.mode === "AUTO" ? pin : undefined);
      setResuming(null);
      setPin("");
      await refresh();
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else setProblem(pr.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = (s: BillScheduleView) => {
    const go = () => void run(s.id, () => api.removeBillSchedule(s.id));
    if (Platform.OS === "web") { if (window.confirm(`${t("bill.sch.deleteAsk")} « ${s.label} »`)) go(); return; }
    Alert.alert(t("bill.sch.deleteAsk"), s.label, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("bill.sch.delete"), style: "destructive", onPress: go },
    ]);
  };

  const payNow = (s: BillScheduleView) =>
    router.push({
      pathname: "/bills/biller",
      params: { id: s.biller.id, ref: s.accountRef, f: JSON.stringify(s.fieldValues ?? {}), label: s.label, ...(s.amount !== null ? { amount: String(s.amount) } : {}) },
    } as any);

  const full = !!data && data.data.filter((s) => s.status !== "ENDED").length >= data.maxPerClient;

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title={t("bill.sch.title")} />}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={data?.enabled ? <Button label={t("bill.sch.new")} icon="add-circle-outline" disabled={full} onPress={() => router.push("/bills/schedule-new" as any)} /> : undefined}
    >
      {status === "loading" ? (
        <>
          <SkeletonRows rows={3} />
          <SlowNote visible={slow} />
        </>
      ) : status === "error" || !data ? (
        <ErrorView title={error?.title ?? t("bill.loadFail")} message={error?.message ?? ""} onRetry={reload} />
      ) : !data.enabled ? (
        <EmptyView icon="calendar-outline" title={t("bill.disabledTitle")} message={t("bill.sch.disabledMsg")} />
      ) : data.data.length === 0 ? (
        <EmptyView icon="calendar-outline" title={t("bill.sch.empty")} message={t("bill.sch.emptyMsg")} />
      ) : (
        <>
          {problem ? <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice> : null}
          {full ? <Notice tone="warn" style={{ marginBottom: 12 }}>{t("bill.sch.limit", { n: String(data.maxPerClient) })}</Notice> : null}
          {data.data.map((s, i) => (
            <Rise key={s.id} delay={i * 60}>
              <Card pad={16} style={{ marginBottom: 12, opacity: s.status === "ENDED" ? 0.7 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <CategoryBadge category={s.biller.category} size={46} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <UText v="bodyStrong" numberOfLines={1}>{s.label}</UText>
                    <UText v="caption" tone="muted" numberOfLines={1}>{s.biller.name} · {billCategoryLabel(s.biller.category)}</UText>
                  </View>
                  <Pill label={t(`bill.sch.st.${s.status}` as MessageKey)} tone={STATUS_TONE[s.status]} />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14, gap: 12 }}>
                  <View style={{ flexShrink: 1 }}>
                    <UText v="title">{s.amount === null ? "—" : money(s.amount, s.currency)}</UText>
                    <UText v="caption" tone="muted">{t(`bill.sch.every.${s.frequency}` as MessageKey)}{s.amountFromBiller ? ` · ${t("bill.amountFixed")}` : ""}</UText>
                  </View>
                  <Pill label={t(`bill.sch.mode.${s.mode}` as MessageKey)} tone={s.mode === "AUTO" ? "info" : "warn"} icon={s.mode === "AUTO" ? "flash-outline" : "notifications-outline"} />
                </View>

                {s.status === "ACTIVE" && <UText v="body" style={{ marginTop: 12, fontWeight: "700" }}>{t("bill.sch.next", { date: fmtDate(s.nextRunAt) })}</UText>}
                {!!s.endAt && <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{t("bill.sch.endsOn", { date: fmtDate(s.endAt) })}</UText>}
                {s.runsCount > 0 && <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{t("bill.sch.runs", { n: String(s.runsCount) })}</UText>}
                {!s.available && s.status !== "ENDED" ? <Notice tone="warn" style={{ marginTop: 10 }}>{t("bill.sch.unavailable")}</Notice> : null}
                {!!s.lastError && s.status !== "ENDED" ? <Notice tone="warn" style={{ marginTop: 10 }}>{t("bill.sch.lastError", { error: s.lastError })}</Notice> : null}

                {resuming === s.id && (
                  <View style={{ marginTop: 12 }}>
                    <UText v="caption" tone="muted" style={{ marginBottom: 6 }}>{t("bill.sch.resumePin")}</UText>
                    <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label={t("bill.sch.pinLabel")} autoFocus />
                    <Button label={t("bill.sch.resume")} icon="play-outline" disabled={pin.length !== 6} loading={busy === s.id} onPress={() => void resume(s)} />
                  </View>
                )}

                {s.status !== "ENDED" && resuming !== s.id && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                    {s.available && <Button small full={false} kind="soft" icon="card-outline" label={t("bill.sch.payNow")} onPress={() => payNow(s)} />}
                    {s.status === "ACTIVE" ? (
                      <Button small full={false} kind="outline" icon="pause-outline" label={t("bill.sch.pause")} loading={busy === s.id} onPress={() => void run(s.id, () => api.pauseBillSchedule(s.id))} />
                    ) : (
                      <Button small full={false} kind="outline" icon="play-outline" label={t("bill.sch.resume")} loading={busy === s.id} onPress={() => void resume(s)} />
                    )}
                    <Button small full={false} kind="ghost" icon="trash-outline" label={t("bill.sch.delete")} onPress={() => remove(s)} />
                  </View>
                )}
                {s.status === "ENDED" && (
                  <View style={{ flexDirection: "row", marginTop: 12 }}>
                    <Button small full={false} kind="ghost" icon="trash-outline" label={t("bill.sch.delete")} onPress={() => remove(s)} />
                  </View>
                )}
              </Card>
            </Rise>
          ))}
          <Notice tone="info" icon="notifications-outline" style={{ marginTop: 4 }}>{t("bill.sch.remindInfo", { days: String(data.remindDaysBefore) })}</Notice>
        </>
      )}
    </Screen>
  );
}
