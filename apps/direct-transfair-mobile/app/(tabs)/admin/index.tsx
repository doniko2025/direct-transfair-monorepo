//apps/direct-transfair-mobile/app/(tabs)/admin/index.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAuth } from "../../../providers/AuthProvider";

// ✅ On importe le composant "Liste des Sociétés" 
// (Attention au chemin : on remonte de 3 crans : app -> tabs -> admin -> racine)
import SuperAdminDashboard from "../../../components/dashboards/SuperAdminDashboard"; 

export default function AdminTabScreen() {
  const { user } = useAuth();

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <Text>Accès réservé.</Text>
      </View>
    );
  }

  // ✅ On affiche la liste ici
  return <SuperAdminDashboard />;
}