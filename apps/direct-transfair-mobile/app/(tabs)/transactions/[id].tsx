// apps/direct-transfair-mobile/app/(tabs)/transactions/[id].tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// TRANSACTION DETAIL v8.0
// ✅ v8.0 : 🔥 REFONTE TOTALE en thème clair : retour + titre, montant géant signé (vert reçu / noir envoyé),
//    pastille de statut, carte « code de retrait » à l'accent de la société, lignes de détail à filets,
//    bloc financier, actions (voir le reçu en pilule d'accent, annuler en rouge doux). Design system
//    components/ui. Logique INCHANGÉE : GET /transactions/:id borné (repli liste), message « serveur lent »,
//    erreur réseau ≠ « introuvable », partage du reçu, copie de la référence, annulation (PENDING).
// ✅ v7.0 : chargement borné + white-label (une seule requête au lieu de toute la liste).
// ✅ v6.x : historique (hero sombre, motif, direction par rôle, reçu client, phase 5 clients uniquement).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState, useEffect } from "react";
import { View, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import * as Clipboard from "expo-clipboard";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";
import type { ClientReceiptData } from "./client-receipt";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../../components/wallet/useLoader";
import { Button, Card, ErrorView, NavBar, Pill, Screen, SlowNote, UText, Bone, useUI } from "../../../components/ui";
import { useT } from "../../../providers/I18nProvider";
import { fmtDateTime, getLocale } from "../../../i18n/runtime";
import { fmtMoney } from "../../../utils/amount";
import { motifLabel } from "../../../utils/motifs";

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
// Montants : même format que le reste de l'application (suit la langue choisie). Ici XOF et GNF sans décimales, comme avant.
const fmt = (n: number, cur = "XOF"): string => fmtMoney(n, cur);

export default function TransactionDetailScreen() {
  const params  = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

  const router   = useRouter();
  const t = useT();
  const { user } = useAuth();
  const { C } = useUI();

  const [transaction, setTransaction] = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState(false);
  const [loadError,   setLoadError]   = useState<LoadError | null>(null);
  const [slow,        setSlow]        = useState(false);

  useEffect(() => { void loadTransaction(); }, [idParam]);

  const loadTransaction = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      if (!idParam) return setTransaction(null);
      const ms = defaultTimeoutMs();
      let found: any = null;
      try {
        found = await withTimeout(api.getTransaction(String(idParam)), ms);
      } catch (e: any) {
        const status = e?.response?.status;
        // Route indisponible / introuvable : repli sur la liste (ancien comportement)
        if (status === 404 || status === 405 || status === 501) {
          const list: any[] = await withTimeout(api.getTransactions(), ms);
          found = list.find((x: any) => String(x.id) === String(idParam)) ?? null;
        } else {
          throw e;
        }
      }
      setTransaction(found || null);
    } catch (e) {
      setTransaction(null);
      setLoadError(explainLoadError(e));
    }
    finally { setLoading(false); }
  };

  // Message rassurant si le serveur met plus de 4 s à répondre
  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  // ✅ FIX v6.3 — handleShare construit désormais un objet ClientReceiptData
  // complet et navigue vers l'écran client-receipt.tsx au lieu d'ouvrir
  // le partage natif avec un texte brut. isIncoming, heroDisplayAmount,
  // heroDisplayCurrency, senderName, recipientName, getTxLabel() sont
  // déjà calculées plus bas dans le rendu de ce composant ; comme il
  // s'agit d'une closure réévaluée à chaque rendu, ces valeurs sont à
  // jour au moment où l'utilisateur appuie sur le bouton.
  const handleShare = () => {
    if (!transaction) return;
    const receiptData: ClientReceiptData = {
      reference:           transaction.reference ?? "—",
      date:                transaction.createdAt,
      status:              transaction.status,
      isIncoming,
      txLabel:             getTxLabel(),
      payoutMethod:        transaction.payoutMethod,
      sentAmount:          toNum(transaction.amount),
      sentCurrency:        transaction.currency,
      receivedAmount:      toNum(transaction.receivedAmount),
      receivedCurrency:    transaction.targetCurrency,
      exchangeRate:        transaction.exchangeRate
                             ? toNum(transaction.exchangeRate)
                             : undefined,
      fees:                toNum(transaction.fees),
      total:               toNum(transaction.total ?? transaction.amount),
      heroDisplayAmount,
      heroDisplayCurrency,
      senderName:          isIncoming ? senderName : t("txd.you"),
      recipientName:       isIncoming ? t("txd.you") : recipientName,
      recipientPhone:      transaction.beneficiary?.phone ?? undefined,
      recipientCountry:    transaction.beneficiary?.country ?? undefined,
    };
    // Reçu complet construit par le serveur (logo, infos, QR) ; l'ancien reçu n'est plus qu'un secours.
    if (transaction.id) {
      router.push(`/receipt/${encodeURIComponent(String(transaction.id))}`);
      return;
    }
    router.push({
      pathname: "/(tabs)/transactions/client-receipt",
      params:   { data: encodeURIComponent(JSON.stringify(receiptData)) },
    });
  };

  const handleCopyCode = async () => {
    if (transaction?.reference) {
      await Clipboard.setStringAsync(transaction.reference);
      Alert.alert(t("txd.copied"), t("txd.refCopied"));
    }
  };

  const handleCancel = async () => {
    if (!transaction) return;
    setProcessing(true);
    try {
      const closed = (await api.cancelTransaction(transaction.id)) as { cashToReturn?: { amount: number; currency: string; customer?: string | null } };
      // Envoi encaissé au comptoir : le client de passage a payé en espèces, la plateforme ne peut pas le lui rendre — on rappelle à l'agent la somme à remettre.
      const cash = closed.cashToReturn;
      const cashAmount = cash ? `${cash.amount.toLocaleString(getLocale())} ${cash.currency}` : "";
      Alert.alert(
        t("txd.cancelledTitle"),
        cash
          ? (cash.customer ? t("txd.returnCashTo", { amount: cashAmount, name: cash.customer }) : t("txd.returnCashClient", { amount: cashAmount }))
          : t("txd.cancelledMsg"),
      );
      void loadTransaction();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.response?.data?.message || t("txd.actionFail"));
    } finally { setProcessing(false); }
  };

  if (loading) return (
    <Screen header={<NavBar onBack={() => router.back()} title={t("txd.title")} />}>
      <SlowNote visible={slow} />
      <View style={{ alignItems: "center", gap: 14, paddingTop: 30 }}>
        <Bone width={180} height={48} radius={12} />
        <Bone width={120} height={14} />
        <Bone height={220} radius={24} style={{ marginTop: 20 }} />
      </View>
    </Screen>
  );
  if (!transaction) return (
    <Screen header={<NavBar onBack={() => router.back()} title={t("txd.title")} />}>
      {loadError ? (
        <ErrorView title={loadError.title} message={loadError.message} onRetry={() => void loadTransaction()} />
      ) : (
        <UText v="body" tone="muted" align="center" style={{ paddingTop: 60 }}>{t("txd.notFound")}</UText>
      )}
      <Pressable onPress={() => router.back()} style={{ alignSelf: "center", padding: 12 }}>
        <UText v="bodyStrong">{t("common.back")}</UText>
      </Pressable>
    </Screen>
  );

  const type      = String(transaction.type ?? "").toUpperCase();
  const isDeposit = type === "DEPOSIT" || type === "TOP_UP";
  const isPending   = transaction.status === "PENDING";
  const isValidated = transaction.status === "VALIDATED";
  const isPaid      = transaction.status === "PAID";

  // ── Direction (point de vue du client) ────────────────
  const isIncoming = isDeposit || transaction.recipientId === user?.id;

  // ✅ FIX v6.2 — Montant héro : pour les entrants avec conversion de devise,
  // afficher ce que l'utilisateur a réellement reçu (receivedAmount/targetCurrency)
  // plutôt que ce que l'expéditeur a envoyé (amount/currency).
  const isConversionIncoming =
    isIncoming &&
    transaction.targetCurrency &&
    transaction.targetCurrency !== transaction.currency &&
    toNum(transaction.receivedAmount) > 0;

  const heroDisplayAmount   = isConversionIncoming
    ? toNum(transaction.receivedAmount)
    : toNum(transaction.amount);
  const heroDisplayCurrency = isConversionIncoming
    ? (transaction.targetCurrency as string)
    : (transaction.currency as string);

  const amountColor = isIncoming ? C.pos : C.ink;
  const amountSign  = isIncoming ? "+" : "−";

  const getTxLabel = (): string => {
    if (isDeposit) return t("txd.labelDeposit");
    return isIncoming ? t("txd.labelIn") : t("txd.labelOut");
  };

  const getStatusInfo = (): { label: string; tone: "pos" | "info" | "danger" | "warn" | "neutral"; icon: string } => {
    if (isPaid && isIncoming)  return { label: t("txd.s.received"),  tone: "pos", icon: "arrow-down-circle" };
    if (isPaid && !isIncoming) return { label: t("txd.s.paid"),      tone: "pos", icon: "checkmark-circle" };
    switch (transaction.status) {
      case "VALIDATED": return { label: t("txd.s.available"), tone: "info",   icon: "shield-checkmark" };
      case "CANCELLED": return { label: t("txd.s.cancelled"), tone: "neutral", icon: "close-circle" };
      case "REFUNDED":  return { label: t("txd.s.refunded"),  tone: "info",   icon: "return-down-back" };
      case "EXPIRED":   return { label: t("txd.s.expired"),   tone: "neutral", icon: "timer" };
      case "FAILED":    return { label: t("txd.s.failed"),    tone: "danger", icon: "alert-circle" };
      default:          return { label: t("txd.s.pending"),   tone: "warn",   icon: "time" };
    }
  };
  const status = getStatusInfo();

  const senderName = transaction.sender?.firstName
    ? `${transaction.sender.firstName} ${transaction.sender.lastName ?? ""}`.trim()
    : transaction.senderFirstName
      ? `${transaction.senderFirstName} ${transaction.senderLastName ?? ""}`.trim()
      : "—";

  const recipientName = transaction.beneficiary?.fullName
    ?? transaction.beneficiary?.phone
    ?? (transaction.recipientId ? t("txd.internalWallet") : "—");

  const showUserCancel   = isPending;
  const showShareReceipt = isPaid;
  const showCopyCode     = !isDeposit && (isPending || isValidated);

  const hasConversion = !!transaction.targetCurrency && transaction.targetCurrency !== transaction.currency;
  const dateLabel = fmtDateTime(transaction.createdAt, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const totalLabel = isIncoming ? t("txd.totalCredited") : t("txd.totalDebited");
  // total absent ou nul (ancien backend) : montant + frais
  const totalOrSum = toNum(transaction.total) > 0 ? toNum(transaction.total) : toNum(transaction.amount) + toNum(transaction.fees);
  const totalValue = isIncoming ? heroDisplayAmount : totalOrSum;
  const totalCur = isIncoming ? heroDisplayCurrency : transaction.currency;

  return (
    <Screen header={<NavBar onBack={() => router.back()} title={t("txd.detail")} subtitle={transaction.reference ?? undefined} />}>
      {/* ── Montant géant ── */}
      <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 18, gap: 10 }}>
        <Pill label={status.label} tone={status.tone} icon={status.icon} style={{ alignSelf: "center" }} />
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <UText v="display" color={amountColor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ flexShrink: 1 }}>
            {amountSign}{fmt(heroDisplayAmount, heroDisplayCurrency)}
          </UText>
          <UText v="heading" tone="muted">{heroDisplayCurrency}</UText>
        </View>
        <UText v="bodyStrong" tone="muted">{getTxLabel()}</UText>
      </View>

      {showCopyCode && (
        <Card tone="accent" style={{ alignItems: "center", marginBottom: 14 }}>
          <UText v="overline" tone="muted">{t("txd.withdrawCode")}</UText>
          <Pressable onPress={handleCopyCode} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }} accessibilityLabel={t("txd.copyA11y")}>
            <UText v="title" style={[{ letterSpacing: 2 }, transaction.status === "CANCELLED" && { textDecorationLine: "line-through", color: C.faint }]}>
              {transaction.reference}
            </UText>
            <Ionicons name="copy-outline" size={20} color={C.ink} />
          </Pressable>
        </Card>
      )}

      {hasConversion && (
        <Card pad={16} style={{ marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Ionicons name="swap-horizontal-outline" size={18} color={C.ink} />
          <UText v="bodyStrong" style={{ flexShrink: 1 }}>
            {isConversionIncoming
              ? t("txd.sentLine", { amount: `${fmt(toNum(transaction.amount), transaction.currency)} ${transaction.currency}` })
              : t("txd.receivesLine", { amount: `${fmt(toNum(transaction.receivedAmount), transaction.targetCurrency)} ${transaction.targetCurrency}` })}
          </UText>
          {toNum(transaction.exchangeRate) > 0 && (
            <UText v="caption" tone="muted">{t("txd.rate", { rate: toNum(transaction.exchangeRate).toFixed(4) })}</UText>
          )}
        </Card>
      )}

      {/* ── Détails ── */}
      <Card pad={18} style={{ marginBottom: 14 }}>
        <DetailRow label={t("txd.date")} value={dateLabel} />
        <DetailRow label={t("txd.reference")} value={transaction.reference ?? "—"} />
        {!!transaction.note && <DetailRow label={t("txd.motif")} value={motifLabel(transaction.note)} />}
        {isDeposit ? (
          <>
            <DetailRow label={t("txd.agent")} value={senderName} />
            <DetailRow label={t("txd.beneficiary")} value={t("txd.yourWallet")} last />
          </>
        ) : (
          <>
            <DetailRow label={t("txd.sender")} value={isIncoming ? senderName : t("txd.you")} />
            <DetailRow label={t("txd.recipient")} value={isIncoming ? t("txd.you") : recipientName} last={!transaction.beneficiary?.phone} />
            {!!transaction.beneficiary?.phone && <DetailRow label={t("txd.phone")} value={transaction.beneficiary.phone} last />}
          </>
        )}
      </Card>

      {/* ── Détail financier ── */}
      <Card tone="sunken" pad={18}>
        <UText v="overline" tone="muted" style={{ marginBottom: 6 }}>{t("txd.financial")}</UText>
        <DetailRow label={t("txd.mainAmount")} value={`${fmt(toNum(transaction.amount), transaction.currency)} ${transaction.currency}`} />
        {toNum(transaction.fees) > 0 && (
          <DetailRow label={t("txd.fees")} value={`${fmt(toNum(transaction.fees), transaction.currency)} ${transaction.currency}`} />
        )}
        <DetailRow label={totalLabel} value={`${fmt(totalValue, totalCur)} ${totalCur}`} bold color={amountColor} last />
      </Card>

      {/* ── Actions ── */}
      <View style={{ marginTop: 22, gap: 12 }}>
        {showShareReceipt && <Button label={t("txd.viewReceipt")} icon="document-text-outline" onPress={handleShare} />}
        {showUserCancel && <Button label={t("txd.cancelTx")} kind="danger" loading={processing} onPress={handleCancel} />}
        {!isIncoming && (
          <Button
            label={t("txd.report")}
            icon="alert-circle-outline"
            kind="ghost"
            onPress={() => router.push({ pathname: "/(tabs)/profile/support", params: { transactionId: String(transaction.id), reference: transaction.reference ?? "" } } as any)}
          />
        )}
      </View>
    </Screen>
  );
}

function DetailRow({ label, value, bold, color, last }: { label: string; value: string; bold?: boolean; color?: string; last?: boolean }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <UText v="caption" tone="muted">{label}</UText>
      <UText v={bold ? "subheading" : "bodyStrong"} color={color} style={{ maxWidth: "62%", textAlign: "right", fontWeight: bold ? "800" : "600" }}>{value}</UText>
    </View>
  );
}
