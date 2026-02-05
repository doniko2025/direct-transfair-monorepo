//apps/direct-transfair-mobile/app/(tabs)/transactions/[id].tsx
import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Share, Alert, Platform 
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard'; 
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider"; 
import { colors } from "../../../theme/colors";

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadTransaction(); }, [id]);

  const loadTransaction = async () => {
    try {
      const list = (user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN')
        ? await api.adminGetTransactions()
        : await api.getTransactions();
        
      const found = list.find((t: any) => t.id === id);
      setTransaction(found || null);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!transaction) return;
    try { await Share.share({ message: `Reçu Transf'air\nRef: TX-${transaction.reference}\nMontant: ${transaction.amount} ${transaction.currency}` }); } catch (error) {}
  };

  const handleCopyCode = async () => {
    if(transaction?.reference) { 
        await Clipboard.setStringAsync(transaction.reference); 
        if (Platform.OS === 'web') alert("Code copié !");
        else Alert.alert("Copié", "Code copié"); 
    }
  };

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
      if (Platform.OS === 'web') {
          if (window.confirm(`${title}\n\n${message}`)) {
              onConfirm();
          }
      } else {
          Alert.alert(title, message, [
              { text: "Non", style: "cancel" },
              { text: "Oui", onPress: onConfirm, style: "destructive" }
          ]);
      }
  };

  const handleCancelUser = () => {
      confirmAction(
          "Annuler la transaction ?", 
          "Cette action est irréversible. Le montant sera remboursé immédiatement.", 
          () => performAction('CANCELLED')
      );
  };

  const handleAdminValidate = () => {
      confirmAction(
          "Valider la transaction ?", 
          "Le montant sera transféré et le statut mis à jour.", 
          () => performAction('VALIDATED')
      );
  };

  const handleAdminReject = () => {
      confirmAction(
          "Rejeter la transaction ?", 
          "La transaction sera annulée et l'argent remboursé à l'expéditeur.", 
          () => performAction('CANCELLED')
      );
  };

  const performAction = async (newStatus: string) => {
      setProcessing(true);
      try {
          // Gestion spéciale pour la validation B2B (Paiement Service)
          if (transaction.type === 'SERVICE_PAYMENT' && newStatus === 'VALIDATED') {
              await api.validateBankTransfer(transaction.id);
          } 
          // Gestion standard pour tout le reste (Rejet B2B ou Validation/Rejet Client)
          else if (user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN') {
              await api.adminUpdateTransactionStatus(transaction.id, newStatus);
          } else {
              await api.cancelTransaction(transaction.id);
          }
          
          if (Platform.OS === 'web') {
              alert(`Succès : Statut mis à jour vers ${newStatus}`);
              loadTransaction();
          } else {
              Alert.alert("Succès", `Statut mis à jour : ${newStatus}`, [{ text: "OK", onPress: loadTransaction }]);
          }
      } catch (e: any) { 
          const msg = e.response?.data?.message || "Erreur lors de l'action";
          if (Platform.OS === 'web') alert(`Erreur: ${msg}`);
          else Alert.alert("Erreur", msg); 
      } finally { 
          setProcessing(false); 
      }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "PAID": return { label: "PAYÉE", color: "#16a34a", icon: "checkmark-circle" };
      case "VALIDATED": return { label: "DISPONIBLE", color: "#2563eb", icon: "shield-checkmark" };
      case "CANCELLED": return { label: "ANNULÉE", color: "#dc2626", icon: "close-circle" };
      default: return { label: "EN ATTENTE", color: "#d97706", icon: "time" };
    }
  };

  const handleGoBack = () => {
      router.navigate('/(tabs)/transactions');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!transaction) return <View style={styles.center}><Text>Introuvable.</Text></View>;

  const status = getStatusInfo(transaction.status);
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isPending = transaction.status === 'PENDING';
  const canUserCancel = !isAdmin && (transaction.status === 'PENDING' || transaction.status === 'VALIDATED');

  // ✅ CORRECTION ICI : Masquer le code de retrait pour les paiements B2B (Service Payment)
  const isB2B = transaction.type === 'SERVICE_PAYMENT';
  // On affiche le code SEULEMENT si ce n'est PAS un paiement B2B ET qu'il y a une référence fournisseur
  const showWithdrawalCode = !isB2B && !!transaction.providerRef;

  const displayReference = transaction.reference.startsWith('TX-') 
      ? transaction.reference 
      : `TX-${transaction.reference}`;

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 150 }]}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Détail Transaction</Text>
        <View style={{width: 24}} /> 
      </View>

      <View style={styles.ticket}>
        <View style={styles.headerSection}>
            <Text style={styles.amountLabel}>Montant envoyé</Text>
            <Text style={styles.bigAmount}>{Number(transaction.amount).toFixed(2)} <Text style={styles.currency}>{transaction.currency}</Text></Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                <Ionicons name={status.icon as any} size={16} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
        </View>
        
        {/* ✅ Utilisation de la nouvelle condition showWithdrawalCode */}
        {showWithdrawalCode && (
            <View style={styles.codeSection}>
                <Text style={styles.codeLabel}>CODE DE RETRAIT</Text>
                <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode}>
                    <Text style={[styles.codeText, transaction.status === 'CANCELLED' && {textDecorationLine:'line-through', color:'#CCC'}]}>{transaction.reference}</Text>
                    <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>
        )}

        <View style={styles.detailsSection}>
            <DetailRow label="Date" value={new Date(transaction.createdAt).toLocaleDateString()} />
            
            {/* Si B2B, on affiche "Admin Société" au lieu de l'expéditeur standard */}
            <DetailRow label="Expéditeur" value={isB2B ? "Admin Société" : (transaction.sender?.firstName ? `${transaction.sender.firstName} ${transaction.sender.lastName}` : "Moi")} />
            
            {/* Si B2B, on affiche "Super Admin" au lieu de "Non spécifié" */}
            <DetailRow label="Bénéficiaire" value={isB2B ? "Super Admin" : (transaction.beneficiary?.fullName || "Non spécifié")} />
            
            <DetailRow label="Pays destination" value={transaction.beneficiary?.country || "Sénégal"} />
            <DetailRow label="Réf. Unique" value={displayReference} />
            
            <View style={styles.divider} />
            <DetailRow label="Total payé" value={`${transaction.total} ${transaction.currency}`} bold />
        </View>
      </View>

      {/* ACTIONS ADMIN */}
      {isAdmin && isPending && (
          <View style={styles.adminActions}>
              <Text style={styles.adminTitle}>Action Requise (Admin)</Text>
              <View style={{flexDirection:'row', gap:10}}>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#EF4444'}]} onPress={handleAdminReject} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Rejeter</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#10B981'}]} onPress={handleAdminValidate} disabled={processing}>
                      {processing ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Valider</Text>}
                  </TouchableOpacity>
              </View>
          </View>
      )}

      {/* ACTIONS USER */}
      {canUserCancel && (
          <TouchableOpacity style={[styles.cancelBtn, processing && {opacity: 0.6}]} onPress={handleCancelUser} disabled={processing}>
            {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.cancelBtnText}>Annuler et Rembourser</Text>}
          </TouchableOpacity>
      )}
      
      {/* BOUTON PARTAGER LE REÇU */}
      {!isAdmin && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>Partager le reçu</Text>
          </TouchableOpacity>
      )}

    </ScrollView>
  );
}

