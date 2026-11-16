// apps/direct-transfair-mobile/app/bills/payment.tsx
// =========================================================
// FACTURES — suivi d'un paiement (lot 14). Ouvert après le paiement et depuis les notifications (/bills/payment?id=…).
// Se met à jour toute seule tant que la facture n'est pas réglée (toutes les 15 s). Réglée : jeton / code à saisir, numéro de reçu du
// facturier, partage du reçu avec son code de vérification. Refusée : motif et remboursement.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import { shareBillReceiptPdf } from "../../services/billReceiptPdf";
import type { BillPaymentView } from "../../services/billTypes";
import { BillStatusPill, billCategoryLabel } from "../../components/bills/billsUi";
import { Button, Card, Divider, ErrorView, NavBar, Notice, Pill, Screen, SkeletonRows, UText } from "../../components/ui";
import { Rise, StatusHero, apiProblem, money, shortDateTime } from "../../components/merchant/merchantUi";
import { useT } from "../../providers/I18nProvider";

const POLL_MS = 15_000;

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 }}>
      <UText v="body" tone="muted">{label}</UText>
      <UText v={strong ? "bodyStrong" : "body"} style={{ flexShrink: 1, textAlign: "right" }}>{value}</UText>
    </View>
  );
}

export default function BillPaymentScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [p, setP] = useState<BillPaymentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getBillPayment(String(id));
      if (alive.current) { setP(res); setError(null); }
    } catch (e) {
      if (alive.current) setError(apiProblem(e).message);
    }
  }, [id]);

  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);

  // Mise à jour automatique tant que la facture est ouverte.
  useEffect(() => {
    if (!p || (p.status !== "SUBMITTED" && p.status !== "PROCESSING")) return;
    const timer = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [p, load]);

  const copyToken = async () => {
    if (!p?.token) return;
    await Clipboard.setStringAsync(p.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (!p?.receiptCode) return;
    try {
      await Share.share({
        message: t("bill.shareText", {
          biller: p.biller.name,
          ref: p.accountRef,
          amount: money(p.amount, p.currency),
          date: shortDateTime(p.completedAt ?? p.createdAt),
          providerRef: p.providerRef ?? "—",
          code: p.receiptCode,
        }),
      });
    } catch { /* partage annulé */ }
  };

  const downloadPdf = async () => {
    if (!p || pdfBusy) return;
    setPdfBusy(true);
    try {
      const res = await shareBillReceiptPdf(p.id, p.reference, t("bill.pdfTitle"));
      if (res === "unavailable") Alert.alert(t("bill.pdfTitle"), t("bill.pdfNA"));
    } catch {
      Alert.alert(t("bill.pdfTitle"), t("bill.pdfFail"));
    } finally {
      setPdfBusy(false);
    }
  };

  const hero = (() => {
    if (!p) return null;
    switch (p.status) {
      case "COMPLETED": return { tone: "pos" as const, icon: "checkmark-circle", message: t("bill.msgCompleted") };
      case "REFUNDED": return { tone: "danger" as const, icon: "return-down-back-outline", message: t("bill.msgRefunded") };
      case "PROCESSING": return { tone: "info" as const, icon: "sync-outline", message: t("bill.msgProcessing") };
      default: return { tone: "warn" as const, icon: "time-outline", message: t("bill.msgSubmitted", { hours: String(hoursLeft(p)) }) };
    }
  })();

  return (
    <Screen header={<NavBar onBack={() => router.back()} title={t("bill.detailTitle")} />}>
      {error && !p ? (
        <ErrorView title={t("bill.notFound")} message={error} onRetry={load} />
      ) : !p || !hero ? (
        <SkeletonRows rows={3} />
      ) : (
        <Rise>
          <StatusHero tone={hero.tone} icon={hero.icon} title={t(`bill.st.${p.status}` as any)} message={hero.message} />
          {p.simulated ? <Notice tone="warn" style={{ marginBottom: 12 }}>{t("bill.simulated")}</Notice> : null}
          {p.status === "REFUNDED" && !!p.failureReason ? <Notice tone="danger" style={{ marginBottom: 12 }}>{t("bill.reason", { reason: p.failureReason })}</Notice> : null}

          {!!p.token && (
            <Card tone="accent" pad={18} style={{ marginBottom: 12 }}>
              <UText v="caption" tone="muted">{t("bill.token")}</UText>
              <UText v="title" selectable style={{ marginVertical: 8, letterSpacing: 1 }}>{p.token}</UText>
              <Button small full={false} kind="soft" icon={copied ? "checkmark" : "copy-outline"} label={copied ? t("bill.copied") : t("bill.copy")} onPress={copyToken} />
            </Card>
          )}

          <Card pad={18}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <UText v="heading" numberOfLines={2} style={{ flex: 1 }}>{p.biller.name}</UText>
              <BillStatusPill status={p.status} />
            </View>
            <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>{billCategoryLabel(p.biller.category)}</UText>
            <Line label={p.referenceLabel} value={p.accountRef} />
            {!!p.customerName && <Line label={t("bill.holderLabel")} value={p.customerName} />}
            {p.fields.map((f) => <Line key={f.label} label={f.label} value={f.value} />)}
            <Divider />
            <Line label={t("bill.lAmount")} value={money(p.amount, p.currency)} />
            <Line label={t("bill.lFee")} value={money(p.feeCharged, p.walletCurrency)} />
            <Line label={t("bill.lTotal")} value={money(p.totalCharged, p.walletCurrency)} strong />
            <Divider />
            <Line label={t("bill.ourRef")} value={p.reference} />
            <Line label={t("bill.date")} value={shortDateTime(p.createdAt)} />
            {!!p.completedAt && <Line label={t("bill.settledOn")} value={shortDateTime(p.completedAt)} />}
            {!!p.providerRef && <Line label={t("bill.providerRef")} value={p.providerRef} />}
            {!!p.receiptNote && <UText v="caption" tone="muted" style={{ marginTop: 6 }}>{p.receiptNote}</UText>}
            {!!p.expectedBy && <Pill label={`${t("bill.expected")} ${shortDateTime(p.expectedBy)}`} tone="warn" icon="time-outline" style={{ marginTop: 10, alignSelf: "flex-start" }} />}
          </Card>

          {p.status === "COMPLETED" && (
            <Button label={t("bill.pdf")} icon="document-text-outline" loading={pdfBusy} onPress={downloadPdf} style={{ marginTop: 16 }} testID="bill-receipt-pdf" />
          )}
          {p.status === "COMPLETED" && !!p.receiptCode && (
            <Button label={t("bill.shareReceipt")} icon="share-outline" kind="outline" onPress={share} style={{ marginTop: 10 }} />
          )}
          <Button
            label={t("bill.payAgain")}
            icon="refresh-outline"
            kind={p.status === "COMPLETED" ? "soft" : "outline"}
            onPress={() => router.push({ pathname: "/bills/biller", params: { id: p.biller.id, ref: p.accountRef } } as any)}
            style={{ marginTop: 10 }}
          />
          <Button
            label={t("bill.sch.scheduleThis")}
            icon="calendar-outline"
            kind="outline"
            onPress={() => router.push({ pathname: "/bills/schedule-new", params: { id: p.biller.id, ref: p.accountRef, amount: String(p.amount) } } as any)}
            style={{ marginTop: 10 }}
          />
          <Button label={t("bill.done")} onPress={() => router.replace("/bills" as any)} style={{ marginTop: 10 }} />
        </Rise>
      )}
    </Screen>
  );
}

/** Heures restantes avant la fin du délai annoncé (au moins 1). */
function hoursLeft(p: BillPaymentView): number {
  if (!p.expectedBy) return 24;
  return Math.max(1, Math.ceil((new Date(p.expectedBy).getTime() - Date.now()) / 3_600_000));
}
