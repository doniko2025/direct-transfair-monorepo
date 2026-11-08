// apps/direct-transfair-mobile/components/merchant/merchantUi.tsx
// =========================================================
// Lot 11 — briques communes de l'espace marchand et du paiement par QR / téléphone.
// Aides (erreurs, QR, compte à rebours), carte QR animée, saisie du code secret, ligne de paiement.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "../ui/Icon";
import { Card, Pill, UText, useUI } from "../ui";
import { ShopAvatar } from "./ShopAvatar";
import PinInput from "../auth/PinInput";
import { formatMoney } from "../wallet/walletTheme";
import type { PaymentRequestView, PaymentStatus, PayoutStatus } from "../../services/merchantTypes";

// ─── Erreurs ─────────────────────────────────────────────
export type ApiProblem = { message: string; code?: string; status?: number };

export function apiProblem(e: any): ApiProblem {
  const data = e?.response?.data;
  const raw = data?.message ?? e?.message ?? "Une erreur est survenue.";
  const message = Array.isArray(raw) ? String(raw[0]) : String(raw);
  const code = typeof data?.code === "string" ? data.code : undefined;
  const status = typeof e?.response?.status === "number" ? e.response.status : undefined;
  if (!e?.response) return { message: "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.", code, status };
  return { message, code, status };
}

// ─── QR ──────────────────────────────────────────────────
export const MERCHANT_QR_PREFIX = "directtransfair://merchant-pay/";
const QR_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Renvoie le contenu à envoyer au serveur si le texte scanné est un QR de paiement marchand, sinon null. */
export function parseMerchantQr(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s.startsWith(MERCHANT_QR_PREFIX)) return null;
  return QR_TOKEN_RE.test(s.slice(MERCHANT_QR_PREFIX.length)) ? s : null;
}

// ─── Libellés ────────────────────────────────────────────
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "En attente", PAID: "Payé", DECLINED: "Refusé", EXPIRED: "Expiré", CANCELLED: "Annulé",
};
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, "warn" | "pos" | "danger" | "neutral"> = {
  PENDING: "warn", PAID: "pos", DECLINED: "danger", EXPIRED: "neutral", CANCELLED: "neutral",
};
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  PENDING: "En cours", PAID: "Versé", REJECTED: "Refusé", FAILED: "Échoué",
};
export const PAYOUT_STATUS_TONE: Record<PayoutStatus, "warn" | "pos" | "danger"> = {
  PENDING: "warn", PAID: "pos", REJECTED: "danger", FAILED: "danger",
};
export const PAYOUT_METHOD_LABEL: Record<string, string> = { ORANGE_MONEY: "Orange Money", BANK_TRANSFER: "Virement bancaire" };

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function money(amount: number, currency: string): string {
  return `${formatMoney(amount, currency)} ${currency === "XOF" || currency === "XAF" ? "F CFA" : currency}`;
}

// ─── Compte à rebours ────────────────────────────────────
/** Secondes restantes, recalées sur l'horloge locale à partir de `secondsLeft` renvoyé par le serveur (pas de dérive d'horloge). */
export function useCountdown(secondsLeft: number | undefined, key?: string): number {
  const anchor = useRef({ at: Date.now(), left: secondsLeft ?? 0 });
  const [, tick] = useState(0);
  useEffect(() => {
    anchor.current = { at: Date.now(), left: secondsLeft ?? 0 };
    tick((n) => n + 1);
  }, [secondsLeft, key]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, anchor.current.left - Math.floor((Date.now() - anchor.current.at) / 1000));
}

