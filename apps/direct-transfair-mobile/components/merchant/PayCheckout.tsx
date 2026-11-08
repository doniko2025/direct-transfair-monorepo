// apps/direct-transfair-mobile/components/merchant/PayCheckout.tsx
// =========================================================
// PAIEMENT D'UN MARCHAND — côté client (Lot 11)
// Même carte pour « Payer avec QR code » (après le scan) et pour une demande reçue sur le téléphone :
// le client vérifie le montant et le commerce, saisit son code secret, valide. Le débit du client et le crédit
// du marchand se font en une seule opération côté serveur ; les deux reçoivent une notification (et un email).
// Gère : code secret faux / bloqué, identité non vérifiée, solde insuffisant, demande expirée ou déjà réglée.
// Lot 13 : logo du commerce, reçu PDF après paiement.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { isKycRequired, kycRequiredMessage, KYC_SCREEN } from "../../utils/kycGate";
import { Button, Card, Divider, Notice, Pill, UText } from "../ui";
import { PinPrompt, Rise, StatusHero, apiProblem, mmss, money, shortDateTime, useCountdown } from "./merchantUi";
import { ShopAvatar } from "./ShopAvatar";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";
import { useReceiptSharer } from "./ReceiptQr";

type Props = {
  view: PaymentRequestView;
  /** Lance le paiement avec le code secret (QR : payQr, demande : payPaymentRequest). */
  onPay: (pin: string) => Promise<PaymentRequestView>;
  /** Refuser la demande (demandes reçues uniquement). */
  onDecline?: () => Promise<PaymentRequestView>;
  onFinish: () => void;
};

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 }}>
      <UText v="body" tone="muted">{label}</UText>
      <UText v={strong ? "bodyStrong" : "body"} style={{ flexShrink: 1, textAlign: "right" }}>{value}</UText>
    </View>
  );
}

