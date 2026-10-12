// apps/direct-transfair-mobile/app/(tabs)/home.tsx
// =========================================================
// HOME v10.0 — Clients wallet uniquement (phase 5)
// Les tableaux de bord agent / admin société / super admin vivent
// désormais dans le portail web (apps/web-admin).
// =========================================================

import React from "react";
import { useAuth } from "../../providers/AuthProvider";
import ClientDashboard from "../../components/dashboards/ClientDashboard";

export default function HomeScreen() {
  const { user } = useAuth();

  if (!user) return null;

  return <ClientDashboard />;
}
