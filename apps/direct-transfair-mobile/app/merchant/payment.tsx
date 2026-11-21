// apps/direct-transfair-mobile/app/merchant/payment.tsx
// =========================================================
// SUIVI D'UN ENCAISSEMENT v1.0 — Lot 11 (côté marchand)
// QR : grand QR code avec compte à rebours. Téléphone : attente de la validation du client.
// L'écran interroge le serveur toutes les 2 s tant que la demande est en attente et bascule tout seul
// sur « Payé » (ou refusé / expiré / annulé). Le marchand et le client reçoivent aussi une notification.
// Lot 13 : reçu PDF, remboursement intégral (propriétaire ou caissier autorisé, code secret), retour vers l'espace « Caisse »
// quand l'encaissement vient d'un caissier.
// v1.3 : sans id dans l'URL, redirection vers /merchant/collect (plus de squelettes infinis).
// v1.2 : « petit ménage » — UN seul vert (celui de la marque), une seule grande action en bas (Nouvel encaissement), Reçu / Rembourser / Accueil
//        en petites tuiles sous le bandeau, et des cartes COMPACTES (montants en 3 colonnes, informations en grille, suivi en frise horizontale).
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
import { alpha, shade } from "../../components/ui/Tint";
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

/** Date courte (« 15 nov. 2026 »). */
const dateShort = (iso: string) => fmtDateTime(iso, { day: "numeric", month: "short", year: "numeric" });

/** Carte compacte : même gabarit pour tous les blocs de la page. */
function MiniCard({ children, delay = 0, pad = 12 }: { children: React.ReactNode; delay?: number; pad?: number }) {
  return (
    <Rise delay={delay}>
      <Card pad={pad} style={{ marginTop: 10 }}>{children}</Card>
    </Rise>
  );
}

/** Case « libellé au-dessus, valeur dessous » (grille d'informations). */
function Cell({ label, value, icon, onPress, wide, accent }: { label: string; value: string; icon?: string; onPress?: () => void; wide?: boolean; accent?: boolean }) {
  const { C } = useUI();
  const body = (
    <View style={{ gap: 2 }}>
      <UText v="caption" tone="muted" numberOfLines={1}>{label}</UText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <UText v="bodyStrong" numberOfLines={wide ? 3 : 1} style={{ fontSize: 14, flexShrink: 1, color: accent ? C.accentDeep : undefined }}>{value}</UText>
        {!!icon && <Ionicons name={icon as any} size={14} color={C.muted} />}
      </View>
    </View>
  );
  return (
    <View style={{ width: wide ? "100%" : "48%", flexGrow: wide ? 0 : 1, minWidth: 0 }}>
      {onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body}
    </View>
  );
}

/** Petite tuile d'action (icône ronde + libellé) : remplace les gros boutons empilés. */
function ActionTile({ icon, label, onPress, tone = "neutral", loading }: { icon: string; label: string; onPress: () => void; tone?: "neutral" | "danger"; loading?: boolean }) {
  const { C } = useUI();
  const col = tone === "danger" ? C.danger : C.text;
  return (
    <Pressable onPress={onPress} disabled={loading} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed || loading ? 0.65 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: tone === "danger" ? alpha(C.danger, 0.35) : C.line, backgroundColor: tone === "danger" ? alpha(C.danger, 0.07) : C.surface, paddingVertical: 10, alignItems: "center", gap: 6 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tone === "danger" ? alpha(C.danger, 0.14) : C.sunken, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon as any} size={18} color={col} />
        </View>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: col, maxWidth: "92%" }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Bandeau « Paiement reçu » compact : UN seul vert (couleur de la marque, comme le bouton), montant et devise sur une ligne. */
