//apps/direct-transfair-mobile/components/TransactionItem.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import type { Transaction } from "../services/types";

/* =========================
   Labels
========================= */

const STATUS_LABEL: Record<string, string> = {
  PAID: "Payée",
  VALIDATED: "Validée",
  PENDING: "En attente",
  CANCELLED: "Annulée",
};

const METHOD_LABEL: Record<string, string> = {
  CASH_PICKUP: "Retrait cash",
  BANK_DEPOSIT: "Dépôt bancaire",
  MOBILE_MONEY: "Mobile money",
  WALLET: "Wallet Direct Transf'air",
};

/* =========================
   Helpers
========================= */

function statusColor(status: string): string {
  switch (status) {
    case "PAID":
      return "#16a34a"; // vert
    case "VALIDATED":
      return "#0ea5e9"; // bleu
    case "CANCELLED":
      return "#dc2626"; // rouge
    case "PENDING":
    default:
      return "#f97316"; // orange
  }
}

function formatMoney(value: string, currency: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return `${value} ${currency}`;
  }
  return `${num.toFixed(2)} ${currency}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString("fr-FR");
}

/* =========================
   Component
========================= */

type Props = {
  tx: Transaction;
};

export default function TransactionItem({ tx }: Props) {
  const statusLabel = STATUS_LABEL[tx.status] ?? tx.status;
  const methodLabel =
    METHOD_LABEL[tx.payoutMethod] ?? tx.payoutMethod;

  // ✅ normalisation string (clé de la correction)
  const rawAmount =
    tx.total !== undefined && tx.total !== null
      ? String(tx.total)
      : String(tx.amount);

  const amountLabel = formatMoney(rawAmount, tx.currency);
  const dateLabel = formatDate(tx.createdAt);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.amount}>{amountLabel}</Text>
        <Text
          style={[
            styles.status,
            { backgroundColor: statusColor(tx.status) },
          ]}
        >
          {statusLabel}
        </Text>
      </View>

      <Text style={styles.meta}>Méthode : {methodLabel}</Text>
      <Text style={styles.meta}>Réf. {tx.reference}</Text>
      <Text style={styles.meta}>Créée le {dateLabel}</Text>
    </View>
  );
}

/* =========================
   Styles
========================= */

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  status: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    color: "#fff",
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});
