//apps/direct-transfair-mobile/app/(tabs)/transactions/[id].tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  Alert, // ✅ Vérifie que c'est bien importé de react-native
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard'; 

import { api } from "../../../services/api";
import type { Transaction } from "../../../services/types";
import { colors } from "../../../theme/colors";

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false); 

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    try {
      const list = await api.getTransactions();
      const found = list.find((t) => t.id === id);
      setTransaction(found || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!transaction) return;
    try {
      const message = `👋 Coucou !\n\nJe t'ai envoyé ${transaction.amount} ${transaction.currency} via Direct Transf'air.\n\n🔒 Code de retrait : ${transaction.reference}\n\nRends-toi au guichet le plus proche !`;
      await Share.share({ message });
    } catch (error) {
      console.log("Erreur partage", error);
    }
  };

  const handleCopyCode = async () => {
    if(transaction?.reference) {
        await Clipboard.setStringAsync(transaction.reference);
        Alert.alert("Copié", "Code copié dans le presse-papier");
    }
  };

  // --- LOGIQUE D'ANNULATION ---
  const handleCancel = () => {
      console.log("Clic sur Annuler"); // 🔍 DEBUG
      
      // Sur Web, Alert.alert est parfois bloqué, on utilise window.confirm
      if (Platform.OS === 'web') {
          const confirm = window.confirm("Êtes-vous sûr de vouloir annuler et rembourser cette transaction ?");
          if (confirm) processCancel();
          return;
      }

      Alert.alert(
          "Annuler la transaction",
          "Êtes-vous sûr de vouloir annuler et rembourser cette transaction ? Cette action est irréversible.",
          [
              { text: "Non", style: "cancel", onPress: () => console.log("Annulation annulée") },
              { text: "Oui, Annuler", style: "destructive", onPress: processCancel }
          ]
      );
  };

  const processCancel = async () => {
      console.log("Lancement processCancel..."); // 🔍 DEBUG
      setCancelling(true);
      try {
          await api.cancelTransaction(transaction!.id);
          console.log("Annulation réussie API"); // 🔍 DEBUG
          
          if (Platform.OS === 'web') {
              alert("Succès : Transaction annulée et remboursée.");
              loadTransaction();
          } else {
              Alert.alert("Succès", "Transaction annulée avec succès. Les fonds ont été remboursés.", [
                  { text: "OK", onPress: loadTransaction } 
              ]);
          }
      } catch (e: any) {
          console.error("Erreur annulation", e); // 🔍 DEBUG
          const msg = e.response?.data?.message || "Impossible d'annuler.";
          
          if (Platform.OS === 'web') alert(`Erreur: ${msg}`);
          else Alert.alert("Erreur", msg);
      } finally {
          setCancelling(false);
      }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "PAID": return { label: "PAYÉE", color: "#16a34a", icon: "checkmark-circle" };
      case "VALIDATED": return { label: "VALIDÉE", color: "#2563eb", icon: "shield-checkmark" };
      case "CANCELLED": return { label: "ANNULÉE", color: "#dc2626", icon: "close-circle" };
      default: return { label: "EN ATTENTE", color: "#d97706", icon: "time" };
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.center}>
        <Text>Transaction introuvable.</Text>
      </View>
    );
  }

  const status = getStatusInfo(transaction.status);
  const date = new Date(transaction.createdAt).toLocaleDateString("fr-FR", {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const canCancel = transaction.status === 'PENDING' || transaction.status === 'VALIDATED';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* HEADER NAVIGATION */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Reçu de transaction</Text>
        <View style={{width: 24}} /> 
      </View>

      {/* CARTE PRINCIPALE */}
      <View style={styles.ticket}>
        
        {/* MONTANT ET STATUT */}
        <View style={styles.headerSection}>
            <Text style={styles.amountLabel}>Montant envoyé</Text>
            <Text style={styles.bigAmount}>{Number(transaction.amount).toFixed(2)} <Text style={styles.currency}>{transaction.currency}</Text></Text>
            
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                <Ionicons name={status.icon as any} size={16} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
        </View>

        <View style={styles.dashedLine} />

        {/* CODE DE RETRAIT */}
        <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>CODE DE RETRAIT</Text>
            <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode}>
                <Text style={[styles.codeText, transaction.status === 'CANCELLED' && {textDecorationLine:'line-through', color:'#CCC'}]}>
                    {transaction.reference}
                </Text>
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.codeHint}>Transmettez ce code uniquement au bénéficiaire.</Text>
        </View>

        <View style={styles.divider} />

        {/* DÉTAILS */}
        <View style={styles.detailsSection}>
            <DetailRow label="Date" value={date} />
            <DetailRow label="Bénéficiaire" value="Voir liste bénéficiaires" /> 
            <DetailRow label="Méthode" value={transaction.payoutMethod.replace("_", " ")} />
        </View>

        <View style={styles.divider} />

        {/* FINANCIER */}
        <View style={styles.detailsSection}>
            <DetailRow label="Montant envoyé" value={`${transaction.amount} ${transaction.currency}`} />
            <DetailRow label="Frais" value={`${transaction.fees} ${transaction.currency}`} />
            <View style={{marginTop: 8}}>
                <DetailRow label="Total payé" value={`${transaction.total} ${transaction.currency}`} bold />
            </View>
        </View>

      </View>

      {/* ACTIONS */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Ionicons name="share-social" size={20} color="#fff" />
        <Text style={styles.shareBtnText}>Partager le reçu</Text>
      </TouchableOpacity>

      {/* BOUTON ANNULER (Rouge) */}
      {canCancel && (
          <TouchableOpacity 
            style={[styles.cancelBtn, cancelling && {opacity: 0.6}]} 
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
                <ActivityIndicator color="#FFF" />
            ) : (
                <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.cancelBtnText}>Annuler et Rembourser</Text>
                </>
            )}
          </TouchableOpacity>
      )}

      <View style={{height: 40}} />
    </ScrollView>
  );
}

function DetailRow({ label, value, bold }: { label: string, value: string, bold?: boolean }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#f3f4f6", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  backBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 20 },
  navTitle: { fontSize: 18, fontWeight: '700', color: '#333' },

  ticket: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerSection: { alignItems: 'center', padding: 24, paddingBottom: 30 },
  amountLabel: { fontSize: 14, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  bigAmount: { fontSize: 36, fontWeight: '900', color: colors.text },
  currency: { fontSize: 20, fontWeight: '600', color: '#999' },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 16, gap: 6 },
  statusText: { fontWeight: '800', fontSize: 12 },

  dashedLine: { height: 1, borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed', marginHorizontal: 20 },

  codeSection: { padding: 24, alignItems: 'center', backgroundColor: '#fafafa' },
  codeLabel: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 10 },
  codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.primary + '30', gap: 10 },
  codeText: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: 2 },
  codeHint: { fontSize: 12, color: '#999', marginTop: 12, textAlign: 'center' },

  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 24 },

  detailsSection: { padding: 24, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: '#666', fontSize: 14 },
  rowValue: { color: '#333', fontSize: 14, fontWeight: '500' },
  rowValueBold: { fontWeight: '800', fontSize: 16, color: colors.primary },

  shareBtn: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 24, gap: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  cancelBtn: { flexDirection: 'row', backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 10 },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});