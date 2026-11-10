// apps/direct-transfair-mobile/app/merchant/payment.tsx
// =========================================================
// SUIVI D'UN ENCAISSEMENT v1.0 — Lot 11 (côté marchand)
// QR : grand QR code avec compte à rebours. Téléphone : attente de la validation du client.
// L'écran interroge le serveur toutes les 2 s tant que la demande est en attente et bascule tout seul
// sur « Payé » (ou refusé / expiré / annulé). Le marchand et le client reçoivent aussi une notification.
// Lot 13 : reçu PDF, remboursement intégral (propriétaire ou caissier autorisé, code secret), retour vers l'espace « Caisse »
// quand l'encaissement vient d'un caissier.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, Divider, ErrorView, Field, NavBar, Notice, Screen, Sheet, SkeletonRows, UText, useUI } from "../../components/ui";
import {
  MerchantQrCard, PAYMENT_STATUS_LABEL, PinPrompt, Rise, StatusHero, apiProblem, mmss, money, shortDateTime, useCountdown,
} from "../../components/merchant/merchantUi";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";
import { useReceiptSharer } from "../../components/merchant/ReceiptQr";
import { useT } from "../../providers/I18nProvider";

const POLL_MS = 2000;

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9 }}>
      <UText v="body" tone="muted">{label}</UText>
      <UText v={strong ? "bodyStrong" : "body"} style={{ flexShrink: 1, textAlign: "right" }}>{value}</UText>
    </View>
  );
}