function PaidHero({ p, title, amountLabel, caption, refunded }: { p: PaymentRequestView; title: string; amountLabel: string; caption: string; refunded: boolean }) {
  const { C } = useUI();
  const base = refunded ? C.info : C.accent;
  const ink = refunded ? "#FFFFFF" : C.accentInk;
  const at = refunded && p.refundedAt ? p.refundedAt : p.paidAt ?? p.createdAt;
  return (
    <Rise>
      <View style={{ borderRadius: 22, overflow: "hidden", marginTop: 2 }}>
        <LinearGradient colors={[base, shade(base, 0.28)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={{ position: "absolute", right: -26, top: -34, width: 120, height: 120, borderRadius: 60, backgroundColor: alpha(ink, 0.1) }} />
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: alpha(ink, 0.2), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={(refunded ? "return-down-back-outline" : "checkmark") as any} size={24} color={ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: "700", opacity: 0.9 }} numberOfLines={1}>{title} · {nb(shortDateTime(at))}</Text>
            <Text style={{ color: ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.6 }} numberOfLines={1} adjustsFontSizeToFit>{nb(amountLabel)}</Text>
            <Text style={{ color: ink, fontSize: 12, opacity: 0.8 }} numberOfLines={1}>{caption}</Text>
          </View>
        </View>
      </View>
    </Rise>
  );
}

/** Suivi horizontal : créé → payé → remboursé, avec l'heure sous chaque étape. */
function Stepper({ steps }: { steps: { key: string; label: string; at: string; tone: "pos" | "info" | "muted" }[] }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row" }}>
      {steps.map((st, i) => {
        const dot = st.tone === "pos" ? C.accent : st.tone === "info" ? C.info : C.faint;
        return (
          <View key={st.key} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? "transparent" : C.line }} />
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dot, borderWidth: 3, borderColor: C.surface, shadowColor: dot, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
              <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? "transparent" : C.line }} />
            </View>
            <UText v="caption" style={{ fontWeight: "700", marginTop: 4 }} numberOfLines={1}>{st.label}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{nb(timeLong(st.at))}</UText>
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

  // Garde-fou : cette page suit UN encaissement précis. Sans id (lien incomplet), on renvoie vers « Nouvel encaissement »
  // au lieu de laisser des squelettes à l'infini.
  useEffect(() => {
    if (!id) router.replace({ pathname: "/merchant/collect", params: merchantId ? { merchantId: String(merchantId), from: "cashier" } : {} } as any);
  }, [id, merchantId, router]);

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
          <Button label={t("mpd.newCollect")} icon="add" onPress={() => router.replace({ pathname: "/merchant/collect", params: { mode: p.method === "QR" ? "qr" : "phone", ...(merchantId ? { merchantId: String(merchantId), from: "cashier" } : {}) } } as any)} />
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

      {/* ── Actions : trois petites tuiles au lieu de trois gros boutons ── */}
      {done && (
        <Rise delay={60}>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            {p.status === "PAID" && <ActionTile icon="document-text-outline" label={t("mpd.actReceipt")} loading={sharing} onPress={receipt} />}
            {canRefund && <ActionTile icon="return-down-back-outline" label={t("mpd.actRefund")} tone="danger" onPress={() => { setRefundProblem(null); setPin(""); setRefundOpen(true); }} />}
            <ActionTile icon="home-outline" label={t("mpd.actHome")} onPress={goHome} />
          </View>
        </Rise>
      )}

      {/* ── Achat : commerce, statut et article ── */}
      <MiniCard delay={100}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ShopAvatar shopId={p.merchant.shopId} version={p.merchant.logoVersion} name={p.merchant.businessName} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong" numberOfLines={1}>{p.merchant.businessName}</UText>
            {!!(p.merchant.address || p.merchant.city) && <UText v="caption" tone="muted" numberOfLines={1}>{[p.merchant.address, p.merchant.city].filter(Boolean).join(", ")}</UText>}
          </View>
          <Pill label={p.refunded ? t("mst.refunded") : PAYMENT_STATUS_LABEL[p.status]} tone={p.refunded ? "info" : p.status === "PAID" ? "pos" : p.status === "PENDING" ? "warn" : p.status === "DECLINED" ? "danger" : "neutral"} />
        </View>
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
          <Ionicons name={"bag-handle-outline" as any} size={16} color={C.accentDeep} />
          <UText v="caption" tone="muted">{t("mpd.item")}</UText>
          <UText v="bodyStrong" numberOfLines={2} style={{ flex: 1, textAlign: "right", fontSize: 14 }}>{p.note?.trim() ? p.note.trim() : t("mpd.noItem")}</UText>
        </View>
      </MiniCard>

      {/* ── Montants : trois colonnes ── */}
      <MiniCard delay={140} pad={0}>
        <View style={{ flexDirection: "row" }}>
          {([
            { k: "paid", label: t("mpd.paidByCustomer"), value: money(p.amount, p.currency), strong: false },
            ...(p.fee !== undefined ? [{ k: "fee", label: t("mpd.fee"), value: `− ${money(p.fee, p.currency)}`, strong: false }] : []),
            ...(p.netAmount !== undefined ? [{ k: "net", label: t("mpd.youReceive"), value: money(p.netAmount, p.currency), strong: true }] : []),
          ] as { k: string; label: string; value: string; strong: boolean }[]).map((c, i) => (
            <View key={c.k} style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 10, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.line, backgroundColor: c.strong ? C.accentSoft : "transparent", borderTopRightRadius: c.strong ? 20 : 0, borderBottomRightRadius: c.strong ? 20 : 0 }}>
              <UText v="caption" tone="muted" numberOfLines={2}>{c.label}</UText>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4, fontSize: 15, fontWeight: "800", color: c.strong ? C.accentDeep : C.text }}>{nb(c.value)}</Text>
            </View>
          ))}
        </View>
      </MiniCard>

      {/* ── Informations : grille de petites cases ── */}
      <MiniCard delay={180}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 10 }}>
          {p.payer ? <Cell label={t("mpd.customer")} value={p.payer.name} /> : p.payerPhone ? <Cell label={t("mpd.customerPhone")} value={p.payerPhone} /> : null}
          <Cell label={t("mpd.means")} value={p.viaStaticQr ? t("mpd.staticQr") : p.method === "QR" ? t("mpd.viaQr") : t("mpd.viaPhone")} />
          <Cell
            label={copied ? t("mpd.refCopied") : t("pco.reference")}
            value={p.reference}
            icon="copy-outline"
            accent={copied}
            onPress={async () => { await Clipboard.setStringAsync(p.reference); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          />
          <Cell label={t("mpd.date")} value={dateShort(p.paidAt ?? p.createdAt)} />
          <Cell label={t("mpd.time")} value={timeLong(p.paidAt ?? p.createdAt)} />
          {p.paidAt ? <Cell label={t("mpd.settledIn")} value={elapsed(p.createdAt, p.paidAt)} /> : null}
          {p.refunded && !!p.refundReason && <Cell wide label={t("mpd.refundReason")} value={p.refundReason} />}
          {!!p.failureReason && p.status !== "PAID" && <Cell wide label={t("mpd.failureReason")} value={p.failureReason} />}
        </View>
      </MiniCard>

      {/* ── Suivi ── */}
      {p.status === "PAID" && (
        <MiniCard delay={220}>
          <Stepper
            steps={[
              { key: "c", label: t("mpd.tlCreated"), at: p.createdAt, tone: "muted" },
              ...(p.paidAt ? [{ key: "p", label: t("mpd.tlPaid"), at: p.paidAt, tone: "pos" as const }] : []),
              ...(p.refunded && p.refundedAt ? [{ key: "r", label: t("mpd.tlRefunded"), at: p.refundedAt, tone: "info" as const }] : []),
            ]}
          />
        </MiniCard>
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
