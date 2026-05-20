// apps/direct-transfair-mobile/app/(tabs)/transactions/[id].tsx
// =========================================================
// TRANSACTION DETAIL v6.0 — Direct Transf'air
// ✅ Labels et badges corrects pour les 4 rôles :
//
//  SUPER_ADMIN   : voit "Encaissement société" / "Remboursement admin"
//                  badge "REÇUE" (vert) pour SERVICE_PAYMENT payé
//                  Peut : Valider ou Rembourser (pas annuler)
//
//  COMPANY_ADMIN : voit "Reçu de" / "Envoyé à"
//                  badge "REÇUE" si entrant, "PAYÉE" si sortant
//                  Peut : Annuler si PENDING/VALIDATED
//
//  AGENT         : voit "Recharge caisse" / "Dépôt client"
//                  Peut : rien (lecture seule)
//
//  CLIENT (USER) : voit "Transfert reçu" / "Envoi d'argent"
//                  badge "REÇUE" si entrant, "PAYÉE" si sortant
//                  Peut : Annuler si PENDING, Partager le reçu
// =========================================================

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Alert, Platform, SafeAreaView, StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = {
  heading: Platform.OS === "ios" ? "Cochin"  : "serif",
  body:    Platform.OS === "ios" ? "Avenir"  : "sans-serif",
  mono:    Platform.OS === "ios" ? "Courier New" : "monospace",
};