export default function MerchantPaymentScreen() {
  const t = useT();
  const router = useRouter();
  const { C } = useUI();
  const { id, from, merchantId } = useLocalSearchParams<{ id?: string; from?: string; merchantId?: string }>();
  const asCashier = from === "cashier";
  const [p, setP] = useState<PaymentRequestView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundProblem, setRefundProblem] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const alive = useRef(true);
  const terminal = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const v = await api.getPaymentRequest(String(id));
      if (!alive.current) return;
      terminal.current = v.status !== "PENDING";
      setP(v);
      setLoadError(null);
    } catch (e) {
      if (!alive.current) return;
      setLoadError((prev) => prev ?? apiProblem(e).message);
    }
  }, [id]);

  useEffect(() => {
    alive.current = true;
    void load();
    const timer = setInterval(() => { if (!terminal.current) void load(); }, POLL_MS);
    return () => { alive.current = false; clearInterval(timer); };
  }, [load]);

  // Une demande reçue (le marchand est le payeur) a sa propre page.
  useEffect(() => {
    if (p && p.isMine === "PAYER") router.replace({ pathname: "/pay/request", params: { id: p.id } } as any);
  }, [p, router]);

  const logo = useMerchantLogo(p?.merchant.shopId, p?.merchant.logoVersion);
  const sharer = useReceiptSharer(p, "merchant", logo);
  const left = useCountdown(p?.secondsLeft, p?.id);
  useEffect(() => {
    // Le compte à rebours local atteint 0 : on demande tout de suite l'état définitif au serveur.
    if (p?.status === "PENDING" && left === 0) void load();
  }, [left, p?.status, load]);

  const cancel = async () => {
    if (!p) return;
    setCancelling(true);
    setProblem(null);
    try {
      const v = await api.cancelPaymentRequest(p.id);
      terminal.current = true;
      setP(v);
    } catch (e) {
      setProblem(apiProblem(e).message);
      void load();
    } finally {
      setCancelling(false);
    }
  };

  const refund = async (code: string) => {
    if (!p || refunding || code.length !== 6) return;
    setRefunding(true);
    setRefundProblem(null);
    try {
      const v = await api.refundPayment(p.id, { pin: code, reason: reason.trim() || undefined });
      setP(v);
      setRefundOpen(false);
      setPin("");
      setReason("");
    } catch (e) {
      setRefundProblem(apiProblem(e).message);
      setPin("");
    } finally {
      setRefunding(false);
    }
  };

  const receipt = async () => {
    setSharing(true);
    try { await sharer.share(); } finally { setSharing(false); }
  };

  if (!p) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title={t("mpd.title")} />}>
        {loadError ? <ErrorView title={t("mpd.notFound")} message={loadError} onRetry={() => { setLoadError(null); void load(); }} /> : <SkeletonRows rows={3} />}
      </Screen>
    );
  }

  const total = Math.max(1, Math.round((new Date(p.expiresAt).getTime() - new Date(p.createdAt).getTime()) / 1000));
  const done = p.status !== "PENDING";
  const goHome = () => router.replace((asCashier ? "/cashier" : "/merchant") as any);
  const canRefund = p.status === "PAID" && !p.refunded && !!p.canRefund;

  return (
    <Screen
      header={<NavBar onBack={goHome} title={p.reference} subtitle={p.method === "QR" ? t("mpd.viaQr") : t("mpd.viaPhone")} />}
      footer={
        done ? (
          <View style={{ gap: 10 }}>
            <Button label={t("mpd.newCollect")} icon="add" onPress={() => router.replace({ pathname: "/merchant/collect", params: { mode: p.method === "QR" ? "qr" : "phone", ...(merchantId ? { merchantId: String(merchantId), from: "cashier" } : {}) } } as any)} />
            {p.status === "PAID" && <Button label={t("pco.receipt")} icon="document-text-outline" kind="outline" loading={sharing} onPress={receipt} />}
            {canRefund && <Button label={t("mpd.refundBtn")} icon="return-down-back-outline" kind="danger" onPress={() => { setRefundProblem(null); setPin(""); setRefundOpen(true); }} />}
            <Button label={t("pco.finish")} kind="ghost" onPress={goHome} />
          </View>
        ) : (
          <Button label={t("mpd.cancelBtn")} kind="outline" loading={cancelling} onPress={cancel} />
        )
      }
    >
      {sharer.qrNode}
      {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}

      {p.status === "PENDING" && p.method === "QR" && p.qrPayload ? (
        <Rise>
          <MerchantQrCard payload={p.qrPayload} amountLabel={money(p.amount, p.currency)} secondsLeft={left} totalSeconds={total} businessName={p.merchant.businessName} />
          <Notice tone="info" icon="scan-outline" style={{ marginTop: 14 }}>
            {t("mpd.qrTip")}
          </Notice>
        </Rise>
      ) : null}

      {p.status === "PENDING" && p.method === "PHONE" ? (
        <Rise>
          <Card pad={24} style={{ alignItems: "center", gap: 10 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.warnBg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="hourglass-outline" size={38} color={C.warn} />
            </View>
            <UText v="hero" align="center">{money(p.amount, p.currency)}</UText>
            <UText v="body" tone="muted" align="center">
              {t("mpd.sentTo", { who: p.payer?.name ?? p.payerPhone ?? t("mpd.yourCustomer") })}
            </UText>
            <UText v="bodyStrong" tone={left <= 30 ? "danger" : "warn"}>{t("mpd.expiresIn", { time: mmss(left) })}</UText>
          </Card>
        </Rise>
      ) : null}

      {p.status === "PAID" && !p.refunded ? (
        <StatusHero tone="pos" icon="checkmark-circle" title={t("mpd.received")} message={t("mpd.receivedMsg", { amount: money(p.netAmount ?? p.amount, p.currency) })} />
      ) : null}
      {p.status === "PAID" && p.refunded ? (
        <StatusHero tone="info" icon="return-down-back-outline" title={t("mpd.refunded")} message={p.refundedAt ? t("mpd.refundedOn", { amount: money(p.amount, p.currency), date: shortDateTime(p.refundedAt) }) : t("mpd.refundedMsg", { amount: money(p.amount, p.currency) })} />
      ) : null}
      {p.status === "DECLINED" ? <StatusHero tone="danger" icon="close-circle" title={t("mpd.declined")} message={p.failureReason ?? t("mpd.declinedMsg")} /> : null}
      {p.status === "EXPIRED" ? <StatusHero tone="warn" icon="time-outline" title={t("mpd.expired")} message={t("mpd.expiredMsg")} /> : null}
      {p.status === "CANCELLED" ? <StatusHero tone="info" icon="ban-outline" title={t("mpd.cancelled")} /> : null}

      <Card pad={18} style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <ShopAvatar shopId={p.merchant.shopId} version={p.merchant.logoVersion} name={p.merchant.businessName} size={40} />
          <UText v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{p.merchant.businessName}</UText>
        </View>
        <Divider />
        <Detail label={t("mpd.status")} value={p.refunded ? t("mst.refunded") : PAYMENT_STATUS_LABEL[p.status]} strong />
        {p.viaStaticQr && <Detail label={t("mpd.means")} value={t("mpd.staticQr")} />}
        <Divider />
        <Detail label={t("mpd.paidByCustomer")} value={money(p.amount, p.currency)} />
        {p.fee !== undefined && <Detail label={t("mpd.fee")} value={money(p.fee, p.currency)} />}
        {p.netAmount !== undefined && <Detail label={t("mpd.youReceive")} value={money(p.netAmount, p.currency)} strong />}
        <Divider />
        {p.payer && <Detail label={t("mpd.customer")} value={p.payer.name} />}
        {!p.payer && p.payerPhone ? <Detail label={t("mpd.customerPhone")} value={p.payerPhone} /> : null}
        <Detail label={t("pco.reference")} value={p.reference} />
        <Detail label={t("mpd.createdOn")} value={shortDateTime(p.createdAt)} />
        {p.paidAt && <Detail label={t("mpd.paidOn")} value={shortDateTime(p.paidAt)} />}
        {!!p.note && <Detail label={t("mpd.label")} value={p.note} />}
        {p.refunded && !!p.refundReason && <Detail label={t("mpd.refundReason")} value={p.refundReason} />}
      </Card>

      <Sheet visible={refundOpen} onClose={() => setRefundOpen(false)} title={t("mpd.refundTitle")}>
        <Notice tone="warn" style={{ marginBottom: 12 }}>
          {t("mpd.refundFull", { amount: money(p.amount, p.currency) })}{" "}
          {p.refundReturnsFee
            ? t("mpd.refundFeeBack", { fee: money(p.fee ?? 0, p.currency), net: money(p.netAmount ?? p.amount, p.currency) })
            : t("mpd.refundFeeKept", { fee: money(p.fee ?? 0, p.currency) })}
        </Notice>
        {!!refundProblem && <Notice tone="danger" style={{ marginBottom: 12 }}>{refundProblem}</Notice>}
        <Field label={t("mpd.reasonOpt")} icon="create-outline" value={reason} onChangeText={setReason} maxLength={140} autoCapitalize="sentences" />
        <PinPrompt value={pin} onChange={setPin} onComplete={refund} />
        <View style={{ height: 12 }} />
        <Button label={t("mpd.confirmRefund")} kind="danger" loading={refunding} disabled={pin.length !== 6} onPress={() => refund(pin)} />
      </Sheet>
    </Screen>
  );
}
