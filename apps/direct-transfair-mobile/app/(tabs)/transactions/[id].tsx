// apps/direct-transfair-mobile/app/(tabs)/transactions/[id].tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// ✅ v8.3 (lot 19) : frise de SUIVI (Enregistré → Validé → À retirer → Payé, rafraîchie toute seule), bouton WhatsApp sous le code de retrait, bouton « Renvoyer ».
// ✅ v8.2 : page COMPACTE — montant à 34 (taille de l'accueil), cartes et lignes resserrées, polices 12–14, référence sur UNE ligne (rétrécie au besoin).
// TRANSACTION DETAIL v8.1
// ✅ v8.1 : REDESIGN — « Vous » remplacé par le VRAI nom et prénom (expéditeur et destinataire), carte « De → Vers » façon Wise / Western
//    Union (avatars, noms, téléphone et pays du bénéficiaire), référence copiable en un appui, détails compacts, reçu PDF en trois petites
//    tuiles (Télécharger · Envoyer · Voir), « Signaler un problème » en petite pastille. Données, annulation et reçu INCHANGÉS.
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
import { Text } from "../../../components/ui/Text";
import { Rise } from "../../../components/merchant/merchantUi";
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
import { ReceiptPdfActions } from "../../../components/receipt/ReceiptPdfActions";
import TrackingStrip from "../../../components/transfer/TrackingStrip"; // lot 19 — suivi
import WhatsAppPill from "../../../components/transfer/WhatsAppPill"; // lot 19 — code de retrait par WhatsApp
import { buildTracking } from "../../../utils/trackingSteps";
import { openWhatsApp, pickupMessage } from "../../../utils/whatsapp";
import { userCurrency } from "../../../utils/currency";
import { useTenant } from "../../../providers/TenantProvider";

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
  const { branding } = useTenant();
  const { C } = useUI();

  const [transaction, setTransaction] = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState(false);
  const [loadError,   setLoadError]   = useState<LoadError | null>(null);
  const [slow,        setSlow]        = useState(false);

  useEffect(() => { void loadTransaction(); }, [idParam]);

  // `silent` : rafraîchissement automatique du suivi — ni écran de chargement, ni message d'erreur si le réseau flanche un instant.
  const loadTransaction = async (silent = false) => {
    if (!silent) setLoadError(null);
    try {
      if (!silent) setLoading(true);
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
      if (silent) return;
      setTransaction(null);
      setLoadError(explainLoadError(e));
    }
    finally { if (!silent) setLoading(false); }
  };

  // lot 19 — tant que l'envoi n'est pas terminé, la page se met à jour seule (le bénéficiaire retire l'argent : on le voit).
  useEffect(() => {
    if (!transaction) return;
    const tracking = buildTracking(transaction, "");
    if (!tracking || tracking.final || transaction.recipientId === user?.id) return;
    const timer = setInterval(() => { void loadTransaction(true); }, 15000);
    return () => clearInterval(timer);
  }, [transaction?.id, transaction?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
      senderName:          isIncoming ? senderName : meName,
      recipientName:       isIncoming ? meName : recipientName,
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

  const handleCopyRef = async () => {
    if (transaction?.reference) {
      await Clipboard.setStringAsync(String(transaction.reference));
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

  // Règle commune (voir describeTx) : le héros montre ce qui a réellement bougé sur le portefeuille — le TOTAL débité (montant + frais)
  // pour l'expéditeur, le montant reçu pour le destinataire. Le détail (montant principal, frais) est juste en dessous.
  const debitedTotal = toNum(transaction.total) > 0 ? toNum(transaction.total) : toNum(transaction.amount) + toNum(transaction.fees);
  const heroDisplayAmount   = isConversionIncoming
    ? toNum(transaction.receivedAmount)
    : isIncoming ? toNum(transaction.amount) : debitedTotal;
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

  // Nom réel de l'utilisateur connecté (jamais « Vous » : un reçu doit porter le vrai nom et prénom).
  const meName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || t("txd.you");

  const senderName = transaction.sender?.firstName
    ? `${transaction.sender.firstName} ${transaction.sender.lastName ?? ""}`.trim()
    : transaction.senderFirstName
      ? `${transaction.senderFirstName} ${transaction.senderLastName ?? ""}`.trim()
      : "—";

  const recipientName = transaction.beneficiary?.fullName
    ?? transaction.beneficiary?.phone
    ?? (transaction.recipientId ? t("txd.internalWallet") : "—");

  const showUserCancel   = isPending;
  const showShareReceipt = !!transaction.id; // le reçu PDF existe à tous les statuts (le statut du moment y figure)
  const showCopyCode     = !isDeposit && (isPending || isValidated);

  // ── lot 19 : suivi, WhatsApp, « Renvoyer » (envois faits par l'utilisateur uniquement) ──
  const isMyTransfer  = (type === "TRANSFER" || type === "SCHEDULED") && !isIncoming;
  const recipientFirst = String(recipientName).split(" ")[0] ?? "";
  const isCashSend    = String(transaction.payoutMethod ?? "").toUpperCase() === "CASH_PICKUP";
  const handleWhatsApp = () => {
    const sender = meName;
    const amount = `${fmt(toNum(transaction.receivedAmount) > 0 ? toNum(transaction.receivedAmount) : toNum(transaction.amount), transaction.targetCurrency ?? transaction.currency)} ${transaction.targetCurrency ?? transaction.currency}`;
    void openWhatsApp(pickupMessage({ name: recipientFirst, sender, amount, code: String(transaction.reference), brand: branding.name }), transaction.beneficiary?.phone);
  };
  const repeatBeneficiaryId = transaction.beneficiaryId ?? transaction.beneficiary?.id;
  const canRepeat = isMyTransfer && (isCashSend ? !!repeatBeneficiaryId : !!transaction.beneficiary?.phone);
  const handleRepeat = () => {
    const sameCurrency = String(transaction.currency) === userCurrency(user);
    router.push({
      pathname: "/(tabs)/send",
      params: {
        mode: isCashSend ? "CASH" : "WALLET",
        ...(isCashSend ? { beneficiaryId: String(repeatBeneficiaryId) } : { phone: String(transaction.beneficiary.phone) }),
        ...(sameCurrency ? { amount: String(toNum(transaction.amount)) } : {}),
      },
    } as any);
  };

  const hasConversion = !!transaction.targetCurrency && transaction.targetCurrency !== transaction.currency;
  const dateLabel = fmtDateTime(transaction.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const totalLabel = isIncoming ? t("txd.totalCredited") : t("txd.totalDebited");
  // total absent ou nul (ancien backend) : montant + frais
  const totalOrSum = debitedTotal;
  const totalValue = isIncoming ? heroDisplayAmount : totalOrSum;
  const totalCur = isIncoming ? heroDisplayCurrency : transaction.currency;

  return (
    <Screen header={<NavBar compact onBack={() => router.back()} title={t("txd.detail")} subtitle={transaction.reference ?? undefined} />}>
      {/* ── Montant géant ── */}
      <View style={{ alignItems: "center", paddingTop: 0, paddingBottom: 12, gap: 4 }}>
        <Pill label={status.label} tone={status.tone} icon={status.icon} style={{ alignSelf: "center" }} />
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
          <UText v="display" color={amountColor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ flexShrink: 1, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 }}>
            {amountSign}{fmt(heroDisplayAmount, heroDisplayCurrency)}
          </UText>
          <UText v="heading" tone="muted" style={{ fontSize: 15, lineHeight: 20 }}>{heroDisplayCurrency}</UText>
        </View>
        <UText v="bodyStrong" tone="muted" style={{ fontSize: 13 }}>{getTxLabel()}</UText>
      </View>

      {isMyTransfer && <TrackingStrip tx={transaction} recipientFirstName={recipientFirst} />}

      {showCopyCode && (
        <Card tone="accent" pad={12} style={{ alignItems: "center", marginBottom: 10 }}>
          <UText v="overline" tone="muted">{t("txd.withdrawCode")}</UText>
          <Pressable onPress={handleCopyCode} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }} accessibilityLabel={t("txd.copyA11y")}>
            <UText v="title" style={[{ letterSpacing: 2, fontSize: 20, lineHeight: 26 }, transaction.status === "CANCELLED" && { textDecorationLine: "line-through", color: C.faint }]}>
              {transaction.reference}
            </UText>
            <Ionicons name="copy-outline" size={20} color={C.ink} />
          </Pressable>
          {isMyTransfer && isCashSend && <View style={{ marginTop: 10 }}><WhatsAppPill onPress={handleWhatsApp} /></View>}
        </Card>
      )}

      {hasConversion && (
        <Card pad={12} style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Ionicons name="swap-horizontal-outline" size={16} color={C.ink} />
          <UText v="bodyStrong" style={{ flexShrink: 1, fontSize: 13.5, lineHeight: 18 }}>
            {isConversionIncoming
              ? t("txd.sentLine", { amount: `${fmt(toNum(transaction.amount), transaction.currency)} ${transaction.currency}` })
              : t("txd.receivesLine", { amount: `${fmt(toNum(transaction.receivedAmount), transaction.targetCurrency)} ${transaction.targetCurrency}` })}
          </UText>
          {toNum(transaction.exchangeRate) > 0 && (
            <UText v="caption" tone="muted" style={{ fontSize: 12 }}>{t("txd.rate", { rate: toNum(transaction.exchangeRate).toFixed(4) })}</UText>
          )}
        </Card>
      )}

      {/* ── De → Vers (façon Wise / Western Union) ── */}
      {!isDeposit ? (
        <Rise>
          <Card pad={12} style={{ marginBottom: 10 }}>
            <Party role={t("txd.sender")} name={isIncoming ? senderName : meName} />
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 2, marginLeft: 15 }}>
              <View style={{ width: 2, height: 14, borderRadius: 1, backgroundColor: C.lineStrong }} />
              <View style={{ marginLeft: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={"arrow-down" as any} size={13} color={C.accentDeep} />
              </View>
            </View>
            <Party
              role={t("txd.recipient")}
              name={isIncoming ? meName : recipientName}
              sub={[transaction.beneficiary?.phone, transaction.beneficiary?.country].filter(Boolean).join(" · ") || undefined}
              strong
            />
          </Card>
        </Rise>
      ) : (
        <Rise>
          <Card pad={12} style={{ marginBottom: 10 }}>
            <Party role={t("txd.agent")} name={senderName} />
          </Card>
        </Rise>
      )}

      {/* ── Informations ── */}
      <Rise delay={60}>
        <Card pad={12} style={{ marginBottom: 10 }}>
          <DetailRow label={t("txd.date")} value={dateLabel} />
          <Pressable onPress={handleCopyRef} accessibilityRole="button" accessibilityLabel={t("txd.copyA11y")}>
            <DetailRow label={t("txd.reference")} value={transaction.reference ?? "—"} copy last={!transaction.note} />
          </Pressable>
          {!!transaction.note && <DetailRow label={t("txd.motif")} value={motifLabel(transaction.note)} last />}
        </Card>
      </Rise>

      {/* ── Détail financier ── */}
      <Rise delay={120}>
        <Card tone="sunken" pad={12}>
          <UText v="overline" tone="muted" style={{ marginBottom: 0, fontSize: 11 }}>{t("txd.financial")}</UText>
          <DetailRow label={t("txd.mainAmount")} value={`${fmt(toNum(transaction.amount), transaction.currency)} ${transaction.currency}`} />
          {toNum(transaction.fees) > 0 && (
            <DetailRow label={t("txd.fees")} value={`${fmt(toNum(transaction.fees), transaction.currency)} ${transaction.currency}`} />
          )}
          <DetailRow label={totalLabel} value={`${fmt(totalValue, totalCur)} ${totalCur}`} bold color={amountColor} last />
        </Card>
      </Rise>

      {/* ── Reçu PDF : Télécharger · Envoyer · Voir ── */}
      {showShareReceipt && (
        <Rise delay={180}>
          <View style={{ marginTop: 10 }}>
            <ReceiptPdfActions transactionId={String(transaction.id)} status={transaction.status} onView={handleShare} />
          </View>
        </Rise>
      )}

      {/* ── Actions secondaires, discrètes ── */}
      <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {showUserCancel && <Button label={t("txd.cancelTx")} kind="danger" small loading={processing} onPress={handleCancel} />}
        {canRepeat && <Button label={t("rep.button")} icon="refresh-outline" kind="soft" small onPress={handleRepeat} />}
        {!isIncoming && (
          <Button
            label={t("txd.report")}
            icon="alert-circle-outline"
            kind="soft"
            small
            onPress={() => router.push({ pathname: "/(tabs)/profile/support", params: { transactionId: String(transaction.id), reference: transaction.reference ?? "" } } as any)}
          />
        )}
      </View>
    </Screen>
  );
}

/** Une personne de l'opération : avatar à initiales, rôle au-dessus, nom complet, précision dessous. */
function Party({ role, name, sub, strong }: { role: string; name: string; sub?: string; strong?: boolean }) {
  const { C } = useUI();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "•";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: strong ? C.accent : C.sunken, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: strong ? C.accentInk : C.text }}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <UText v="caption" tone="muted" style={{ fontSize: 11.5, lineHeight: 15 }}>{role}</UText>
        <UText v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>{name}</UText>
        {!!sub && <UText v="caption" tone="muted" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{sub}</UText>}
      </View>
    </View>
  );
}

function DetailRow({ label, value, bold, color, last, copy }: { label: string; value: string; bold?: boolean; color?: string; last?: boolean; copy?: boolean }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <UText v="caption" tone="muted" style={{ fontSize: 12.5 }}>{label}</UText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "72%" }}>
        <UText v={bold ? "subheading" : "bodyStrong"} color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ textAlign: "right", flexShrink: 1, fontWeight: bold ? "800" : "600", fontSize: bold ? 15 : 13.5, lineHeight: bold ? 20 : 18 }}>{value}</UText>
        {copy ? <Ionicons name={"copy-outline" as any} size={15} color={C.muted} /> : null}
      </View>
    </View>
  );
}
