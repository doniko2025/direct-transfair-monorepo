// apps/direct-transfair-mobile/app/(tabs)/transactions/[id].tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert, Platform, SafeAreaView, StatusBar } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEMES = { SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2", bg: "#F8FAFC" }, COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF", bg: "#F8FAFC" }, AGENT: { primary: "#78350F", light: "#FFF7ED", bg: "#F8FAFC" }, USER: { primary: "#059669", light: "#ECFDF5", bg: "#F8FAFC" } };

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

  const router = useRouter();
  const { user } = useAuth();
  
  const role = user?.role || "USER";
  const theme = THEMES[role as keyof typeof THEMES] || THEMES.USER;

  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadTransaction(); }, [idParam]);

  const loadTransaction = async () => {
    try {
      setLoading(true);
      if (!idParam) return setTransaction(null);
      let list;
      try { list = await api.adminGetTransactions(); } catch { list = await api.getTransactions(); }
      const found = list.find((t: any) => String(t.id) === String(idParam));
      setTransaction(found || null);
    } catch (e) { setTransaction(null); } finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!transaction) return;
    try {
      const ref = transaction.reference?.startsWith("TX-") ? transaction.reference : `TX-${transaction.reference}`;
      await Share.share({ message: `Reçu Transf'air\nRef: ${ref}\nMontant: ${transaction.amount} ${transaction.currency}` });
    } catch {}
  };

  const handleCopyCode = async () => {
    if (transaction?.reference) {
      await Clipboard.setStringAsync(transaction.reference);
      Platform.OS === "web" ? alert("Code copié !") : Alert.alert("Copié", "Code copié");
    }
  };

  const handleCancelUser = () => performAction("CANCELLED");
  const handleAdminValidate = () => performAction("VALIDATED");
  const handleAdminReject = () => performAction("CANCELLED");

  const performAction = async (newStatus: "VALIDATED" | "CANCELLED") => {
    if (!transaction) return;
    setProcessing(true);
    try {
      const isB2B = transaction.type === "SERVICE_PAYMENT";
      if (isB2B && newStatus === "VALIDATED") await api.validateBankTransfer(transaction.id);
      else if (isB2B && newStatus === "CANCELLED" && user?.role === "SUPER_ADMIN") await api.rejectBankTransfer(transaction.id);
      else if (user?.role === "COMPANY_ADMIN" || user?.role === "SUPER_ADMIN") await api.adminUpdateTransactionStatus(transaction.id, newStatus);
      else await api.cancelTransaction(transaction.id);

      Platform.OS === "web" ? alert("Statut mis à jour") : Alert.alert("Succès", "Statut mis à jour");
      loadTransaction();
    } catch (e: any) {
      Platform.OS === "web" ? alert(`Erreur: ${e?.response?.data?.message}`) : Alert.alert("Erreur", e?.response?.data?.message || "Erreur.");
    } finally { setProcessing(false); }
  };

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={theme.primary} /></SafeAreaView>;
  if (!transaction) return <SafeAreaView style={s.center}><Text style={s.notFoundText}>Transaction introuvable.</Text></SafeAreaView>;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "PAID": return { label: "PAYÉE", color: "#059669", bg: "#D1FAE5", icon: "checkmark-circle" };
      case "VALIDATED": return { label: "DISPONIBLE", color: "#2563EB", bg: "#DBEAFE", icon: "shield-checkmark" };
      case "CANCELLED": return { label: "ANNULÉE", color: "#DC2626", bg: "#FEE2E2", icon: "close-circle" };
      default: return { label: "EN ATTENTE", color: "#D97706", bg: "#FEF3C7", icon: "time" };
    }
  };

  const status = getStatusInfo(transaction.status);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isCompanyAdmin = user?.role === "COMPANY_ADMIN";
  const isPending = transaction.status === "PENDING";
  
  // ─── LOGIQUE D'IDENTIFICATION ───
  const typeStr = String(transaction.type || '').toUpperCase();
  const isB2B = typeStr === "SERVICE_PAYMENT";
  const isRefill = typeStr === "REFILL" || typeStr === "AGENCY_REFILL";
  const isWithdrawal = typeStr === 'WITHDRAWAL' || transaction.payoutMethod === 'CASH_PICKUP';
  const isDeposit = typeStr === "DEPOSIT" || typeStr === "TOP_UP" || (!transaction.beneficiaryId && !isWithdrawal && !isB2B && !isRefill);

  const isIncoming = isDeposit || transaction.beneficiaryId === user?.id || (isRefill && transaction.agencyId === user?.agencyId);
  const isMobileMoney = transaction.payoutMethod === "MOBILE_MONEY";
  const hasBeneficiary = Boolean(transaction.beneficiary || transaction.beneficiaryId);

  // Le code de retrait est UNIQUEMENT affiché s'il s'agit d'un vrai retrait
  const showWithdrawalCode = !isB2B && !isRefill && !isDeposit && (isWithdrawal || (hasBeneficiary && !isMobileMoney));

  const showSuperAdminActions = Boolean(isSuperAdmin && isPending);
  const canUserCancel = !isSuperAdmin && (transaction.status === "PENDING" || transaction.status === "VALIDATED");
  
  const displayReference = transaction.reference?.startsWith("TX-") ? transaction.reference : `TX-${transaction.reference}`;
  
  const senderName = transaction.senderFirstName && transaction.senderLastName ? `${transaction.senderFirstName} ${transaction.senderLastName}` : transaction.sender?.firstName ? `${transaction.sender.firstName} ${transaction.sender.lastName ?? ""}`.trim() : "Moi";
  const originCountry = transaction.currency === "XOF" ? "Sénégal" : "France";

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="close" size={26} color="#0F172A" /></TouchableOpacity>
        </View>

        <View style={s.ticket}>
          <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>

          {showWithdrawalCode && (
            <View style={s.codeSection}>
              <Text style={s.codeLabel}>CODE DE RETRAIT</Text>
              <TouchableOpacity style={s.codeBox} onPress={handleCopyCode} activeOpacity={0.7}>
                <Text style={[s.codeText, transaction.status === "CANCELLED" && s.codeStrikethrough]}>{transaction.reference}</Text>
                <Ionicons name="copy-outline" size={20} color="#D97706" />
              </TouchableOpacity>
            </View>
          )}

          <View style={s.detailsSection}>
            <DetailRow label="Date" value={new Date(transaction.createdAt).toLocaleDateString("fr-FR")} />
            <View style={s.divider} />
            
            {isDeposit ? (
              // ✅ DÉTAILS D'UN DÉPÔT EN AGENCE (Montant REÇU)
              <>
                <DetailRow label="Type d'opération" value="Dépôt en agence" bold color={theme.primary} />
                <View style={s.divider} />
                {transaction.agency ? (
                   <>
                     <DetailRow label="Agence de dépôt" value={transaction.agency.name} />
                     {transaction.agency.managerName && <DetailRow label="Gérant de l'agence" value={transaction.agency.managerName} sub />}
                     <DetailRow label="Ville de l'agence" value={`${transaction.agency.city || ''}`} sub />
                   </>
                ) : (
                   <DetailRow label="Agent déposant" value={senderName} />
                )}
                <DetailRow label="Bénéficiaire" value="Mon Wallet Personnel" sub />
              </>
            ) : isRefill ? (
              // ✅ ALIMENTATION CAISSE B2B
              <>
                <DetailRow label="Type d'opération" value="Alimentation de Caisse" bold color={theme.primary} />
                <DetailRow label="Initiateur" value={senderName} />
                {transaction.agency && (
                  <>
                    <View style={s.divider} />
                    <DetailRow label="Agence Bénéficiaire" value={transaction.agency.name} />
                    <DetailRow label="Localisation" value={`${transaction.agency.city || ''}, ${transaction.agency.country || 'Sénégal'}`} sub />
                  </>
                )}
              </>
            ) : (
              // ✅ DÉTAILS D'UN ENVOI D'ARGENT CLASSIQUE
              <>
                <DetailRow label="Expéditeur" value={isB2B ? "Admin Société" : senderName} />
                {transaction.sender?.phone && <DetailRow label="Tél. Expéditeur" value={transaction.sender.phone} sub />}
                <DetailRow label="Pays d'origine" value={originCountry} sub />
                <View style={s.divider} />
                <DetailRow label="Bénéficiaire" value={isB2B ? "Super Admin" : transaction.beneficiary?.fullName || "Non spécifié"} />
                {transaction.beneficiary?.phone && <DetailRow label="Tél. Bénéficiaire" value={transaction.beneficiary.phone} sub />}
                <DetailRow label="Pays destination" value={transaction.beneficiary?.country || "Sénégal"} sub />
              </>
            )}

            <View style={s.divider} />
            <DetailRow label="Réf. Unique" value={displayReference} />
          </View>

          <View style={s.financeSection}>
            <Text style={s.financeHeader}>DÉTAIL FINANCIER</Text>
            <DetailRow label="Montant principal" value={`${Number(transaction.amount).toLocaleString("fr-FR")} ${transaction.currency}`} />
            
            {/* Si c'est un dépôt, il n'y a généralement pas de frais pour l'utilisateur, ou alors on l'affiche explicitement */}
            {(!isDeposit && !isRefill) && (
                <DetailRow label="Frais d'envoi" value={`${Number(transaction.fees).toLocaleString("fr-FR")} ${transaction.currency}`} />
            )}
            
            <DetailRow label={isIncoming ? "Montant crédité" : "Total payé"} value={`${Number(transaction.total || transaction.amount).toLocaleString("fr-FR")} ${transaction.currency}`} bold color={theme.primary} />
          </View>
        </View>

        {!isSuperAdmin && !isCompanyAdmin && (
          <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.primary }]} onPress={handleShare} activeOpacity={0.9}>
            <Text style={s.shareBtnText}>Partager le reçu</Text>
          </TouchableOpacity>
        )}

        {showSuperAdminActions && (
          <View style={s.adminActions}>
            <Text style={s.adminTitle}>Action Requise (Super Admin)</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA" }]} onPress={handleAdminReject} disabled={processing}>
                {processing ? <ActivityIndicator color="#DC2626" /> : <Text style={[s.btnText, { color: "#DC2626" }]}>Rejeter</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#10B981" }]} onPress={handleAdminValidate} disabled={processing}>
                {processing ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Valider le Paiement</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {canUserCancel && (
          <TouchableOpacity style={[s.cancelBtn, processing && { opacity: 0.6 }]} onPress={handleCancelUser} disabled={processing}>
            {processing ? <ActivityIndicator color="#EF4444" /> : <Text style={s.cancelBtnText}>Annuler la transaction</Text>}
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, bold, sub, color }: any) {
  return (
    <View style={[s.row, sub && { marginTop: 4 }]}>
      <Text style={[s.rowLabel, sub && { fontSize: 12, color: "#94A3B8" }]}>{label}</Text>
      <Text style={[s.rowValue, bold && { fontWeight: "900", color: color || "#0F172A", fontSize: 15 }, sub && { fontSize: 13, color: "#475569" }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 80 },
  notFoundText: { fontFamily: FONTS.body, fontSize: 16, color: "#64748B" },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 20, marginTop: Platform.OS === 'android' ? 20 : 0 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E2E8F0", justifyContent: 'center', alignItems: 'center' },
  ticket: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, paddingTop: 40, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 4, position: 'relative' },
  statusBadge: { position: 'absolute', top: -14, alignSelf: 'center', flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 2, borderColor: "#FFF" },
  statusText: { fontFamily: FONTS.body, fontWeight: "900", fontSize: 12, letterSpacing: 0.5 },
  codeSection: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 24, borderWidth: 1, borderColor: "#F1F5F9" },
  codeLabel: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, marginBottom: 8 },
  codeBox: { flexDirection: "row", alignItems: "center", gap: 12 },
  codeText: { fontSize: 28, fontFamily: FONTS.heading, fontWeight: "900", color: "#0F172A", letterSpacing: 2 },
  codeStrikethrough: { textDecorationLine: "line-through", color: "#CBD5E1" },
  detailsSection: { gap: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 14, fontFamily: FONTS.body, color: "#64748B", fontWeight: "600" },
  rowValue: { fontSize: 14, fontFamily: FONTS.body, color: "#0F172A", fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 4 },
  financeSection: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 20, marginTop: 24, gap: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  financeHeader: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, marginBottom: 4 },
  shareBtn: { paddingVertical: 18, borderRadius: 16, alignItems: "center", marginTop: 30, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  shareBtnText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "900", fontSize: 15, letterSpacing: 0.5 },
  cancelBtn: { backgroundColor: "transparent", borderWidth: 2, borderColor: "#FEE2E2", paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 20 },
  cancelBtnText: { color: "#EF4444", fontFamily: FONTS.body, fontWeight: "800", fontSize: 14 },
  adminActions: { marginTop: 30, backgroundColor: "#FFF", padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  adminTitle: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "900", color: "#64748B", marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "900", fontSize: 14 },
});