// apps/direct-transfair-mobile/app/(tabs)/home.tsx
// =========================================================
// HOME v12.0 — accueil du COMPTE ACTIF : « Compte client » ou « Compte marchand » (deux comptes séparés, bascule en haut de page).
// (v11.0 — Lot 12 : accueil client OU accueil marchand.)
// Les tableaux de bord agent / admin société / super admin vivent dans le portail web (apps/web-admin).
// =========================================================

import React from "react";
import { useAuth } from "../../providers/AuthProvider";
import ClientDashboard from "../../components/dashboards/ClientDashboard";
import MerchantDashboard from "../../components/dashboards/MerchantDashboard";
import { useAccountSpace } from "../../hooks/useAccountSpace";

export default function HomeScreen() {
  const { user } = useAuth();
  const { isMerchant, ready } = useAccountSpace();

  // Tant que le compte mémorisé n'est pas relu, rien ne s'affiche (évite un éclair du mauvais compte et ses chargements inutiles).
  if (!user || !ready) return null;

  return isMerchant ? <MerchantDashboard /> : <ClientDashboard />;
}
