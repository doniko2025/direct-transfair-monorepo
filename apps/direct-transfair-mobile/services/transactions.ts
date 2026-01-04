//apps/direct-transfair-mobile/services/transactions.ts
import api from "./api";

export async function createTransaction(payload: {
  beneficiaryId: string;
  amount: number;
  currency: string;
  payoutMethod: "CASH_PICKUP" | "MOBILE_MONEY";
}) {
  await api.post("/transactions", payload);
}