// Thème par rôle
const THEMES: Record<string, { primary: string; light: string; bg: string }> = {
  SUPER_ADMIN:   { primary: "#5B5BD6", light: "#EDE9FE", bg: "#F8FAFF" },
  COMPANY_ADMIN: { primary: "#0284C7", light: "#E0F2FE", bg: "#F8FAFC" },
  AGENT:         { primary: "#D97706", light: "#FEF3C7", bg: "#FFFBF0" },
  USER:          { primary: "#059669", light: "#ECFDF5", bg: "#F8FAFC" },
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmt(n: number, cur = "XOF"): string {
  const d = cur === "GNF" || cur === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

export default function TransactionDetailScreen() {
  const params  = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

  const router   = useRouter();
  const { user } = useAuth();
  const role     = user?.role || "USER";
  const theme    = THEMES[role] ?? THEMES.USER;

  const isSA    = role === "SUPER_ADMIN";
  const isCA    = role === "COMPANY_ADMIN";
  const isAgent = role === "AGENT";
  const isUser  = role === "USER";

  const [transaction, setTransaction] = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState(false);

  useEffect(() => { void loadTransaction(); }, [idParam]);

  const loadTransaction = async () => {
    try {
      setLoading(true);
      if (!idParam) return setTransaction(null);
      let list: any[] = [];
      try { list = await api.adminGetTransactions(); }
      catch { list = await api.getTransactions(); }
      const found = list.find((t: any) => String(t.id) === String(idParam));
      setTransaction(found || null);
    } catch { setTransaction(null); }
    finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!transaction) return;
    try {
      await Share.share({
        message: `Reçu Direct Transf'air\nRéf: ${transaction.reference}\nMontant: ${fmt(toNum(transaction.amount), transaction.currency)} ${transaction.currency}`,
      });
    } catch {}
  };

  const handleCopyCode = async () => {
    if (transaction?.reference) {
      await Clipboard.setStringAsync(transaction.reference);
      Alert.alert("Copié", "Référence copiée dans le presse-papier");
    }
  };

  const performAction = async (action: "VALIDATE" | "CANCEL" | "REFUND") => {
    if (!transaction) return;
    setProcessing(true);
    try {
      const isB2B = String(transaction.type ?? "").toUpperCase() === "SERVICE_PAYMENT";
      if (action === "VALIDATE") {
        if (isB2B) await api.validateBankTransfer(transaction.id);
        else await api.adminUpdateTransactionStatus(transaction.id, "VALIDATED");
        Alert.alert("✅ Validé", "Transaction validée.");
      } else if (action === "REFUND") {
        if (isB2B) await api.rejectBankTransfer(transaction.id);
        else await api.adminUpdateTransactionStatus(transaction.id, "CANCELLED");
        Alert.alert("↩️ Remboursé", "Remboursement effectué à l'admin société.");
      } else {
        await api.cancelTransaction(transaction.id);
        Alert.alert("🚫 Annulé", "Transaction annulée.");
      }
      void loadTransaction();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Action impossible.");
    } finally { setProcessing(false); }
  };

  if (loading) return (
    <SafeAreaView style={s.center}>
      <ActivityIndicator size="large" color={theme.primary} />
    </SafeAreaView>
  );
  if (!transaction) return (
    <SafeAreaView style={s.center}>
      <Text style={[s.notFoundText, { fontFamily: FONTS.body }]}>Transaction introuvable.</Text>
    </SafeAreaView>
  );

  // ─── Classification de la transaction ────────────────
  const type     = String(transaction.type ?? "").toUpperCase();
  const isB2B    = type === "SERVICE_PAYMENT";
  const isRefill = type === "AGENCY_REFILL" || type === "REFILL";
  const isDeposit= type === "DEPOSIT" || type === "TOP_UP";
  const isRefund = type === "REFUND" || transaction.status === "REFUNDED";
  const isPending   = transaction.status === "PENDING";
  const isValidated = transaction.status === "VALIDATED";
  const isPaid      = transaction.status === "PAID";

  // ─── Direction selon rôle ─────────────────────────────
  let isIncoming = false;
  if (isSA)    isIncoming = isB2B;
  else if (isCA) isIncoming = isDeposit || isRefund || transaction.recipientId === user?.id;
  else if (isAgent) isIncoming = isRefill;
  else isIncoming = isDeposit || transaction.recipientId === user?.id;

  const amountColor = isIncoming ? "#059669" : "#DC2626";
  const amountSign  = isIncoming ? "+" : "−";

  // ─── Label et description selon rôle + direction ─────
  const getTxLabel = (): string => {
    if (isSA) {
      if (isB2B)    return "Encaissement société";
      if (isRefund) return "Remboursement admin";
      return "Transaction";
    }
    if (isCA) {
      if (isRefill)   return "Recharge agence";
      if (isDeposit)  return isIncoming ? "Dépôt reçu" : "Dépôt initié";
      if (isRefund)   return "Remboursement reçu";
      return isIncoming ? "Transfert reçu" : "Envoi d'argent";
    }
    if (isAgent) {
      if (isRefill)  return "Recharge caisse reçue";
      if (isDeposit) return "Dépôt vers client";
      return "Transaction";
    }
    // USER
    if (isDeposit) return "Dépôt en agence";
    return isIncoming ? "Transfert reçu" : "Envoi d'argent";
  };

  // ─── Badge statut ─────────────────────────────────────
  const getStatusInfo = () => {
    if (isPaid && isIncoming) {
      return { label: "REÇUE ✓",    color: "#059669", bg: "#D1FAE5", icon: "arrow-down-circle" };
    }
    if (isPaid && !isIncoming) {
      return { label: "PAYÉE ✓",    color: "#059669", bg: "#D1FAE5", icon: "checkmark-circle" };
    }
    switch (transaction.status) {
      case "VALIDATED": return { label: "DISPONIBLE",  color: "#2563EB", bg: "#DBEAFE", icon: "shield-checkmark" };
      case "CANCELLED": return { label: "ANNULÉE",     color: "#DC2626", bg: "#FEE2E2", icon: "close-circle" };
      case "REFUNDED":  return { label: "REMBOURSÉE",  color: "#7C3AED", bg: "#EDE9FE", icon: "return-down-back" };
      case "FAILED":    return { label: "ÉCHOUÉE",     color: "#DC2626", bg: "#FEE2E2", icon: "alert-circle" };
      default:          return { label: "EN ATTENTE",  color: "#D97706", bg: "#FEF3C7", icon: "time" };
    }
  };
  const status = getStatusInfo();

  // ─── Noms des parties ─────────────────────────────────
  const senderName = transaction.sender?.firstName
    ? `${transaction.sender.firstName} ${transaction.sender.lastName ?? ""}`.trim()
    : transaction.senderFirstName
      ? `${transaction.senderFirstName} ${transaction.senderLastName ?? ""}`.trim()
      : "—";

  const recipientName = isSA && isB2B
    ? "Plateforme (moi)"
    : transaction.beneficiary?.fullName
      ?? transaction.beneficiary?.phone
      ?? (transaction.recipientId ? "Wallet interne" : "—");

  // ─── Actions disponibles ──────────────────────────────
  // SA      : Valider (PENDING) + Rembourser (PENDING)
  // CA      : Annuler (PENDING | VALIDATED)
  // AGENT   : aucune action
  // USER    : Annuler (PENDING) + Partager
  const showSAActions    = isSA && isPending;
  const showCACancel     = isCA && (isPending || isValidated);
  const showUserCancel   = isUser && isPending;
  const showShareReceipt = (isUser || isCA) && isPaid;
  const showCopyCode     = !isB2B && !isRefill && !isDeposit && (isPending || isValidated);

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Nav bar */}
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={26} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Ticket */}
        <View style={[s.ticket, { borderTopColor: theme.primary }]}>

          {/* Badge statut flottant */}
          <View style={[s.statusBadge, { backgroundColor: status.bg, borderColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[s.statusText, { color: status.color, fontFamily: FONTS.body }]}>
              {status.label}
            </Text>
          </View>

          {/* Montant hero */}
          <View style={s.amountHero}>
            <Text style={[s.amountSign, { color: amountColor, fontFamily: FONTS.body }]}>
              {amountSign}
            </Text>
            <Text style={[s.amountMain, { color: amountColor, fontFamily: FONTS.heading }]}>
              {fmt(toNum(transaction.amount), transaction.currency)}
            </Text>
            <Text style={[s.amountCur, { color: amountColor, fontFamily: FONTS.mono }]}>
              {transaction.currency}
            </Text>
          </View>

          {/* Label transaction */}
          <Text style={[s.txLabel, { fontFamily: FONTS.body, color: theme.primary }]}>
            {getTxLabel()}
          </Text>

          {/* Code de retrait si applicable */}
          {showCopyCode && (
            <View style={[s.codeSection, { backgroundColor: theme.light }]}>
              <Text style={[s.codeLabel, { fontFamily: FONTS.body }]}>CODE DE RETRAIT</Text>
              <TouchableOpacity style={s.codeBox} onPress={handleCopyCode}>
                <Text style={[s.codeText, { fontFamily: FONTS.heading }, transaction.status === "CANCELLED" && s.codeStrike]}>
                  {transaction.reference}
                </Text>
                <Ionicons name="copy-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Conversion multi-devises */}
          {transaction.targetCurrency && transaction.targetCurrency !== transaction.currency && (
            <View style={[s.convSection, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="swap-horizontal-outline" size={14} color="#2563EB" />
              <Text style={[s.convTxt, { fontFamily: FONTS.mono }]}>
                Reçoit : {fmt(toNum(transaction.receivedAmount), transaction.targetCurrency)} {transaction.targetCurrency}
              </Text>
              <Text style={[s.convRate, { fontFamily: FONTS.body }]}>
                Taux : {toNum(transaction.exchangeRate).toFixed(4)}
              </Text>
            </View>
          )}

          {/* Détails */}
          <View style={s.detailsSection}>
            <DetailRow label="Date" value={new Date(transaction.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
            <View style={s.divider} />
            <DetailRow label="Référence" value={transaction.reference ?? "—"} mono />
            <View style={s.divider} />

            {/* Parties selon le type */}
            {isB2B && isSA ? (
              <>
                <DetailRow label="Société émettrice" value={transaction.client?.name ?? senderName} />
                <DetailRow label="Bénéficiaire"       value="Plateforme Transf'air (moi)" color={theme.primary} />
              </>
            ) : isRefill ? (
              <>
                <DetailRow label="Initiateur" value={isCA ? "Vous (Admin)" : senderName} />
                <DetailRow label="Agence créditée" value={transaction.agency?.name ?? "—"} />
                {transaction.agency?.city && (
                  <DetailRow label="Localisation" value={`${transaction.agency.city}, ${transaction.agency.country ?? ""}`} sub />
                )}
              </>
            ) : isDeposit ? (
              <>
                <DetailRow label="Agent" value={isAgent ? "Vous" : senderName} />
                <DetailRow label="Bénéficiaire" value={isAgent ? "Client" : "Votre wallet"} />
                {transaction.agency?.name && (
                  <DetailRow label="Agence" value={transaction.agency.name} />
                )}
              </>
            ) : (
              <>
                <DetailRow label="Expéditeur"   value={isIncoming ? senderName : "Vous"} />
                <DetailRow label="Destinataire" value={isIncoming ? "Vous" : recipientName} />
                {transaction.beneficiary?.phone && (
                  <DetailRow label="Téléphone" value={transaction.beneficiary.phone} sub />
                )}
              </>
            )}

            <View style={s.divider} />
          </View>

          {/* Détail financier */}
          <View style={[s.financeSection, { backgroundColor: theme.light }]}>
            <Text style={[s.financeHeader, { fontFamily: FONTS.body }]}>DÉTAIL FINANCIER</Text>
            <DetailRow
              label="Montant principal"
              value={`${fmt(toNum(transaction.amount), transaction.currency)} ${transaction.currency}`}
            />
            {toNum(transaction.fees) > 0 && (
              <DetailRow
                label="Frais"
                value={`${fmt(toNum(transaction.fees), transaction.currency)} ${transaction.currency}`}
              />
            )}
            <View style={[s.divider, { backgroundColor: "#E2E8F0" }]} />
            <DetailRow
              label={isIncoming ? "Montant crédité" : "Total débité"}
              value={`${fmt(toNum(transaction.total ?? transaction.amount), transaction.currency)} ${transaction.currency}`}
              bold color={amountColor}
            />
          </View>
        </View>

        {/* ── Actions ── */}

        {/* SUPER_ADMIN : Valider + Rembourser */}
        {showSAActions && (
          <View style={s.actionsBlock}>
            <Text style={[s.actionsTitle, { fontFamily: FONTS.body }]}>
              ACTION REQUISE · SUPER ADMIN
            </Text>
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: "#FEE2E2", borderColor: "#FECACA", borderWidth: 1 }]}
                onPress={() => performAction("REFUND")}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator color="#DC2626" />
                  : <Text style={[s.actionBtnTxt, { color: "#DC2626", fontFamily: FONTS.body }]}>
                      ↩ Rembourser
                    </Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: "#059669" }]}
                onPress={() => performAction("VALIDATE")}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={[s.actionBtnTxt, { color: "#FFF", fontFamily: FONTS.body }]}>
                      ✓ Valider
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* COMPANY_ADMIN : Annuler */}
        {showCACancel && (
          <TouchableOpacity
            style={[s.cancelBtn, processing && { opacity: 0.6 }]}
            onPress={() => performAction("CANCEL")}
            disabled={processing}
          >
            {processing
              ? <ActivityIndicator color="#EF4444" />
              : <Text style={[s.cancelBtnTxt, { fontFamily: FONTS.body }]}>
                  Annuler la transaction
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* CLIENT : Annuler */}
        {showUserCancel && (
          <TouchableOpacity
            style={[s.cancelBtn, processing && { opacity: 0.6 }]}
            onPress={() => performAction("CANCEL")}
            disabled={processing}
          >
            {processing
              ? <ActivityIndicator color="#EF4444" />
              : <Text style={[s.cancelBtnTxt, { fontFamily: FONTS.body }]}>
                  Annuler la transaction
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* CLIENT + CA : Partager le reçu */}
        {showShareReceipt && (
          <TouchableOpacity
            style={[s.shareBtn, { backgroundColor: theme.primary }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={18} color="#FFF" />
            <Text style={[s.shareBtnTxt, { fontFamily: FONTS.body }]}>Partager le reçu</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, bold, sub, color, mono }: {
  label: string; value: string;
  bold?: boolean; sub?: boolean; color?: string; mono?: boolean;
}) {
  return (
    <View style={[s.row, sub && { marginTop: 2 }]}>
      <Text style={[s.rowLabel, { fontFamily: FONTS.body }, sub && { fontSize: 11, color: "#94A3B8" }]}>
        {label}
      </Text>
      <Text style={[
        s.rowValue,
        { fontFamily: mono ? FONTS.mono : FONTS.body },
        bold && { fontWeight: "900", fontSize: 15, color: color ?? "#0F172A" },
        sub  && { fontSize: 12, color: "#475569" },
        color && !bold && { color },
      ]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea:      { flex: 1 },
  center:        { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 80 },
  notFoundText:  { fontSize: 16, color: "#64748B" },

  navBar:   { flexDirection: "row", justifyContent: "flex-end", marginBottom: 16, marginTop: Platform.OS === "android" ? 20 : 0 },
  backBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" },

  ticket:        { backgroundColor: "#FFF", borderRadius: 24, padding: 24, paddingTop: 48, borderTopWidth: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 4, position: "relative" },
  statusBadge:   { position: "absolute", top: -16, alignSelf: "center", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 2, borderColor: "#FFF" },
  statusText:    { fontWeight: "900", fontSize: 12, letterSpacing: 0.5 },

  amountHero: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 4, marginBottom: 6, marginTop: 4 },
  amountSign: { fontSize: 28, fontWeight: "700", paddingBottom: 4 },
  amountMain: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  amountCur:  { fontSize: 14, fontWeight: "700", paddingBottom: 6 },

  txLabel: { textAlign: "center", fontSize: 13, fontWeight: "700", marginBottom: 20, letterSpacing: 0.3 },

  codeSection: { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16 },
  codeLabel:   { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, marginBottom: 8 },
  codeBox:     { flexDirection: "row", alignItems: "center", gap: 12 },
  codeText:    { fontSize: 26, fontWeight: "900", color: "#0F172A", letterSpacing: 2 },
  codeStrike:  { textDecorationLine: "line-through", color: "#CBD5E1" },

  convSection: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, marginBottom: 16, flexWrap: "wrap" },
  convTxt:     { fontSize: 13, fontWeight: "800", color: "#2563EB" },
  convRate:    { fontSize: 11, color: "#64748B", fontWeight: "600" },

  detailsSection: { gap: 12 },
  row:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel:       { fontSize: 13, color: "#64748B", fontWeight: "600" },
  rowValue:       { fontSize: 13, color: "#0F172A", fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  divider:        { height: 1, backgroundColor: "#F1F5F9", marginVertical: 2 },

  financeSection: { borderRadius: 16, padding: 18, marginTop: 20, gap: 10 },
  financeHeader:  { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, marginBottom: 4 },

  actionsBlock:  { marginTop: 24, backgroundColor: "#FFF", padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  actionsTitle:  { fontSize: 11, fontWeight: "900", color: "#94A3B8", letterSpacing: 0.5, marginBottom: 14, textTransform: "uppercase" },
  actionsRow:    { flexDirection: "row", gap: 12 },
  actionBtn:     { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  actionBtnTxt:  { fontWeight: "900", fontSize: 14 },

  cancelBtn:     { marginTop: 16, borderWidth: 2, borderColor: "#FEE2E2", paddingVertical: 16, borderRadius: 16, alignItems: "center", backgroundColor: "#FFF" },
  cancelBtnTxt:  { color: "#EF4444", fontWeight: "800", fontSize: 14 },

  shareBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16, paddingVertical: 18, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  shareBtnTxt:   { color: "#FFF", fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
});