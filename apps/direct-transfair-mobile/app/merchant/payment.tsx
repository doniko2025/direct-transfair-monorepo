// apps/direct-transfair-mobile/app/merchant/payment.tsx
// =========================================================
// SUIVI D'UN ENCAISSEMENT v1.0 — Lot 11 (côté marchand)
// QR : grand QR code avec compte à rebours. Téléphone : attente de la validation du client.
// L'écran interroge le serveur toutes les 2 s tant que la demande est en attente et bascule tout seul
// sur « Payé » (ou refusé / expiré / annulé). Le marchand et le client reçoivent aussi une notification.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, Divider, ErrorView, NavBar, Notice, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import {
  MerchantQrCard, PAYMENT_STATUS_LABEL, Rise, StatusHero, apiProblem, mmss, money, shortDateTime, useCountdown,
} from "../../components/merchant/merchantUi";

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
  const router = useRouter();
  const { C } = useUI();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [p, setP] = useState<PaymentRequestView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
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
    const t = setInterval(() => { if (!terminal.current) void load(); }, POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  // Une demande reçue (le marchand est le payeur) a sa propre page.
  useEffect(() => {
    if (p && p.isMine === "PAYER") router.replace({ pathname: "/pay/request", params: { id: p.id } } as any);
  }, [p, router]);

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

  if (!p) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title="Encaissement" />}>
        {loadError ? <ErrorView title="Paiement introuvable" message={loadError} onRetry={() => { setLoadError(null); void load(); }} /> : <SkeletonRows rows={3} />}
      </Screen>
    );
  }

  const total = Math.max(1, Math.round((new Date(p.expiresAt).getTime() - new Date(p.createdAt).getTime()) / 1000));
  const done = p.status !== "PENDING";
  const goHome = () => router.replace("/merchant" as any);

  return (
    <Screen
      header={<NavBar onBack={goHome} title={p.reference} subtitle={p.method === "QR" ? "Paiement par QR code" : "Paiement par téléphone"} />}
      footer={
        done ? (
          <View style={{ gap: 10 }}>
            <Button label="Nouvel encaissement" icon="add" onPress={() => router.replace({ pathname: "/merchant/collect", params: { mode: p.method === "QR" ? "qr" : "phone" } } as any)} />
            <Button label="Terminer" kind="ghost" onPress={goHome} />
          </View>
        ) : (
          <Button label="Annuler cet encaissement" kind="outline" loading={cancelling} onPress={cancel} />
        )
      }
    >
      {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}

      {p.status === "PENDING" && p.method === "QR" && p.qrPayload ? (
        <Rise>
          <MerchantQrCard payload={p.qrPayload} amountLabel={money(p.amount, p.currency)} secondsLeft={left} totalSeconds={total} businessName={p.merchant.businessName} />
          <Notice tone="info" icon="scan-outline" style={{ marginTop: 14 }}>
            Demandez à votre client de choisir « Payer avec QR code » dans son application, de scanner ce code puis de confirmer avec son code secret.
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
              Demande envoyée à {p.payer?.name ?? p.payerPhone ?? "votre client"}. Il doit la valider sur son téléphone avec son code secret.
            </UText>
            <UText v="bodyStrong" tone={left <= 30 ? "danger" : "warn"}>Expire dans {mmss(left)}</UText>
          </Card>
        </Rise>
      ) : null}

      {p.status === "PAID" ? (
        <StatusHero tone="pos" icon="checkmark-circle" title="Paiement reçu" message={`${money(p.netAmount ?? p.amount, p.currency)} ajoutés à votre solde.`} />
      ) : null}
      {p.status === "DECLINED" ? <StatusHero tone="danger" icon="close-circle" title="Paiement refusé" message={p.failureReason ?? "Votre client a refusé la demande."} /> : null}
      {p.status === "EXPIRED" ? <StatusHero tone="warn" icon="time-outline" title="Demande expirée" message="Le délai est dépassé. Créez un nouvel encaissement." /> : null}
      {p.status === "CANCELLED" ? <StatusHero tone="info" icon="ban-outline" title="Encaissement annulé" /> : null}

      <Card pad={18} style={{ marginTop: 16 }}>
        <Detail label="Statut" value={PAYMENT_STATUS_LABEL[p.status]} strong />
        <Divider />
        <Detail label="Montant payé par le client" value={money(p.amount, p.currency)} />
        {p.fee !== undefined && <Detail label="Frais de service" value={money(p.fee, p.currency)} />}
        {p.netAmount !== undefined && <Detail label="Vous recevez" value={money(p.netAmount, p.currency)} strong />}
        <Divider />
        {p.payer && <Detail label="Client" value={p.payer.name} />}
        {!p.payer && p.payerPhone ? <Detail label="Numéro du client" value={p.payerPhone} /> : null}
        <Detail label="Référence" value={p.reference} />
        <Detail label="Créé le" value={shortDateTime(p.createdAt)} />
        {p.paidAt && <Detail label="Payé le" value={shortDateTime(p.paidAt)} />}
        {!!p.note && <Detail label="Libellé" value={p.note} />}
      </Card>
    </Screen>
  );
}
