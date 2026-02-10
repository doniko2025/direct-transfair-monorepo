//apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React from "react";
import { useAuth } from "../../providers/AuthProvider";

// Import des Dashboards
import ClientDashboard from "../../components/dashboards/ClientDashboard";
import AgentDashboard from "../../components/dashboards/AgentDashboard";
import CompanyDashboard from "../../components/dashboards/CompanyDashboard";

// ✅ On importe les Stats (Le fichier qu'on vient de créer)
import SuperAdminOverview from "../../components/dashboards/SuperAdminOverview"; 

export default function HomeScreen() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'USER':
      return <ClientDashboard />;
    
    case 'AGENT':
      return <AgentDashboard />;
    
    case 'COMPANY_ADMIN':
      return <CompanyDashboard />;
    
    case 'SUPER_ADMIN':
      // ✅ C'est ici qu'on affiche les Stats/Boutons colorés
      return <SuperAdminOverview />;
      
    default:
      return null;
  }
}