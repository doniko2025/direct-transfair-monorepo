//apps/direct-transfair-mobile/services/admin.ts
import { api } from "./api";
import type { Transaction } from "./types";

export function getAdminTransactions() {
  return api.get<Transaction[]>("/transactions/admin/all");
}

export function updateTransactionStatus(
  id: string,
  status: "PENDING" | "VALIDATED" | "PAID" | "CANCELLED"
) {
  return api.patch(`/transactions/admin/status/${id}`, { status });
}
