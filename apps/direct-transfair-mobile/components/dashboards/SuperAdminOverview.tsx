//apps/direct-transfair-mobile/components/dashboards/SuperAdminOverview.tsx
import React from "react";
import SuperAdminDashboard from "./SuperAdminDashboard";

/**
 * Ce composant sert désormais de passerelle vers le Dashboard fusionné.
 * Cela évite de casser les imports ailleurs dans le projet.
 */
export default function SuperAdminOverview() {
  return <SuperAdminDashboard />;
}