//apps/direct-transfair-mobile/app/(tabs)/home.tsx
import React from "react";
import { useAuth } from "../../providers/AuthProvider";

// Import des Dashboards spécifiques
import ClientDashboard from "../../components/dashboards/ClientDashboard";
import AgentDashboard from "../../components/dashboards/AgentDashboard";
import CompanyDashboard from "../../components/dashboards/CompanyDashboard";
// Si tu as déjà le fichier SuperAdmin, importe-le ici, sinon je mets un placeholder
// import SuperAdminDashboard from "../../components/dashboards/SuperAdminDashboard";

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
      // Si tu n'as pas encore le fichier, tu peux laisser ton ancien code SuperAdmin ici temporairement
      return null; // Remplace par <SuperAdminDashboard /> quand tu l'auras
      
    default:
      return null;
  }
}