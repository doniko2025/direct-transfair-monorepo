// apps/direct-transfair-mobile/app/merchant/payment.tsx
// =========================================================
// SUIVI D'UN ENCAISSEMENT v1.0 — Lot 11 (côté marchand)
// QR : grand QR code avec compte à rebours. Téléphone : attente de la validation du client.
// L'écran interroge le serveur toutes les 2 s tant que la demande est en attente et bascule tout seul
// sur « Payé » (ou refusé / expiré / annulé). Le marchand et le client reçoivent aussi une notification.
// Lot 13 : reçu PDF, remboursement intégral (propriétaire ou caissier autorisé, code secret), retour vers l'espace « Caisse »
// quand l'encaissement vient d'un caissier.
// v1.1 : page « Paiement reçu » refaite — montant + devise sur UNE ligne, achat (libellé), date et heure séparées, mode de paiement,
//        délai de règlement, référence copiable, suivi en trois temps (créé → payé → remboursé).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, Divider, ErrorView, Field, NavBar, Notice, Pill, Screen, Sheet, SkeletonRows, UText, useUI } from "../../components/ui";
import { Text } from "../../components/ui/Text";
import { fmtDateTime } from "../../i18n/runtime";
import {
  MerchantQrCard, PAYMENT_STATUS_LABEL, PinPrompt, Rise, StatusHero, apiProblem, mmss, money, shortDateTime, useCountdown,
} from "../../components/merchant/merchantUi";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";
import { useReceiptSharer } from "../../components/merchant/ReceiptQr";
import { useT } from "../../providers/I18nProvider";

const POLL_MS = 2000;

