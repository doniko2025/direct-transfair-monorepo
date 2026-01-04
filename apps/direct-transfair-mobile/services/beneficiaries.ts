//apps/direct-transfair-mobile/services/beneficiaries.ts
import api from "./api";
import type { Beneficiary } from "./types";

export async function fetchBeneficiaries(): Promise<Beneficiary[]> {
  const res = await api.get("/beneficiaries");
  return Array.isArray(res.data) ? res.data : [];
}