function DetailRow({ label, value, bold }: any) {
    return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, bold && {fontWeight:'800', color:colors.primary}]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#f3f4f6", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  backBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 20 },
  navTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  ticket: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowOpacity: 0.05, elevation: 3 },
  headerSection: { alignItems: 'center', paddingBottom: 20 },
  amountLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 5 },
  bigAmount: { fontSize: 32, fontWeight: '900', color: colors.text },
  currency: { fontSize: 18, color: '#999' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 10, gap: 5 },
  statusText: { fontWeight: '800', fontSize: 12 },
  codeSection: { padding: 20, alignItems: 'center', backgroundColor: '#fafafa', borderRadius: 10, marginVertical: 10 },
  codeLabel: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 5 },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeText: { fontSize: 20, fontWeight: '800', color: '#333', letterSpacing: 1 },
  detailsSection: { gap: 10, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#666' },
  rowValue: { color: '#333', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 5 },
  shareBtn: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  shareBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#EF4444', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  cancelBtnText: { color: '#fff', fontWeight: '700' },
  adminActions: { marginTop: 20, backgroundColor: '#FFF', padding: 15, borderRadius: 15, elevation:2 },
  adminTitle: { fontWeight: '700', marginBottom: 10, color: '#374151' },
  actionBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800' }
});