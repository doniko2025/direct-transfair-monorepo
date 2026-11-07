// apps/direct-transfair-mobile/app/(tabs)/home.tsx
// =========================================================
// HOME v11.0 — Lot 12 : accueil client OU accueil marchand selon le type de compte.
// Les tableaux de bord agent / admin société / super admin vivent dans le portail web (apps/web-admin).
// =========================================================

import React from "react";
import { useAuth } from "../../providers/AuthProvider";
import ClientDashboard from "../../components/dashboards/ClientDashboard";
import MerchantDashboard from "../../components/dashboards/MerchantDashboard";

export default function HomeScreen() {
  const { user } = useAuth();

  if (!user) return null;

  return user.accountType === "MERCHANT" ? <MerchantDashboard /> : <ClientDashboard />;
}
