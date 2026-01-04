// apps/direct-transfair-mobile/app/(tabs)/withdraw.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import DTTextInput from "../../components/DTTextInput";
import DTButton from "../../components/DTButton"; // Assure-toi d'avoir ce composant (sinon utilise Button standard)
import { Card } from "../../components/layout/Card"; 
import type { Transaction } from "../../services/types";
import { showConfirm, showAlert } from "../../utils/alert"; // Ton fichier alert.ts

export default function AgentWithdrawScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  // 1. Chercher la transaction par son code
  const handleSearch = async () => {
    if (code.trim().length < 3) {
      showAlert("Erreur", "Veuillez entrer un code valide.");
      return;
    }

    try {
      setLoading(true);
      setTransaction(null);
      const result = await api.findTransactionByReference(code.trim());
      setTransaction(result);
    } catch (e) {
      console.error(e);
      showAlert("Introuvable", "Aucune transaction trouvée avec ce code.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Valider le paiement (Donner le cash)
  const handleProcessPayment = async () => {
    if (!transaction) return;

    showConfirm(
      "Confirmation Retrait",
      `Confirmez-vous remettre la somme de ${transaction.amount} ${transaction.currency} au client ?`,
      async () => {
        try {
          setLoading(true);
          await api.processCashWithdrawal(transaction.id);
          
          showAlert("Succès", "Retrait validé ! L'argent a été remis.", () => {
            setCode("");
            setTransaction(null);
          });
        } catch (e) {
          console.error(e);
          showAlert("Erreur", "Impossible de valider le retrait.");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const renderStatusAction = (tx: Transaction) => {
    // Cas 1 : Déjà payé
    if (tx.status === "PAID") {
      return (
        <View style={[styles.statusBox, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statusText, { color: "#166534" }]}>✅ DÉJÀ PAYÉ</Text>
          <Text style={styles.statusSub}>Ce code a déjà été utilisé.</Text>
        </View>
      );
    }

    // Cas 2 : Annulé
    if (tx.status === "CANCELLED") {
      return (
        <View style={[styles.statusBox, { backgroundColor: "#fee2e2" }]}>
          <Text style={[styles.statusText, { color: "#991b1b" }]}>❌ ANNULÉE</Text>
          <Text style={styles.statusSub}>Transaction annulée.</Text>
        </View>
      );
    }

    // Cas 3 : En attente (ex: > 200€ non validé par admin)
    if (tx.status === "PENDING") {
      return (
        <View style={[styles.statusBox, { backgroundColor: "#ffedd5" }]}>
          <Text style={[styles.statusText, { color: "#9a3412" }]}>⏳ EN ATTENTE ADMIN</Text>
          <Text style={styles.statusSub}>
            Cette transaction nécessite une validation administrative avant retrait.
          </Text>
        </View>
      );
    }

    // Cas 4 : Validé (Prêt à payer)
    if (tx.status === "VALIDATED") {
      return (
        <View>
            <View style={[styles.statusBox, { backgroundColor: "#dbeafe" }]}>
              <Text style={[styles.statusText, { color: "#1e40af" }]}>PRÊT À PAYER</Text>
              <Text style={styles.statusSub}>Vérifiez l'identité et remettez les fonds.</Text>
            </View>
            <View style={{ marginTop: 20 }}>
                <DTButton 
                    label={loading ? "Traitement..." : "Valider le Retrait Cash"} 
                    onPress={handleProcessPayment} 
                    disabled={loading}
                />
            </View>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Guichet Retrait</Text>
      <Text style={styles.subHeader}>Entrez le code de la transaction.</Text>

      {/* Zone de Recherche */}
      <View style={styles.searchSection}>
        <DTTextInput
          label="Code de transaction"
          value={code}
          onChangeText={setCode}
          placeholder="Ex: TX-1767..."
        />
        <DTButton 
            label={loading && !transaction ? "Recherche..." : "Vérifier le code"} 
            onPress={handleSearch} 
            disabled={loading} 
        />
      </View>

      {/* Résultat */}
      {transaction && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Résultat</Text>
          
          <Card style={styles.ticket}>
             <View style={styles.row}>
                <Text style={styles.label}>Montant à payer</Text>
                <Text style={styles.amount}>{transaction.amount} {transaction.currency}</Text>
             </View>
             
             <View style={styles.divider} />
             
             <View style={styles.row}>
                <Text style={styles.label}>Référence</Text>
                <Text style={styles.value}>{transaction.reference}</Text>
             </View>
             
             <View style={styles.divider} />

             {renderStatusAction(transaction)}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  subHeader: {
    color: colors.muted,
    marginBottom: 20,
  },
  searchSection: {
    marginBottom: 30,
  },
  resultSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    color: colors.text,
  },
  ticket: {
    padding: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: colors.muted,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  amount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 16,
  },
  statusBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    fontWeight: "800",
    fontSize: 14,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 12,
    color: "#4b5563",
  },
});