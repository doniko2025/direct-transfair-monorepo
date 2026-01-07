//apps/direct-transfair-mobile/app/(tabs)/admin/_layout.tsx
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // On cache le header par défaut car tes écrans ont déjà leur propre Header personnalisé
        animation: "slide_from_right", // Animation fluide entre les pages
      }}
    >
      {/* 1. Le Menu Principal (Dashboard) */}
      <Stack.Screen 
        name="index" 
        options={{ title: "Admin Dashboard" }} 
      />

      {/* 2. La Liste des Transactions */}
      <Stack.Screen 
        name="transactions" 
        options={{ title: "Transactions" }} 
      />

      {/* 3. La Création de Sociétés (Super Admin) */}
      <Stack.Screen 
        name="super-dashboard" 
        options={{ 
            presentation: "modal", // S'ouvrira comme une pop-up/modal
            title: "Super Admin" 
        }} 
      />
      
      {/* 4. Les Taux de change */}
      <Stack.Screen 
        name="rates" 
        options={{ title: "Taux de Change" }} 
      />
    </Stack>
  );
}