export default function PayCheckout({ view, onPay, onDecline, onFinish }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(view);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ tone: "danger" | "warn"; text: string; kyc?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [finished, setFinished] = useState<"paid" | "declined" | null>(null);
  const submitting = useRef(false);
  const [sharing, setSharing] = useState(false);
  const logo = useMerchantLogo(view.merchant.shopId, view.merchant.logoVersion);

  useEffect(() => { setCurrent(view); }, [view]);

  const sharer = useReceiptSharer(current, "payer", logo);
  const receipt = async () => {
    setSharing(true);
    try { await sharer.share(); } finally { setSharing(false); }
  };

  useEffect(() => {
    let alive = true;
    api.getMyWallets()
      .then((ws) => { if (alive) setBalance(ws.find((w) => w.currency === view.currency)?.balance ?? 0); })
      .catch(() => { /* le solde est une aide, pas une condition */ });
    return () => { alive = false; };
  }, [view.currency]);

  const left = useCountdown(current.secondsLeft, current.id);
  const open = current.status === "PENDING" && left > 0 && !finished;
  const short = balance !== null && balance < current.amount;

  const pay = async () => {
    if (!open || pin.length !== 6 || submitting.current) return;
    submitting.current = true; // évite un double envoi (double appui) : le serveur est aussi protégé, ceci évite l'erreur affichée
    setBusy(true);
    setProblem(null);
    setPinError(null);
    try {
      const res = await onPay(pin);
      setCurrent(res);
      setFinished("paid");
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else if (isKycRequired(e)) setProblem({ tone: "warn", text: kycRequiredMessage(e), kyc: true });
      else if (pr.code === "PAYMENT_EXPIRED" || pr.status === 410) setCurrent((c) => ({ ...c, status: "EXPIRED" }));
      else if (pr.code === "PAYMENT_CLOSED" || pr.status === 409) setProblem({ tone: "warn", text: pr.message });
      else setProblem({ tone: "danger", text: pr.message });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!onDecline) return;
    setBusy(true);
    setProblem(null);
    try {
      setCurrent(await onDecline());
      setFinished("declined");
    } catch (e) {
      setProblem({ tone: "danger", text: apiProblem(e).message });
    } finally {
      setBusy(false);
    }
  };

  // ── Résultats ──
  if (finished === "paid" || current.status === "PAID") {
    return (
      <View>
        {sharer.qrNode}
        <StatusHero tone="pos" icon="checkmark-circle" title="Paiement effectué" message={`${money(current.amount, current.currency)} payés à ${current.merchant.businessName}.`} />
        <Card pad={18}>
          <Line label="Commerce" value={current.merchant.businessName} />
          <Line label="Montant débité" value={money(current.amount, current.currency)} strong />
          <Divider />
          <Line label="Référence" value={current.reference} />
          <Line label="Date" value={shortDateTime(current.paidAt ?? current.createdAt)} />
        </Card>
        <Button label="Reçu (PDF)" icon="document-text-outline" kind="outline" loading={sharing} onPress={receipt} style={{ marginTop: 18 }} />
        <Button label="Terminer" onPress={onFinish} style={{ marginTop: 10 }} />
      </View>
    );
  }
  if (current.status === "DECLINED" || finished === "declined") {
    return <View><StatusHero tone="info" icon="close-circle" title="Demande refusée" message="Le marchand a été prévenu." /><Button label="Terminer" onPress={onFinish} /></View>;
  }
  if (current.status === "EXPIRED" || (current.status === "PENDING" && left === 0)) {
    return <View><StatusHero tone="warn" icon="time-outline" title="Demande expirée" message="Ce paiement n'est plus valable. Demandez au marchand d'en créer un nouveau." /><Button label="Terminer" onPress={onFinish} /></View>;
  }
  if (current.status === "CANCELLED") {
    return <View><StatusHero tone="info" icon="ban-outline" title="Paiement annulé" message="Le marchand a annulé cette demande." /><Button label="Terminer" onPress={onFinish} /></View>;
  }

  // ── À payer ──
  return (
    <Rise>
      <Card pad={22} style={{ alignItems: "center", gap: 6 }}>
        <View style={{ marginBottom: 4 }}>
          <ShopAvatar shopId={current.merchant.shopId} version={current.merchant.logoVersion} name={current.merchant.businessName} size={64} />
        </View>
        <UText v="heading" align="center" numberOfLines={2}>{current.merchant.businessName}</UText>
        {!!(current.merchant.category || current.merchant.city) && (
          <UText v="caption" tone="muted" align="center">{[current.merchant.category, current.merchant.city].filter(Boolean).join(" · ")}</UText>
        )}
        <UText v="hero" align="center" style={{ marginTop: 10 }}>{money(current.amount, current.currency)}</UText>
        {!!current.note && <UText v="body" tone="muted" align="center">{current.note}</UText>}
        <Pill label={`Valable ${mmss(left)}`} tone={left <= 30 ? "danger" : "warn"} icon="time-outline" style={{ marginTop: 8 }} />
      </Card>

      <Notice tone="info" style={{ marginTop: 14 }}>
        Vérifiez que ce montant correspond à celui affiché sur le téléphone du marchand avant de confirmer.
      </Notice>

      {balance !== null && (
        <UText v="caption" tone={short ? "danger" : "muted"} align="center" style={{ marginTop: 12 }}>
          {short ? `Solde insuffisant : ${money(balance, current.currency)} disponibles.` : `Votre solde : ${money(balance, current.currency)}`}
        </UText>
      )}

      {problem && (
        <Notice tone={problem.tone} style={{ marginTop: 14 }} action={problem.kyc ? "Vérifier mon identité" : undefined} onAction={problem.kyc ? () => router.push(KYC_SCREEN as any) : undefined}>
          {problem.text}
        </Notice>
      )}

      <View style={{ height: 18 }} />
      <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label="Code secret pour payer" autoFocus />
      <Button label={`Payer ${money(current.amount, current.currency)}`} icon="lock-closed-outline" disabled={pin.length !== 6 || short} loading={busy} onPress={pay} testID="pay-confirm" />
      {onDecline && <Button label="Refuser la demande" kind="ghost" disabled={busy} onPress={decline} style={{ marginTop: 8 }} />}
    </Rise>
  );
}