/** Espaces insécables : « 5 000 GNF » ne se coupe jamais en deux lignes. */
const nb = (v: string) => v.replace(/\s/g, "\u00A0");
const dateLong = (iso: string) => fmtDateTime(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeLong = (iso: string) => fmtDateTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** « 12 s » · « 1 min 05 s » : temps écoulé entre la création et le paiement. */
function elapsed(fromIso: string, toIso: string): string {
  const sec = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min ${String(sec % 60).padStart(2, "0")} s`;
}

/** Ligne libellé / valeur : le libellé passe à la ligne si besoin, la valeur (montant, date…) reste entière sur une ligne. */
function Detail({ label, value, strong, nowrap = true, icon, onPress }: { label: string; value: string; strong?: boolean; nowrap?: boolean; icon?: string; onPress?: () => void }) {
  const { C } = useUI();
  const row = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10 }}>
      <UText v="body" tone="muted" style={{ flexShrink: 1 }}>{label}</UText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: nowrap ? 0 : 1, maxWidth: "70%" }}>
        <UText v={strong ? "bodyStrong" : "body"} numberOfLines={nowrap ? 1 : 3} style={{ textAlign: "right", flexShrink: 1, fontWeight: strong ? "800" : "600" }}>{nowrap ? nb(value) : value}</UText>
        {!!icon && <Ionicons name={icon as any} size={15} color={C.muted} />}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{row}</Pressable> : row;
}

/** Carte à titre (icône + titre en tête) : même gabarit pour tous les blocs de la page. */
function Block({ icon, title, children, delay = 0 }: { icon: string; title: string; children: React.ReactNode; delay?: number }) {
  const { C } = useUI();
  return (
    <Rise delay={delay}>
      <Card pad={16} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon as any} size={14} color={C.accentDeep} />
          </View>
          <UText v="overline" tone="muted">{title}</UText>
        </View>
        {children}
      </Card>
    </Rise>
  );
}

/** Bandeau « Paiement reçu » : montant et devise sur une même ligne, statut, date et heure. */
function PaidHero({ p, title, amountLabel, caption, refunded }: { p: PaymentRequestView; title: string; amountLabel: string; caption: string; refunded: boolean }) {
  const { C } = useUI();
  const colors: [string, string] = refunded ? [C.info, C.infoLine] : ["#15803D", "#0F5F2E"];
  const at = refunded && p.refundedAt ? p.refundedAt : p.paidAt ?? p.createdAt;
  return (
    <Rise>
      <View style={{ borderRadius: 26, overflow: "hidden", marginTop: 4 }}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={{ position: "absolute", right: -30, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.10)" }} />
        <View pointerEvents="none" style={{ position: "absolute", left: -20, bottom: -50, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.07)" }} />
        <View style={{ padding: 20, alignItems: "center", gap: 6 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={(refunded ? "return-down-back-outline" : "checkmark") as any} size={28} color="#FFFFFF" />
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", opacity: 0.92 }}>{title}</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 34, fontWeight: "800", letterSpacing: -0.8, textAlign: "center", maxWidth: "100%" }} numberOfLines={1} adjustsFontSizeToFit>{nb(amountLabel)}</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 13, opacity: 0.85, textAlign: "center" }}>{caption}</Text>
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name={"calendar-outline" as any} size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>{nb(shortDateTime(at))}</Text>
          </View>
        </View>
      </View>
    </Rise>
  );
}

/** Suivi en trois temps : créé → payé → remboursé (seuls les temps atteints sont affichés). */
function Timeline({ steps }: { steps: { key: string; label: string; at: string; tone: "pos" | "info" | "muted" }[] }) {
  const { C } = useUI();
  return (
    <View style={{ paddingTop: 6 }}>
      {steps.map((st, i) => {
        const dot = st.tone === "pos" ? C.pos : st.tone === "info" ? C.info : C.faint;
        return (
          <View key={st.key} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", width: 18 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dot, marginTop: 3, borderWidth: 3, borderColor: C.surface, shadowColor: dot, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
              {i < steps.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: C.line, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 14 : 2 }}>
              <UText v="bodyStrong">{st.label}</UText>
              <UText v="caption" tone="muted">{nb(`${dateLong(st.at)} · ${timeLong(st.at)}`)}</UText>
            </View>
          </View>
        );
      })}
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
  const [copied, setCopied] = useState(false);
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

      {p.status === "PAID" ? (
        <PaidHero
          p={p}
          refunded={!!p.refunded}
          title={p.refunded ? t("mpd.refunded") : t("mpd.received")}
          amountLabel={p.refunded ? money(p.amount, p.currency) : money(p.netAmount ?? p.amount, p.currency)}
          caption={p.refunded ? t("mpd.refundedCaption") : t("mpd.addedToBalance")}
        />
      ) : null}
      {p.status === "DECLINED" ? <StatusHero tone="danger" icon="close-circle" title={t("mpd.declined")} message={p.failureReason ?? t("mpd.declinedMsg")} /> : null}
      {p.status === "EXPIRED" ? <StatusHero tone="warn" icon="time-outline" title={t("mpd.expired")} message={t("mpd.expiredMsg")} /> : null}
      {p.status === "CANCELLED" ? <StatusHero tone="info" icon="ban-outline" title={t("mpd.cancelled")} /> : null}

      {/* ── Achat : le produit / libellé saisi à l'encaissement ── */}
      <Block icon="bag-handle-outline" title={t("mpd.purchase")} delay={80}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6, paddingBottom: 4 }}>
          <ShopAvatar shopId={p.merchant.shopId} version={p.merchant.logoVersion} name={p.merchant.businessName} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong" numberOfLines={1}>{p.merchant.businessName}</UText>
            {!!(p.merchant.address || p.merchant.city) && <UText v="caption" tone="muted" numberOfLines={1}>{[p.merchant.address, p.merchant.city].filter(Boolean).join(", ")}</UText>}
          </View>
          <Pill label={p.refunded ? t("mst.refunded") : PAYMENT_STATUS_LABEL[p.status]} tone={p.refunded ? "info" : p.status === "PAID" ? "pos" : p.status === "PENDING" ? "warn" : p.status === "DECLINED" ? "danger" : "neutral"} />
        </View>
        <Divider />
        <Detail label={t("mpd.item")} value={p.note?.trim() ? p.note.trim() : t("mpd.noItem")} strong={!!p.note?.trim()} nowrap={false} />
      </Block>

      {/* ── Détail des montants ── */}
      <Block icon="cash-outline" title={t("mpd.amounts")} delay={140}>
        <Detail label={t("mpd.paidByCustomer")} value={money(p.amount, p.currency)} />
        {p.fee !== undefined && <Detail label={t("mpd.fee")} value={`− ${money(p.fee, p.currency)}`} />}
        {p.netAmount !== undefined && (
          <View style={{ marginTop: 6, backgroundColor: C.posBg, borderRadius: 14, paddingHorizontal: 12 }}>
            <Detail label={t("mpd.youReceive")} value={money(p.netAmount, p.currency)} strong />
          </View>
        )}
      </Block>

      {/* ── Informations ── */}
      <Block icon="information-circle-outline" title={t("mpd.infos")} delay={200}>
        {p.payer && <Detail label={t("mpd.customer")} value={p.payer.name} nowrap={false} />}
        {!p.payer && p.payerPhone ? <Detail label={t("mpd.customerPhone")} value={p.payerPhone} /> : null}
        <Detail label={t("mpd.means")} value={p.viaStaticQr ? t("mpd.staticQr") : p.method === "QR" ? t("mpd.viaQr") : t("mpd.viaPhone")} nowrap={false} />
        <Detail
          label={t("pco.reference")}
          value={p.reference}
          icon="copy-outline"
          onPress={async () => { await Clipboard.setStringAsync(p.reference); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
        />
        {copied && <UText v="caption" tone="pos" align="right">{t("mpd.refCopied")}</UText>}
        <Divider />
        <Detail label={t("mpd.date")} value={dateLong(p.paidAt ?? p.createdAt)} />
        <Detail label={t("mpd.time")} value={timeLong(p.paidAt ?? p.createdAt)} />
        {p.paidAt && <Detail label={t("mpd.settledIn")} value={elapsed(p.createdAt, p.paidAt)} />}
        {p.refunded && !!p.refundReason && <Detail label={t("mpd.refundReason")} value={p.refundReason} nowrap={false} />}
        {!!p.failureReason && p.status !== "PAID" && <Detail label={t("mpd.failureReason")} value={p.failureReason} nowrap={false} />}
      </Block>

      {/* ── Suivi ── */}
      {p.status === "PAID" && (
        <Block icon="git-commit-outline" title={t("mpd.timeline")} delay={260}>
          <Timeline
            steps={[
              { key: "c", label: t("mpd.tlCreated"), at: p.createdAt, tone: "muted" },
              ...(p.paidAt ? [{ key: "p", label: t("mpd.tlPaid"), at: p.paidAt, tone: "pos" as const }] : []),
              ...(p.refunded && p.refundedAt ? [{ key: "r", label: t("mpd.tlRefunded"), at: p.refundedAt, tone: "info" as const }] : []),
            ]}
          />
        </Block>
      )}

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