export function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Carte animée (entrée en fondu + glissement) ─────────
export function Rise({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Carte QR du marchand (sur fond blanc, barre de temps) ─
export function MerchantQrCard({
  payload, amountLabel, secondsLeft, totalSeconds, businessName,
}: { payload: string; amountLabel: string; secondsLeft: number; totalSeconds: number; businessName: string }) {
  const { C, R, S } = useUI();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ratio = totalSeconds > 0 ? Math.min(1, secondsLeft / totalSeconds) : 0;
  const urgent = secondsLeft <= 30;
  return (
    <Card pad={22} style={[{ alignItems: "center", gap: 14, borderRadius: R.xl }, S.md]}>
      <UText v="caption" tone="muted" align="center" numberOfLines={1}>{businessName}</UText>
      <UText v="hero" align="center">{amountLabel}</UText>
      <Animated.View
        style={{
          padding: 14, borderRadius: R.lg, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.line,
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }],
        }}
      >
        <QRCode value={payload} size={208} color="#111111" backgroundColor="#FFFFFF" ecl="M" />
      </Animated.View>
      <View style={{ width: "100%", gap: 6 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.field, overflow: "hidden" }}>
          <View style={{ height: 6, width: `${Math.round(ratio * 100)}%`, borderRadius: 3, backgroundColor: urgent ? C.danger : C.pos }} />
        </View>
        <UText v="caption" tone={urgent ? "danger" : "muted"} align="center">
          {secondsLeft > 0 ? `Valable encore ${mmss(secondsLeft)}` : "Ce QR code a expiré"}
        </UText>
      </View>
    </Card>
  );
}

// ─── Saisie du code secret ───────────────────────────────
export function PinPrompt({
  value, onChange, onComplete, error, label = "Code secret (6 chiffres)", autoFocus,
}: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; error?: string | null; label?: string; autoFocus?: boolean }) {
  const { C } = useUI();
  return <PinInput label={label} value={value} onChange={onChange} onComplete={onComplete} accent={C.accent} error={error} noReveal autoFocus={autoFocus} />;
}

// ─── Grande icône d'état ─────────────────────────────────
export function StatusHero({
  tone, icon, title, message,
}: { tone: "pos" | "danger" | "warn" | "info"; icon: string; title: string; message?: string }) {
  const { C } = useUI();
  const m = useMemo(() => ({
    pos: { bg: C.posBg, fg: C.pos }, danger: { bg: C.dangerBg, fg: C.danger },
    warn: { bg: C.warnBg, fg: C.warn }, info: { bg: C.infoBg, fg: C.info },
  }[tone]), [C, tone]);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 18 }}>
      <Animated.View
        style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: m.bg, alignItems: "center", justifyContent: "center", transform: [{ scale: pop }] }}
      >
        <Ionicons name={icon as any} size={46} color={m.fg} />
      </Animated.View>
      <UText v="title" align="center">{title}</UText>
      {!!message && <UText v="body" tone="muted" align="center" style={{ maxWidth: 340 }}>{message}</UText>}
    </View>
  );
}

// ─── Ligne d'un paiement ─────────────────────────────────
export function PaymentRow({ p, onPress }: { p: PaymentRequestView; onPress: () => void }) {
  const { C } = useUI();
  const asPayee = p.isMine === "PAYEE";
  const who = asPayee ? (p.payer?.name ?? (p.method === "QR" ? "Paiement par QR" : p.payerPhone ?? "Client")) : p.merchant.businessName;
  return (
    <Card onPress={onPress} pad={16} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {asPayee ? (
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.refunded ? C.infoBg : C.beige, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={(p.refunded ? "return-down-back-outline" : p.method === "QR" ? "qr-code-outline" : "phone-portrait-outline") as any} size={21} color={p.refunded ? C.info : C.ink} />
          </View>
        ) : (
          <ShopAvatar shopId={p.merchant.shopId} version={p.merchant.logoVersion} name={p.merchant.businessName} size={44} />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <UText v="bodyStrong" numberOfLines={1}>{who}</UText>
          <UText v="caption" tone="muted" numberOfLines={1}>{shortDateTime(p.createdAt)}</UText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <UText v="bodyStrong" tone={asPayee && p.status === "PAID" && !p.refunded ? "pos" : "ink"} style={p.refunded ? { textDecorationLine: "line-through" } : undefined}>
            {asPayee ? "+" : "−"}{money(asPayee ? (p.netAmount ?? p.amount) : p.amount, p.currency)}
          </UText>
          <Pill label={p.refunded ? "Remboursé" : PAYMENT_STATUS_LABEL[p.status]} tone={p.refunded ? "info" : PAYMENT_STATUS_TONE[p.status]} />
        </View>
      </View>
    </Card>
  );
}

/** Même liste que le serveur (merchant-rules.ts : DEFAULT_CATEGORIES) — l'inscription n'est pas encore connectée. */
export const MERCHANT_CATEGORIES = [
  "Boutique / commerce", "Alimentation", "Restaurant / café", "Pharmacie / santé", "Mode / beauté", "Transport", "Services", "Autre",
] as const;
